import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { InvoicePreview, StatusBadge } from "@/components/portal/InvoicePreview";
import {
  KpiCard,
  LiveSyncPill,
  Panel,
  PortalShell,
  SectionTitle,
  StateMessage,
} from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import {
  useDashboardKpis,
  useUnbilledThisMonth,
  useWeeklyHoursByRepository,
} from "@/lib/api/dashboard";
import { useGenerateInvoices, useInvoices } from "@/lib/api/invoices";
import {
  currentPeriod,
  currentWeek,
  formatDay,
  formatHours,
  formatMoney,
  invoiceLabel,
  monthLabel,
} from "@/lib/format";

const BAR_TONES = ["bg-clay", "bg-mint", "bg-amberc", "bg-viol", "bg-rosec"];

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard ejecutivo — Nexo IT·Fin" },
      {
        name: "description",
        content:
          "Métricas ejecutivas de facturación, horas pendientes, clientes activos y pre-facturas IT.",
      },
      { property: "og:title", content: "Dashboard ejecutivo — Nexo IT·Fin" },
      {
        property: "og:description",
        content:
          "Panel financiero para monitorear horas no facturadas y generar pre-facturas por cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function DashboardPage() {
  const period = currentPeriod();
  const week = currentWeek();
  const kpis = useDashboardKpis();
  const unbilled = useUnbilledThisMonth();
  const repositories = useWeeklyHoursByRepository();
  const invoices = useInvoices("all", 5);
  const generate = useGenerateInvoices();

  const k = kpis.data;
  const maxRepoHours = Math.max(1, ...(repositories.data ?? []).map((r) => r.hours));
  const previewInvoice = invoices.data?.find((i) => i.status === "Draft") ?? invoices.data?.[0];

  function handleGenerate() {
    generate.mutate(period, {
      onSuccess: (created) =>
        toast.success(
          created.length > 0
            ? `${created.length} pre-factura(s) generada(s) para ${monthLabel(period.year, period.month)}.`
            : "No hay tiempo pendiente de facturar este mes.",
        ),
      onError: (error) => toast.error(error.message),
    });
  }

  function handleExport() {
    const rows = unbilled.data ?? [];
    if (rows.length === 0) {
      toast.info("No hay tiempo sin facturar para exportar.");
      return;
    }
    downloadCsv(`tiempo-no-facturado-${period.year}-${String(period.month).padStart(2, "0")}.csv`, [
      ["Proyecto", "Cliente", "Moneda", "Horas", "Monto"],
      ...rows.map((r) => [
        r.project_name ?? "",
        r.client_name ?? "",
        r.currency ?? "",
        r.unbilled_hours ?? 0,
        r.unbilled_amount ?? 0,
      ]),
    ]);
  }

  return (
    <PortalShell
      active="/dashboard"
      title="Dashboard ejecutivo"
      subtitle={`Periodo · ${monthLabel(period.year, period.month)} · semana del ${formatDay(week.monday)}`}
      action={
        <Button variant="clay" size="sm" onClick={handleExport}>
          <Download />
          Exportar
        </Button>
      }
    >
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Facturación USD"
          value={kpis.isLoading ? "…" : formatMoney(k?.billed_usd, "USD")}
          detail="Enviadas y pagadas este mes"
        />
        <KpiCard
          label="Facturación MXN"
          value={kpis.isLoading ? "…" : formatMoney(k?.billed_mxn, "MXN")}
          detail="Enviadas y pagadas este mes"
          className="[animation-delay:60ms]"
        />
        <KpiCard
          label="Tiempo no facturado"
          value={kpis.isLoading ? "…" : formatHours(k?.unbilled_hours)}
          detail={`${k?.unbilled_projects ?? 0} proyecto(s) pendiente(s)`}
          tone="amber"
          className="[animation-delay:120ms]"
        />
        <KpiCard
          label="Clientes activos"
          value={kpis.isLoading ? "…" : String(k?.active_clients ?? 0)}
          detail={`${k?.draft_invoices ?? 0} borrador(es) por emitir`}
          tone="muted"
          className="[animation-delay:180ms]"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2 animate-[rise_0.5s_var(--ease)_both] [animation-delay:240ms]">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle
              title="Líneas de tiempo por repositorio"
              subtitle="Tiempo registrado · semana actual"
            />
            <LiveSyncPill scope="team" />
          </div>
          {repositories.isLoading ? (
            <StateMessage>Cargando horas…</StateMessage>
          ) : repositories.error ? (
            <StateMessage tone="error">No se pudieron cargar las horas.</StateMessage>
          ) : repositories.data && repositories.data.length > 0 ? (
            <div className="mt-5 space-y-3.5">
              {repositories.data.map((row, index) => (
                <div key={row.id}>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-foreground/80">{row.name}</span>
                    <span className="text-muted-foreground">{formatHours(row.hours)}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-background">
                    <div
                      className={`${BAR_TONES[index % BAR_TONES.length]} h-full rounded-full`}
                      style={{ width: `${(row.hours / maxRepoHours) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StateMessage>Aún no hay tiempo registrado esta semana.</StateMessage>
          )}
        </Panel>

        <Panel className="flex flex-col animate-[rise_0.5s_var(--ease)_both] [animation-delay:300ms]">
          <SectionTitle title="Tiempo no facturado" subtitle="Mes en curso · sin pre-factura" />
          <div className="mt-4 space-y-2.5">
            {unbilled.isLoading ? (
              <StateMessage>Cargando…</StateMessage>
            ) : unbilled.data && unbilled.data.length > 0 ? (
              unbilled.data.map((row) => (
                <div
                  key={row.project_id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-amberc-soft px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{row.project_name}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {row.client_name}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-bold text-amberc">
                    {formatHours(row.unbilled_hours)}
                  </span>
                </div>
              ))
            ) : (
              <StateMessage>Todo el tiempo del mes está facturado.</StateMessage>
            )}
          </div>
          <Button
            variant="clay"
            className="mt-auto"
            disabled={generate.isPending || !unbilled.data?.length}
            onClick={handleGenerate}
          >
            {generate.isPending ? <Loader2 className="animate-spin" /> : null}
            Generar Pre-Facturas
          </Button>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3 animate-[rise_0.5s_var(--ease)_both] [animation-delay:360ms]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="Facturas recientes" />
            <div className="flex gap-1.5">
              <span className="rounded-full bg-clay-soft px-2.5 py-1 font-mono text-[10px] font-medium text-clay">
                Borrador {k?.draft_invoices ?? 0}
              </span>
              <span className="rounded-full bg-amberc-soft px-2.5 py-1 font-mono text-[10px] font-medium text-amberc">
                Enviadas {k?.sent_invoices ?? 0}
              </span>
              <span className="rounded-full bg-mint-soft px-2.5 py-1 font-mono text-[10px] font-medium text-mint">
                Pagadas {k?.paid_invoices ?? 0}
              </span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-background font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Factura</th>
                  <th className="px-3 py-2.5 font-medium">Cliente</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                  <th className="px-3 py-2.5 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.data?.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-3 py-2.5 font-mono text-xs font-medium">
                      {invoiceLabel(invoice)}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{invoice.clients?.name}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                      {formatMoney(invoice.total_amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invoices.data?.length === 0 ? <StateMessage>Aún no hay facturas.</StateMessage> : null}
          </div>
        </Panel>

        <Panel className="lg:col-span-2 animate-[rise_0.5s_var(--ease)_both] [animation-delay:420ms]">
          <div className="flex items-center justify-between">
            <SectionTitle title="Vista previa" />
            {previewInvoice ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                {invoiceLabel(previewInvoice)}
              </span>
            ) : null}
          </div>
          <div className="mt-4">
            {previewInvoice ? (
              <InvoicePreview invoice={previewInvoice} compact />
            ) : (
              <StateMessage>Genera pre-facturas para verlas aquí.</StateMessage>
            )}
          </div>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/invoices">
              Ir a facturación
              <ArrowRight />
            </Link>
          </Button>
        </Panel>
      </section>
    </PortalShell>
  );
}
