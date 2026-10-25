import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Panel, PortalShell, SectionTitle, StateMessage } from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanySettings, useSaveCompanySettings } from "@/lib/api/company";
import { formatDateTime } from "@/lib/format";

const RFC_RE = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

const companySchema = z.object({
  legal_name: z.string().trim().min(1, "La razón social es obligatoria."),
  rfc: z.string().trim().toUpperCase().regex(RFC_RE, "RFC inválido (12 o 13 caracteres)."),
  tax_regime: z.string().trim().regex(/^[0-9]{3}$/, "3 dígitos, ej. 601."),
  postal_code: z.string().trim().regex(/^[0-9]{5}$/, "5 dígitos."),
});

type CompanyForm = z.input<typeof companySchema>;

const EMPTY_FORM: CompanyForm = {
  legal_name: "",
  rfc: "",
  tax_regime: "",
  postal_code: "",
};

export const Route = createFileRoute("/_authed/company")({
  head: () => ({
    meta: [
      { title: "Emisor — Nexo IT·Fin" },
      {
        name: "description",
        content: "Datos fiscales del emisor para timbrar CFDI 4.0.",
      },
    ],
  }),
  component: CompanyPage,
});

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs text-rosec">{message}</p> : null;
}

function CompanyPage() {
  const settings = useCompanySettings();
  const save = useSaveCompanySettings();
  const form = useForm<CompanyForm, unknown, z.output<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: EMPTY_FORM,
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (!settings.data) return;
    form.reset({
      legal_name: settings.data.legal_name,
      rfc: settings.data.rfc,
      tax_regime: settings.data.tax_regime,
      postal_code: settings.data.postal_code,
    });
  }, [settings.data, form]);

  const onSubmit = form.handleSubmit((values) => {
    save.mutate(values, {
      onSuccess: () => toast.success("Datos del emisor guardados."),
      onError: (error) => toast.error(error.message),
    });
  });

  return (
    <PortalShell
      active="/company"
      title="Emisor"
      subtitle="Datos fiscales con los que se timbra el CFDI"
    >
      <Panel className="mb-16 max-w-2xl md:mb-0">
        <SectionTitle
          title="Empresa emisora"
          subtitle="Solo un administrador puede modificar estos datos"
        />
        {settings.isLoading ? <StateMessage>Cargando datos del emisor…</StateMessage> : null}
        {settings.error ? (
          <StateMessage tone="error">No se pudieron cargar los datos del emisor.</StateMessage>
        ) : null}
        {settings.isSuccess ? (
          <form className="mt-5 grid gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="legal-name">Razón social</Label>
              <Input id="legal-name" {...form.register("legal_name")} />
              <FieldError message={errors.legal_name?.message} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="issuer-rfc">RFC</Label>
                <Input id="issuer-rfc" className="uppercase" {...form.register("rfc")} />
                <FieldError message={errors.rfc?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuer-regime">Régimen fiscal</Label>
                <Input id="issuer-regime" placeholder="601" {...form.register("tax_regime")} />
                <FieldError message={errors.tax_regime?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuer-cp">Código postal</Label>
                <Input id="issuer-cp" placeholder="22000" {...form.register("postal_code")} />
                <FieldError message={errors.postal_code?.message} />
              </div>
            </div>
            {settings.data?.updated_at ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                Última actualización · {formatDateTime(settings.data.updated_at)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Aún no hay datos del emisor. Sin ellos no se puede timbrar en pesos.
              </p>
            )}
            <div>
              <Button type="submit" variant="clay" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : null}
                Guardar emisor
              </Button>
            </div>
          </form>
        ) : null}
      </Panel>
    </PortalShell>
  );
}
