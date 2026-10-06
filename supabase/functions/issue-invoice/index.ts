// POST /functions/v1/issue-invoice  { "invoiceId": "<uuid>" }
// "Timbrar / Cobrar": solo Admin o Finance, solo facturas Draft.
//   MXN -> CFDI 4.0 vía PAC; guarda UUID, XML y PDF.
//   USD -> Stripe Payment Link; guarda su id y URL.
// En ambos casos la factura pasa a Sent.
import {
  invoiceFolio,
  missingCfdiFields,
  toStripeAmount,
  type InvoiceLine,
} from "../_shared/billing.ts";
import { bearerToken, corsHeaders, json, problem } from "../_shared/http.ts";
import { pacFromEnv } from "../_shared/pac.ts";
import { getStripe } from "../_shared/stripe.ts";
import { getAdminClient, requireStaff } from "../_shared/supabase.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCK_TTL_MS = 5 * 60 * 1000;
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

type Client = {
  id: string;
  name: string;
  tax_id: string;
  currency: "USD" | "MXN";
  billing_email: string;
  tax_regime: string | null;
  fiscal_postal_code: string | null;
  cfdi_use: string | null;
};

type ClaimedInvoice = {
  id: string;
  month: number;
  year: number;
  total_amount: number;
  currency: "USD" | "MXN";
  clients: Client;
};

class IssueError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function issueMxn(invoice: ClaimedInvoice, lines: InvoiceLine[]) {
  const admin = getAdminClient();
  const missing = missingCfdiFields(invoice.clients);
  if (missing.length > 0) {
    throw new IssueError(422, `Al cliente le faltan datos para el CFDI: ${missing.join(", ")}.`);
  }

  const { data: company } = await admin.from("company_settings").select("*").maybeSingle();
  if (!company)
    throw new IssueError(422, "Faltan los datos fiscales del emisor (company_settings).");

  const folio = invoiceFolio(invoice);
  const cfdi = await pacFromEnv().issueCfdi({
    folio,
    periodLabel: `${MONTHS[invoice.month - 1]} ${invoice.year}`,
    issuer: {
      rfc: company.rfc,
      legalName: company.legal_name,
      taxRegime: company.tax_regime,
      postalCode: company.postal_code,
    },
    receiver: {
      rfc: invoice.clients.tax_id,
      name: invoice.clients.name,
      taxRegime: invoice.clients.tax_regime!,
      postalCode: invoice.clients.fiscal_postal_code!,
      cfdiUse: invoice.clients.cfdi_use!,
    },
    lines,
  });

  const basePath = `${invoice.year}/${folio}`;
  const storage = admin.storage.from("invoices");
  const [xmlUpload, pdfUpload] = await Promise.all([
    storage.upload(`${basePath}.xml`, cfdi.xml, { contentType: "application/xml", upsert: true }),
    storage.upload(`${basePath}.pdf`, cfdi.pdf, { contentType: "application/pdf", upsert: true }),
  ]);
  if (xmlUpload.error || pdfUpload.error) {
    console.error("storage upload failed", xmlUpload.error ?? pdfUpload.error);
  }

  return {
    external_id: cfdi.uuid,
    xml_path: xmlUpload.error ? null : `${basePath}.xml`,
    pdf_path: pdfUpload.error ? null : `${basePath}.pdf`,
  };
}

async function issueUsd(invoice: ClaimedInvoice) {
  const stripe = getStripe();
  const folio = invoiceFolio(invoice);
  const price = await stripe.prices.create(
    {
      currency: "usd",
      unit_amount: toStripeAmount(invoice.total_amount),
      product_data: { name: `Nexo IT services · ${invoice.clients.name} · ${folio}` },
    },
    { idempotencyKey: `invoice-${invoice.id}-price` },
  );
  const link = await stripe.paymentLinks.create(
    {
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { invoice_id: invoice.id },
      restrictions: { completed_sessions: { limit: 1 } },
    },
    { idempotencyKey: `invoice-${invoice.id}-link` },
  );
  return { external_id: link.id, payment_url: link.url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return problem(405, "Method Not Allowed");

  const caller = await requireStaff(bearerToken(req));
  if (!caller) return problem(403, "Forbidden", "Solo Admin o Finance pueden timbrar o cobrar.");

  const { invoiceId } = (await req.json().catch(() => ({}))) as { invoiceId?: unknown };
  if (typeof invoiceId !== "string" || !UUID_RE.test(invoiceId)) {
    return problem(422, "Unprocessable Entity", "invoiceId debe ser un UUID.");
  }

  const admin = getAdminClient();
  const lockExpiredBefore = new Date(Date.now() - LOCK_TTL_MS).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("invoices")
    .update({ issuing_started_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("status", "Draft")
    .or(`issuing_started_at.is.null,issuing_started_at.lt.${lockExpiredBefore}`)
    .select("id, month, year, total_amount, currency, clients(*)")
    .maybeSingle();

  if (claimError) {
    console.error("claim failed", claimError);
    return problem(500, "Internal Server Error", "No se pudo bloquear la factura.");
  }
  if (!claimed) {
    const { data: existing } = await admin
      .from("invoices")
      .select("status")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!existing) return problem(404, "Not Found", "La factura no existe.");
    return problem(
      409,
      "Conflict",
      existing.status === "Draft"
        ? "La factura ya se está procesando."
        : `La factura ya está en estado ${existing.status}.`,
    );
  }

  const invoice = claimed as unknown as ClaimedInvoice;
  const release = () =>
    admin.from("invoices").update({ issuing_started_at: null }).eq("id", invoice.id);

  try {
    const { data: lineRows, error: linesError } = await admin
      .from("invoice_lines")
      .select("hours, hourly_rate, subtotal, projects(name)")
      .eq("invoice_id", invoice.id);
    if (linesError) throw linesError;

    const lines: InvoiceLine[] = (lineRows ?? []).map((row) => ({
      projectName: (row.projects as unknown as { name: string }).name,
      hours: Number(row.hours),
      hourlyRate: Number(row.hourly_rate),
      subtotal: Number(row.subtotal),
    }));
    if (lines.length === 0 || Number(invoice.total_amount) <= 0) {
      throw new IssueError(422, "La factura no tiene horas que cobrar.");
    }

    const result =
      invoice.currency === "MXN" ? await issueMxn(invoice, lines) : await issueUsd(invoice);

    const { data: updated, error: updateError } = await admin
      .from("invoices")
      .update({
        ...result,
        status: "Sent",
        sent_at: new Date().toISOString(),
        issuing_started_at: null,
      })
      .eq("id", invoice.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return json(updated);
  } catch (error) {
    await release();
    if (error instanceof IssueError)
      return problem(error.status, "Unprocessable Entity", error.message);
    console.error("issue-invoice failed", error);
    const detail = error instanceof Error ? error.message : "Error desconocido.";
    return problem(502, "Bad Gateway", `No se pudo timbrar o cobrar: ${detail}`);
  }
});
