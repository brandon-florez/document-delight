import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Code2, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  LiveSyncPill,
  Panel,
  PortalShell,
  SectionTitle,
  StateMessage,
} from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateToken,
  useMyTimeEntries,
  useMyTokens,
  useMyWeek,
  useRevokeToken,
} from "@/lib/api/timeEntries";
import { useCurrentProfile } from "@/lib/auth";
import {
  currentWeek,
  formatDateTime,
  formatDay,
  formatHours,
  formatMinutes,
  formatTime,
  formatWorkedTime,
} from "@/lib/format";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const Route = createFileRoute("/_authed/my-time")({
  head: () => ({
    meta: [
      { title: "Mi tiempo — Nexo IT·Fin" },
      {
        name: "description",
        content: "Panel de desarrollador con horas semanales y registros automáticos por proyecto.",
      },
      { property: "og:title", content: "Mi tiempo — Nexo IT·Fin" },
      {
        property: "og:description",
        content:
          "Vista de horas registradas automáticamente por telemetría del IDE, sin cronómetro manual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyTimePage,
});

function MyTimePage() {
  const { data: profile } = useCurrentProfile();
  const week = useMyWeek();
  const entries = useMyTimeEntries(profile?.id);
  const { monday } = currentWeek();

  const weekdays = [...(week.data ?? [])].sort((a, b) =>
    (a.entry_date ?? "").localeCompare(b.entry_date ?? ""),
  );
  const weekTotal = weekdays.reduce((sum, d) => sum + (d.total_hours ?? 0), 0);
  const maxDay = Math.max(...weekdays.map((d) => d.total_hours ?? 0), 0);

  const mainProject = useMemo(() => {
    const totals = new Map<string, { name: string; repo: string; minutes: number }>();
    for (const entry of entries.data ?? []) {
      if (entry.entry_date < monday || !entry.projects) continue;
      const current = totals.get(entry.projects.name) ?? {
        name: entry.projects.name,
        repo: entry.projects.repository_url,
        minutes: 0,
      };
      current.minutes += entry.total_minutes ?? 0;
      totals.set(entry.projects.name, current);
    }
    return [...totals.values()].sort((a, b) => b.minutes - a.minutes)[0];
  }, [entries.data, monday]);

  const firstName = profile?.name.split(" ")[0] ?? "";

  return (
    <PortalShell
      active="/my-time"
      title="Mi tiempo"
      subtitle={`${profile?.role ?? ""} · Semana del ${formatDay(monday)}`}
    >
      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel className="animate-[rise_0.5s_var(--ease)_both]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-clay">
                Hola, {firstName}
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">
                {formatWorkedTime(weekTotal)}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                El registro se alimenta automáticamente desde la actividad del IDE y se asigna por
                URL de repositorio.
              </p>
            </div>
            <LiveSyncPill />
          </div>
        </Panel>

        <Panel className="animate-[rise_0.5s_var(--ease)_both] [animation-delay:80ms]">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-mint-soft text-mint">
              <Code2 className="size-5" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Proyecto principal
              </p>
              <p className="text-sm font-bold">
                {mainProject?.name ?? "Sin actividad esta semana"}
              </p>
            </div>
          </div>
          {mainProject ? (
            <div className="mt-4 break-all rounded-xl bg-background p-3 font-mono text-[11px] text-muted-foreground">
              {mainProject.repo}
            </div>
          ) : null}
        </Panel>
      </section>

      <Panel className="animate-[rise_0.5s_var(--ease)_both] [animation-delay:160ms]">
        <div className="flex items-center justify-between">
          <SectionTitle title="Actividad por día" subtitle="Lunes a domingo · tiempo efectivo" />
          <div className="flex items-center gap-2 rounded-xl border border-line bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground">
            <CalendarDays className="size-4" /> {formatDay(monday)}
          </div>
        </div>
        {week.isLoading ? (
          <StateMessage>Cargando actividad…</StateMessage>
        ) : (
          <div className="mt-6 flex h-64 items-end gap-3 sm:gap-5">
            {weekdays.map((day) => {
              const hours = day.total_hours ?? 0;
              return (
                <div
                  key={day.entry_date}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatHours(hours)}
                  </span>
                  <div className="flex h-48 w-full items-end rounded-xl bg-background p-1.5">
                    <div
                      className="w-full origin-bottom rounded-lg bg-clay animate-[grow_0.65s_var(--ease)_both]"
                      style={{ height: maxDay > 0 ? `${(hours / maxDay) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-medium text-muted-foreground">
                    {WEEKDAYS[(day.iso_day ?? 1) - 1]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel className="animate-[rise_0.5s_var(--ease)_both] [animation-delay:240ms]">
        <SectionTitle title="Time Log" subtitle="Solo lectura · alimentado por telemetría" />
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-background font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Fecha</th>
                <th className="px-3 py-2.5 font-medium">Proyecto</th>
                <th className="px-3 py-2.5 font-medium">Hora Inicio</th>
                <th className="px-3 py-2.5 font-medium">Hora Fin</th>
                <th className="px-3 py-2.5 text-right font-medium">Actividad</th>
                <th className="px-3 py-2.5 text-right font-medium">Tiempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.data?.map((entry) => (
                <tr key={entry.id} className="hover:bg-clay-soft/40">
                  <td className="px-3 py-3 font-mono text-xs">{formatDay(entry.entry_date)}</td>
                  <td className="px-3 py-3 text-xs font-medium">{entry.projects?.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                    {formatTime(entry.start_time)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                    {formatTime(entry.end_time)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground">
                    {entry.activity_score}%
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-bold">
                    {formatMinutes(entry.total_minutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.isLoading ? <StateMessage>Cargando registros…</StateMessage> : null}
          {entries.data?.length === 0 ? (
            <StateMessage>
              Aún no hay registros. Conecta tu IDE con un token para empezar.
            </StateMessage>
          ) : null}
        </div>
      </Panel>

      <IdeTokensPanel userId={profile?.id} />
    </PortalShell>
  );
}

function IdeTokensPanel({ userId }: { userId: string | undefined }) {
  const tokens = useMyTokens(userId);
  const createToken = useCreateToken();
  const revokeToken = useRevokeToken();
  const [name, setName] = useState("VS Code");
  const [newToken, setNewToken] = useState<string | null>(null);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createToken.mutate(name, {
      onSuccess: (created) => setNewToken(created.token),
      onError: (error) => toast.error(error.message),
    });
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    toast.success("Token copiado.");
  }

  return (
    <Panel className="mb-16 animate-[rise_0.5s_var(--ease)_both] [animation-delay:320ms] md:mb-0">
      <SectionTitle
        title="Conexión del IDE"
        subtitle="Token personal que la extensión usa para enviar heartbeats"
      />

      <form className="mt-4 flex flex-wrap items-center gap-2" onSubmit={handleCreate}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre del equipo o IDE"
          className="h-9 w-64 max-w-full"
          aria-label="Nombre del token"
        />
        <Button type="submit" variant="clay" size="sm" disabled={createToken.isPending}>
          {createToken.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Generar token
        </Button>
      </form>

      {newToken ? (
        <div className="mt-4 rounded-xl border border-amberc/30 bg-amberc-soft p-3">
          <p className="text-xs font-medium">Copia este token ahora: no se volverá a mostrar.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-surface px-2 py-1.5 font-mono text-[11px]">
              {newToken}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copiar token"
              onClick={() => void copyToken()}
            >
              <Copy />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {tokens.data?.map((token) => (
          <div
            key={token.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-background px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{token.name}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {token.token_prefix}… ·{" "}
                {token.last_used_at
                  ? `último uso ${formatDateTime(token.last_used_at)}`
                  : "sin usar"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Revocar token"
              disabled={revokeToken.isPending}
              onClick={() =>
                revokeToken.mutate(token.id, {
                  onSuccess: () => toast.success("Token revocado."),
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {tokens.data?.length === 0 ? <StateMessage>No tienes tokens activos.</StateMessage> : null}
      </div>
    </Panel>
  );
}
