import { buildFacturamaCfdi, type CfdiRequest } from "./billing.ts";

export type IssuedCfdi = {
  /** Folio fiscal (UUID) assigned by the SAT. */
  uuid: string;
  xml: Uint8Array;
  pdf: Uint8Array;
};

/** Any authorized PAC (Proveedor Autorizado de Certificación) that can stamp a CFDI 4.0. */
export interface PacProvider {
  issueCfdi(request: CfdiRequest): Promise<IssuedCfdi>;
}

export class PacError extends Error {}

function decodeBase64(content: string): Uint8Array {
  const binary = atob(content);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Facturama multi-issuer API (https://apisandbox.facturama.mx/docs-multi). */
export class FacturamaPac implements PacProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly user: string,
    private readonly password: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private get headers() {
    return {
      Authorization: `Basic ${btoa(`${this.user}:${this.password}`)}`,
      "Content-Type": "application/json",
    };
  }

  private async download(format: "xml" | "pdf", id: string): Promise<Uint8Array> {
    const res = await this.fetchFn(`${this.baseUrl}/cfdi/${format}/issuedLite/${id}`, {
      headers: this.headers,
    });
    if (!res.ok)
      throw new PacError(`Facturama no devolvió el ${format.toUpperCase()} (${res.status}).`);
    const file = (await res.json()) as { Content: string };
    return decodeBase64(file.Content);
  }

  async issueCfdi(request: CfdiRequest): Promise<IssuedCfdi> {
    const res = await this.fetchFn(`${this.baseUrl}/api-lite/3/cfdis`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(buildFacturamaCfdi(request)),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = (body as { Message?: string; ModelState?: unknown }).Message ?? res.statusText;
      const modelState = (body as { ModelState?: unknown }).ModelState;
      throw new PacError(
        `Facturama rechazó el CFDI: ${detail}${modelState ? ` ${JSON.stringify(modelState)}` : ""}`,
      );
    }

    const { Id: id, Complement } = body as {
      Id: string;
      Complement?: { TaxStamp?: { Uuid?: string } };
    };
    const uuid = Complement?.TaxStamp?.Uuid;
    if (!id || !uuid) throw new PacError("Facturama no devolvió el folio fiscal (UUID).");

    const [xml, pdf] = await Promise.all([this.download("xml", id), this.download("pdf", id)]);
    return { uuid, xml, pdf };
  }
}

export function pacFromEnv(): PacProvider {
  const baseUrl = Deno.env.get("PAC_BASE_URL") ?? "https://apisandbox.facturama.mx";
  const user = Deno.env.get("PAC_USER");
  const password = Deno.env.get("PAC_PASSWORD");
  if (!user || !password) throw new PacError("Faltan los secretos PAC_USER / PAC_PASSWORD.");
  return new FacturamaPac(baseUrl.replace(/\/$/, ""), user, password);
}
