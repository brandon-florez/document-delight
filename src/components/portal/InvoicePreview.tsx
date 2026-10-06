import type { InvoiceStatus, InvoiceWithClient } from "@/lib/api/invoices";
import { useInvoiceLines } from "@/lib/api/invoices";
import { formatDateTime, formatMoney, invoiceLabel, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  Draft: "Borrador",
  Sent: "Enviada",
  Paid: "Pagada",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const classes =
    status === "Draft"
      ? "bg-clay-soft text-clay"
      : status === "Sent"
        ? "bg-amberc-soft text-amberc"
        : "bg-mint-soft text-mint";
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] font-medium", classes)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function InvoicePreview({
  invoice,
  compact = false,
}: {
  invoice: InvoiceWithClient;
  compact?: boolean;
}) {
  const { data: lines, isLoading } = useInvoiceLines(invoice.id);
  const client = invoice.clients;

  return (
    <div className={cn("rounded-2xl border border-line bg-background", compact ? "p-4" : "p-5")}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className={cn("font-mono font-bold", compact ? "text-xs" : "text-xl")}>Nexo</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            Servicios profesionales IT · {invoiceLabel(invoice)}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={invoice.status} />
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Periodo · {monthLabel(invoice.year, invoice.month)}
          </p>
        </div>
      </div>

      {!compact ? (
        <>
          <div className="my-6 h-px bg-line" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Cliente
              </p>
              <p className="mt-1 font-bold">{client?.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {client?.tax_id} · {client?.billing_email}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Método
              </p>
              <p className="mt-1 font-bold">
                {invoice.currency === "MXN" ? "SAT CFDI 4.0" : "Stripe Payment Link"}
              </p>
              {invoice.external_id ? (
                <p className="break-all font-mono text-[11px] text-muted-foreground">
                  {invoice.currency === "MXN" ? "UUID" : "Link"} · {invoice.external_id}
                </p>
              ) : null}
              {invoice.sent_at ? (
                <p className="font-mono text-[11px] text-muted-foreground">
                  Enviada · {formatDateTime(invoice.sent_at)}
                </p>
              ) : null}
              {invoice.paid_at ? (
                <p className="font-mono text-[11px] text-muted-foreground">
                  Pagada · {formatDateTime(invoice.paid_at)}
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <div
        className={cn("overflow-x-auto rounded-xl border border-line", compact ? "mt-3" : "mt-6")}
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-surface font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Proyecto</th>
              <th className="px-3 py-2.5 text-right font-medium">Horas</th>
              <th className="px-3 py-2.5 text-right font-medium">Tarifa</th>
              <th className="px-3 py-2.5 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-xs text-muted-foreground">
                  Cargando desglose…
                </td>
              </tr>
            ) : lines && lines.length > 0 ? (
              lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-3 font-mono text-xs">{line.projects?.name}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">
                    {line.hours.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs">
                    {formatMoney(line.hourly_rate, invoice.currency)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-bold">
                    {formatMoney(line.subtotal, invoice.currency)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-xs text-muted-foreground">
                  Sin líneas de factura.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className={cn(
          "flex items-center justify-between rounded-xl bg-surface",
          compact ? "mt-3 p-3" : "mt-6 p-4",
        )}
      >
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Total · {invoice.total_hours.toFixed(2)} h
          </span>
          {invoice.currency === "MXN" ? (
            <p className="font-mono text-[10px] text-muted-foreground">Antes de IVA (16%)</p>
          ) : null}
        </div>
        <span className={cn("font-mono font-bold", compact ? "text-sm" : "text-2xl")}>
          {formatMoney(invoice.total_amount, invoice.currency)}
        </span>
      </div>
    </div>
  );
}
