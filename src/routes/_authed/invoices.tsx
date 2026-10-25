import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Calculator,
  CreditCard,
  ExternalLink,
  FileCode2,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { InvoicePreview, StatusBadge } from "@/components/portal/InvoicePreview";
import {
  Pagination,
  Panel,
  PortalShell,
  SearchField,
  SectionTitle,
  StateMessage,
} from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  openInvoiceFile,
  useGenerateInvoices,
  useInvoicePage,
  useIssueInvoice,
  useMarkInvoicePaid,
  useReopenInvoice,
  type InvoiceStatus,
  type InvoiceWithClient,
} from "@/lib/api/invoices";
import { PAGE_SIZE } from "@/lib/api/utils";
import { currentPeriod, formatMoney, invoiceLabel, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TABS: { value: "all" | InvoiceStatus; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "Draft", label: "Borrador" },
  { value: "Sent", label: "Enviadas" },
  { value: "Paid", label: "Pagadas" },
];

export const Route = createFileRoute("/_authed/invoices")({
  head: () => ({
    meta: [
      { title: "Facturación — Nexo IT·Fin" },
      {
        name: "description",
        content:
          "Módulo de facturación con cierre mensual, borradores, estado de cobro y vista previa.",
      },
      { property: "og:title", content: "Facturación — Nexo IT·Fin" },
      {
        property: "og:description",
        content:
          "Genera cierres, revisa facturas y dispara timbrado o cobro desde una vista dividida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvoicesPage,
});

function GenerateClosingDialog() {
  const now = currentPeriod();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(String(now.month));
  const [year, setYear] = useState(String(now.year));
  const generate = useGenerateInvoices();

  function handleGenerate() {
    const period = { year: Number(year), month: Number(month) };
    generate.mutate(period, {
      onSuccess: (created) => {
        toast.success(
          created.length > 0
            ? `${created.length} borrador(es) generado(s) para ${monthLabel(period.year, period.month)}.`
            : "No hay tiempo pendiente de facturar en ese periodo.",
        );
        setOpen(false);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="clay" size="sm">
          <Calculator />
          Generar Cierre
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar cierre mensual</DialogTitle>
          <DialogDescription>
            Agrupa el tiempo sin facturar del periodo por cliente, lo multiplica por la tarifa de
            cada proyecto y crea (o actualiza) los borradores.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label>Mes</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {monthLabel(2000, i + 1).replace(" 2000", "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Año</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[now.year - 1, now.year].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="clay" disabled={generate.isPending} onClick={handleGenerate}>
            {generate.isPending ? <Loader2 className="animate-spin" /> : null}
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReopenInvoiceButton({ invoice }: { invoice: InvoiceWithClient }) {
  const [open, setOpen] = useState(false);
  const reopen = useReopenInvoice();

  function handleReopen() {
    reopen.mutate(invoice.id, {
      onSuccess: () => {
        toast.success("Factura reabierta. Genera el cierre del mes para incluir las horas nuevas.");
        setOpen(false);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  if (invoice.status === "Draft") return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw />
          Reabrir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir factura</DialogTitle>
          <DialogDescription>
            Vuelve a borrador. Se quitan el timbre, el enlace de pago y la marca de pagada. Después
            puedes generar el cierre para sumar horas nuevas y timbrar o cobrar otra vez.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="clay" disabled={reopen.isPending} onClick={handleReopen}>
            {reopen.isPending ? <Loader2 className="animate-spin" /> : null}
            Reabrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoicesPage() {
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const invoices = useInvoicePage({ status, search: deferredSearch, page });
  const rows = invoices.data?.rows ?? [];
  const issue = useIssueInvoice();
  const markPaid = useMarkInvoicePaid();

  const selected = rows.find((i) => i.id === selectedId) ?? rows[0];

  function handleIssue() {
    if (!selected) return;
    issue.mutate(selected.id, {
      onSuccess: () =>
        toast.success(
          selected.currency === "MXN"
            ? "CFDI timbrado. La factura pasó a Enviada."
            : "Payment Link creado. La factura pasó a Enviada.",
        ),
      onError: (error) => toast.error(error.message),
    });
  }

  function handleMarkPaid() {
    if (!selected) return;
    markPaid.mutate(selected.id, {
      onSuccess: () => toast.success("Factura marcada como pagada."),
      onError: (error) => toast.error(error.message),
    });
  }

  function handleOpenFile(path: string) {
    openInvoiceFile(path).catch((error: Error) => toast.error(error.message));
  }

  return (
    <PortalShell
      active="/invoices"
      title="Facturación"
      subtitle="Cierre mensual · Borrador, Enviada y Pagada"
      action={<GenerateClosingDialog />}
    >
      <section className="grid gap-4 lg:grid-cols-[390px_1fr]">
        <Panel className="mb-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="Facturas" subtitle="Selecciona un documento" />
            <div className="flex rounded-xl bg-background p-1 font-mono text-[10px]">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setStatus(tab.value);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-lg px-2 py-1",
                    status === tab.value ? "bg-clay-soft text-clay" : "text-muted-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <SearchField
              placeholder="Buscar cliente o RFC"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(0);
              }}
            />
          </div>

          <div className="mt-4 space-y-2.5">
            {invoices.isLoading ? <StateMessage>Cargando facturas…</StateMessage> : null}
            {rows.length === 0 ? (
              <StateMessage>No hay facturas que coincidan.</StateMessage>
            ) : null}
            {rows.map((invoice) => (
              <Button
                key={invoice.id}
                type="button"
                variant="outline"
                onClick={() => setSelectedId(invoice.id)}
                className={cn(
                  "block h-auto w-full rounded-xl p-3 text-left whitespace-normal",
                  selected?.id === invoice.id
                    ? "border-clay bg-clay-soft/70"
                    : "border-line bg-background hover:bg-clay-soft/40",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-bold">{invoiceLabel(invoice)}</span>
                  <StatusBadge status={invoice.status} />
                </div>
                <p className="mt-1 text-sm font-medium">{invoice.clients?.name}</p>
                <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>
                    {monthLabel(invoice.year, invoice.month)} ·{" "}
                    {invoice.currency === "MXN" ? "SAT CFDI 4.0" : "Stripe Link"}
                  </span>
                  <span className="font-bold text-foreground">
                    {formatMoney(invoice.total_amount, invoice.currency)}
                  </span>
                </div>
              </Button>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={invoices.data?.total ?? 0}
            onPageChange={setPage}
          />
        </Panel>

        <Panel className="mb-16 md:mb-0">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle
                  title="Vista previa del documento"
                  subtitle={`${invoiceLabel(selected)} · ${selected.currency}`}
                />
                <div className="flex flex-wrap gap-2">
                  {selected.xml_path ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenFile(selected.xml_path!)}
                    >
                      <FileCode2 />
                      XML
                    </Button>
                  ) : null}
                  {selected.pdf_path ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenFile(selected.pdf_path!)}
                    >
                      <FileText />
                      PDF
                    </Button>
                  ) : null}
                  {selected.payment_url ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={selected.payment_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        Enlace de pago
                      </a>
                    </Button>
                  ) : null}
                  <ReopenInvoiceButton invoice={selected} />
                  {selected.status === "Sent" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={markPaid.isPending}
                      onClick={handleMarkPaid}
                    >
                      <BadgeCheck />
                      Marcar pagada
                    </Button>
                  ) : null}
                  {selected.status === "Draft" ? (
                    <Button
                      variant="clay"
                      size="sm"
                      disabled={issue.isPending}
                      onClick={handleIssue}
                    >
                      {issue.isPending ? <Loader2 className="animate-spin" /> : <CreditCard />}
                      Timbrar / Cobrar
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-5">
                <InvoicePreview invoice={selected} />
              </div>
            </>
          ) : (
            <StateMessage>
              Selecciona una factura o usa "Generar Cierre" para crear los borradores del mes.
            </StateMessage>
          )}
        </Panel>
      </section>
    </PortalShell>
  );
}
