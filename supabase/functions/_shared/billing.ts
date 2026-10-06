// Pure billing helpers shared by issue-invoice and its tests (no I/O here).

export type InvoiceLine = {
  projectName: string;
  hours: number;
  hourlyRate: number;
  subtotal: number;
};

export type CfdiIssuer = { rfc: string; legalName: string; taxRegime: string; postalCode: string };

export type CfdiReceiver = {
  rfc: string;
  name: string;
  taxRegime: string;
  postalCode: string;
  cfdiUse: string;
};

export type CfdiRequest = {
  folio: string;
  issuer: CfdiIssuer;
  receiver: CfdiReceiver;
  lines: InvoiceLine[];
  periodLabel: string;
};

export const IVA_RATE = 0.16;
// SAT catalogs: 81111500 "Ingeniería de software o hardware", HUR "Hora".
const PRODUCT_CODE = "81111500";
const UNIT_CODE = "HUR";

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Short human-readable folio derived from the invoice period and id. */
export function invoiceFolio(invoice: { id: string; year: number; month: number }): string {
  return `${invoice.year}${String(invoice.month).padStart(2, "0")}-${invoice.id.slice(0, 6).toUpperCase()}`;
}

/** Stripe amounts are integers in the smallest currency unit. */
export function toStripeAmount(total: number): number {
  return Math.round(round2(total) * 100);
}

/**
 * Builds a Facturama multi-issuer CFDI 4.0 payload (Ingreso, PPD / forma de pago 99,
 * since the client pays after receiving the invoice). Adds 16% IVA per line.
 */
export function buildFacturamaCfdi(req: CfdiRequest) {
  const items = req.lines.map((line) => {
    const subtotal = round2(line.hours * line.hourlyRate);
    const iva = round2(subtotal * IVA_RATE);
    return {
      ProductCode: PRODUCT_CODE,
      Description: `Servicios de desarrollo de software - ${line.projectName} (${req.periodLabel})`,
      Unit: "Hora",
      UnitCode: UNIT_CODE,
      Quantity: line.hours,
      UnitPrice: line.hourlyRate,
      Subtotal: subtotal,
      TaxObject: "02",
      Taxes: [{ Total: iva, Name: "IVA", Base: subtotal, Rate: IVA_RATE, IsRetention: false }],
      Total: round2(subtotal + iva),
    };
  });

  return {
    CfdiType: "I",
    PaymentForm: "99",
    PaymentMethod: "PPD",
    Currency: "MXN",
    ExpeditionPlace: req.issuer.postalCode,
    Folio: req.folio,
    Issuer: { Rfc: req.issuer.rfc, Name: req.issuer.legalName, FiscalRegime: req.issuer.taxRegime },
    Receiver: {
      Rfc: req.receiver.rfc,
      Name: req.receiver.name.toUpperCase(),
      CfdiUse: req.receiver.cfdiUse,
      FiscalRegime: req.receiver.taxRegime,
      TaxZipCode: req.receiver.postalCode,
    },
    Items: items,
  };
}

/** Returns the missing CFDI receiver fields of a client, in Spanish, for error messages. */
export function missingCfdiFields(client: {
  tax_regime: string | null;
  fiscal_postal_code: string | null;
  cfdi_use: string | null;
}): string[] {
  const missing: string[] = [];
  if (!client.tax_regime) missing.push("régimen fiscal");
  if (!client.fiscal_postal_code) missing.push("código postal fiscal");
  if (!client.cfdi_use) missing.push("uso de CFDI");
  return missing;
}
