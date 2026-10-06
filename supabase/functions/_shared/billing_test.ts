import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import { buildFacturamaCfdi, invoiceFolio, missingCfdiFields, toStripeAmount } from "./billing.ts";
import { FacturamaPac, PacError } from "./pac.ts";

const request = {
  folio: "202506-ABC123",
  periodLabel: "junio 2025",
  issuer: { rfc: "EKU9003173C9", legalName: "ESCUELA KEMPER URGATE", taxRegime: "601", postalCode: "42501" },
  receiver: {
    rfc: "GAN880411K92",
    name: "Grupo Andes",
    taxRegime: "601",
    postalCode: "01000",
    cfdiUse: "G03",
  },
  lines: [
    { projectName: "billing-core", hours: 3.53, hourlyRate: 125, subtotal: 441.25 },
    { projectName: "api-gateway", hours: 2, hourlyRate: 110, subtotal: 220 },
  ],
};

Deno.test("folio y montos de Stripe", () => {
  assertEquals(invoiceFolio({ id: "abc123ff-0000", year: 2025, month: 6 }), "202506-ABC123");
  assertEquals(toStripeAmount(4150), 415000);
  assertEquals(toStripeAmount(0.1 + 0.2), 30);
});

Deno.test("arma el CFDI 4.0 con IVA por concepto", () => {
  const cfdi = buildFacturamaCfdi(request);
  assertEquals(cfdi.PaymentMethod, "PPD");
  assertEquals(cfdi.PaymentForm, "99");
  assertEquals(cfdi.ExpeditionPlace, "42501");
  assertEquals(cfdi.Receiver, {
    Rfc: "GAN880411K92",
    Name: "GRUPO ANDES",
    CfdiUse: "G03",
    FiscalRegime: "601",
    TaxZipCode: "01000",
  });
  assertEquals(
    cfdi.Items.map((i) => [i.Subtotal, i.Taxes[0]!.Total, i.Total]),
    [
      [441.25, 70.6, 511.85],
      [220, 35.2, 255.2],
    ],
  );
});

Deno.test("detecta datos fiscales faltantes", () => {
  assertEquals(missingCfdiFields({ tax_regime: "601", fiscal_postal_code: null, cfdi_use: null }), [
    "código postal fiscal",
    "uso de CFDI",
  ]);
});

function fakeFetch(responses: Record<string, { status: number; body: unknown }>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, ...(init ? { init } : {}) });
    const key = Object.keys(responses).find((k) => url.endsWith(k));
    const res = key ? responses[key]! : { status: 404, body: {} };
    return Promise.resolve(new Response(JSON.stringify(res.body), { status: res.status }));
  }) as typeof fetch;
  return { fn, calls };
}

Deno.test("FacturamaPac timbra y descarga XML y PDF", async () => {
  const { fn, calls } = fakeFetch({
    "/api-lite/3/cfdis": {
      status: 201,
      body: { Id: "abc", Complement: { TaxStamp: { Uuid: "215CEC43-7E57-44AC-9D63-B54BBC4745BD" } } },
    },
    "/cfdi/xml/issuedLite/abc": { status: 200, body: { Content: btoa("<xml/>") } },
    "/cfdi/pdf/issuedLite/abc": { status: 200, body: { Content: btoa("%PDF") } },
  });

  const pac = new FacturamaPac("https://sandbox.test", "user", "pass", fn);
  const issued = await pac.issueCfdi(request);

  assertEquals(issued.uuid, "215CEC43-7E57-44AC-9D63-B54BBC4745BD");
  assertEquals(new TextDecoder().decode(issued.xml), "<xml/>");
  assertEquals(new TextDecoder().decode(issued.pdf), "%PDF");
  assertEquals(
    (calls[0]!.init!.headers as Record<string, string>).Authorization,
    `Basic ${btoa("user:pass")}`,
  );
});

Deno.test("FacturamaPac propaga el rechazo del PAC", async () => {
  const { fn } = fakeFetch({
    "/api-lite/3/cfdis": { status: 400, body: { Message: "RFC del receptor no válido" } },
  });
  const pac = new FacturamaPac("https://sandbox.test", "user", "pass", fn);
  await assertRejects(() => pac.issueCfdi(request), PacError, "RFC del receptor no válido");
});
