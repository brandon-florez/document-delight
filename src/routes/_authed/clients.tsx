import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Pagination,
  Panel,
  PortalShell,
  SearchField,
  SectionTitle,
  StateMessage,
  StatusDot,
} from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useClients,
  useCreateClient,
  useSetClientActive,
  useUpdateClient,
  type ClientFilters,
} from "@/lib/api/clients";
import { PAGE_SIZE } from "@/lib/api/utils";

const RFC_RE = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

const clientSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio."),
    tax_id: z.string().trim().toUpperCase().regex(RFC_RE, "RFC inválido (12 o 13 caracteres)."),
    currency: z.enum(["USD", "MXN"]),
    billing_email: z.string().trim().email("Correo inválido."),
    tax_regime: z.string().trim(),
    fiscal_postal_code: z.string().trim(),
    cfdi_use: z.string().trim().toUpperCase(),
  })
  .superRefine((values, ctx) => {
    if (values.currency !== "MXN") return;
    if (!/^[0-9]{3}$/.test(values.tax_regime)) {
      ctx.addIssue({ path: ["tax_regime"], code: "custom", message: "3 dígitos, ej. 601." });
    }
    if (!/^[0-9]{5}$/.test(values.fiscal_postal_code)) {
      ctx.addIssue({ path: ["fiscal_postal_code"], code: "custom", message: "5 dígitos." });
    }
    if (!/^[A-Z]{1,2}[0-9]{2}$/.test(values.cfdi_use)) {
      ctx.addIssue({ path: ["cfdi_use"], code: "custom", message: "Clave SAT, ej. G03." });
    }
  });

type ClientForm = z.input<typeof clientSchema>;

type EditableClient = {
  id: string;
  name: string;
  tax_id: string;
  currency: "USD" | "MXN";
  billing_email: string;
  tax_regime: string | null;
  fiscal_postal_code: string | null;
  cfdi_use: string | null;
};

const EMPTY_FORM: ClientForm = {
  name: "",
  tax_id: "",
  currency: "USD",
  billing_email: "",
  tax_regime: "",
  fiscal_postal_code: "",
  cfdi_use: "G03",
};

export const Route = createFileRoute("/_authed/clients")({
  head: () => ({
    meta: [
      { title: "Clientes — Nexo IT·Fin" },
      {
        name: "description",
        content: "Gestión de clientes con RFC, moneda de facturación, correo y estado operativo.",
      },
      { property: "og:title", content: "Clientes — Nexo IT·Fin" },
      {
        property: "og:description",
        content: "Tabla de clientes para administrar facturación USD y MXN en el portal IT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientsPage,
});

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs text-rosec">{message}</p> : null;
}

function clientValues(client: EditableClient | null): ClientForm {
  if (!client) return EMPTY_FORM;
  return {
    name: client.name,
    tax_id: client.tax_id,
    currency: client.currency,
    billing_email: client.billing_email,
    tax_regime: client.tax_regime ?? "",
    fiscal_postal_code: client.fiscal_postal_code ?? "",
    cfdi_use: client.cfdi_use ?? "G03",
  };
}

function ClientDialog({
  client,
  open,
  onOpenChange,
}: {
  client: EditableClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const form = useForm<ClientForm, unknown, z.output<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: EMPTY_FORM,
  });
  const currency = form.watch("currency");
  const { errors } = form.formState;
  const pending = createClient.isPending || updateClient.isPending;

  useEffect(() => {
    if (open) form.reset(clientValues(client));
  }, [open, client, form]);

  const onSubmit = form.handleSubmit((values) => {
    const isMxn = values.currency === "MXN";
    const payload = {
      name: values.name,
      tax_id: values.tax_id,
      currency: values.currency,
      billing_email: values.billing_email,
      tax_regime: isMxn ? values.tax_regime : null,
      fiscal_postal_code: isMxn ? values.fiscal_postal_code : null,
      cfdi_use: isMxn ? values.cfdi_use : null,
    };
    const done = {
      onSuccess: () => {
        toast.success(client ? `Cliente ${values.name} actualizado.` : `Cliente ${values.name} creado.`);
        onOpenChange(false);
      },
      onError: (error: Error) => toast.error(error.message),
    };
    if (client) updateClient.mutate({ id: client.id, values: payload }, done);
    else createClient.mutate(payload, done);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Nuevo Cliente"}</DialogTitle>
          <DialogDescription>
            {client
              ? "Las facturas ya emitidas conservan la moneda con la que se crearon."
              : "Captura los datos requeridos para facturación."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 py-2" onSubmit={(event) => void onSubmit(event)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="client-name">Nombre o razón social</Label>
            <Input id="client-name" placeholder="Norte Digital" {...form.register("name")} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-id">RFC</Label>
              <Input
                id="tax-id"
                placeholder="NDI940101H12"
                className="uppercase"
                {...form.register("tax_id")}
              />
              <FieldError message={errors.tax_id?.message} />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD · Stripe</SelectItem>
                      <SelectItem value="MXN">MXN · CFDI 4.0</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-email">Correo de facturación</Label>
            <Input
              id="billing-email"
              type="email"
              placeholder="billing@cliente.com"
              {...form.register("billing_email")}
            />
            <FieldError message={errors.billing_email?.message} />
          </div>
          {currency === "MXN" ? (
            <div className="grid gap-4 rounded-xl bg-background p-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tax-regime">Régimen fiscal</Label>
                <Input id="tax-regime" placeholder="601" {...form.register("tax_regime")} />
                <FieldError message={errors.tax_regime?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal-code">C.P. fiscal</Label>
                <Input
                  id="postal-code"
                  placeholder="06600"
                  {...form.register("fiscal_postal_code")}
                />
                <FieldError message={errors.fiscal_postal_code?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfdi-use">Uso CFDI</Label>
                <Input
                  id="cfdi-use"
                  placeholder="G03"
                  className="uppercase"
                  {...form.register("cfdi_use")}
                />
                <FieldError message={errors.cfdi_use?.message} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" variant="clay" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Guardar cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientsPage() {
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState<ClientFilters["currency"]>("all");
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditableClient | null>(null);
  const deferredSearch = useDeferredValue(search);
  const clients = useClients({ search: deferredSearch, currency, page });
  const setActive = useSetClientActive();

  return (
    <PortalShell
      active="/clients"
      title="Clientes"
      subtitle="Directorio fiscal y moneda de cobro"
      action={
        <Button variant="clay" size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Nuevo Cliente
        </Button>
      }
    >
      <ClientDialog client={null} open={creating} onOpenChange={setCreating} />
      <ClientDialog
        client={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
      <Panel className="mb-16 md:mb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Gestión de Clientes" subtitle="Paginación, búsqueda y filtros" />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SearchField
              placeholder="Buscar por nombre o RFC"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(0);
              }}
            />
            <Select
              value={currency}
              onValueChange={(value) => {
                setCurrency(value as ClientFilters["currency"]);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las monedas</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="MXN">MXN</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-background font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Cliente</th>
                <th className="px-3 py-2.5 font-medium">RFC</th>
                <th className="px-3 py-2.5 font-medium">Moneda</th>
                <th className="px-3 py-2.5 font-medium">Billing Email</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clients.data?.rows.map((client) => (
                <tr key={client.id} className="hover:bg-clay-soft/40">
                  <td className="px-3 py-3 text-xs font-bold">{client.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                    {client.tax_id}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-clay-soft px-2 py-0.5 font-mono text-[10px] font-medium text-clay">
                      {client.currency}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                    {client.billing_email}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <StatusDot tone={client.is_active ? "accent" : "amber"} />
                      {client.is_active ? "Activo" : "En pausa"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(client)}>
                        <Pencil />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setActive.isPending}
                        onClick={() =>
                          setActive.mutate(
                            { id: client.id, isActive: !client.is_active },
                            { onError: (error) => toast.error(error.message) },
                          )
                        }
                      >
                        {client.is_active ? "Pausar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clients.isLoading ? <StateMessage>Cargando clientes…</StateMessage> : null}
          {clients.error ? (
            <StateMessage tone="error">No se pudieron cargar los clientes.</StateMessage>
          ) : null}
          {clients.data?.rows.length === 0 ? (
            <StateMessage>No hay clientes que coincidan.</StateMessage>
          ) : null}
        </div>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={clients.data?.total ?? 0}
          onPageChange={setPage}
        />
      </Panel>
    </PortalShell>
  );
}
