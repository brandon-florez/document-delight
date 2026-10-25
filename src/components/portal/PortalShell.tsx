import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Clock3,
  FileText,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  Search,
  UsersRound,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { liveStatusLabel, useLiveActivity } from "@/lib/api/telemetry";
import { canAccess, homeForRole, signOut, useCurrentProfile, type PortalPath } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  to: PortalPath;
  icon: LucideIcon;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const navItems: NavItem[] = [
  { label: "Dashboard ejecutivo", to: "/dashboard", icon: LayoutDashboard },
  { label: "Mi tiempo", to: "/my-time", icon: Clock3 },
  { label: "Clientes", to: "/clients", icon: UsersRound },
  { label: "Proyectos", to: "/projects", icon: FolderGit2 },
  { label: "Facturación", to: "/invoices", icon: FileText },
  { label: "Emisor", to: "/company", icon: Building2 },
];

export function PortalShell({
  active,
  title,
  subtitle,
  children,
  action,
}: {
  active: NavItem["to"];
  title: string;
  subtitle: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { data: profile } = useCurrentProfile();
  const teamTelemetry = profile?.role !== "Developer";
  const live = useLiveActivity(teamTelemetry ? "team" : "self");
  const liveLabel = liveStatusLabel(live.status, live.sessions, teamTelemetry);
  const liveDetail = live.sessions
    .map((session) => `${session.userName} · ${session.projectName} · ${formatTime(session.endTime)}`)
    .join("\n");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const visibleItems = profile ? navItems.filter((item) => canAccess(profile.role, item.to)) : [];
  const home = profile ? homeForRole(profile.role) : "/my-time";

  async function handleSignOut() {
    await signOut(queryClient);
    await navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface/80 px-4 py-5 md:flex">
          <Link to={home} className="flex items-center gap-2.5 px-2">
            <div className="grid size-9 place-items-center rounded-xl bg-clay text-primary-foreground shadow-[var(--shadow-clay)]">
              <span className="font-mono text-sm font-bold">N</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">Nexo</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Portal IT·Fin
              </p>
            </div>
          </Link>

          <nav className="mt-7 space-y-1">
            <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Espacio
            </p>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.to === active;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-clay-soft font-semibold text-clay ring-1 ring-clay/15"
                      : "font-medium text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-2xl bg-clay-soft p-3 ring-1 ring-clay/10">
              <p className="font-mono text-[10px] uppercase tracking-wider text-clay">Telemetría</p>
              <p className="mt-1 text-xs text-foreground/70">
                Registro automático desde el IDE · corte a los 3 min sin actividad
              </p>
            </div>
            {profile ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-viol-soft font-mono text-xs font-bold text-viol">
                  {initials(profile.name)}
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-semibold">{profile.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {profile.role.toLowerCase()} · {profile.email}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-background/85 px-4 py-3.5 backdrop-blur-sm sm:px-6">
            <div>
              <h1 className="text-lg font-bold tracking-tight">{title}</h1>
              <p className="font-mono text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex max-w-52 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                title={liveDetail || liveLabel}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    live.status === "live" && "animate-pulse bg-accent",
                    live.status === "idle" && "bg-muted-foreground/40",
                    live.status === "offline" && "bg-rosec",
                    live.status === "loading" && "bg-muted-foreground/40",
                  )}
                />
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {liveLabel}
                </span>
              </div>
              {action}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar sesión"
                onClick={() => void handleSignOut()}
              >
                <LogOut />
              </Button>
            </div>
          </header>
          <div className="space-y-5 p-4 sm:p-6">{children}</div>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-surface/95 px-2 py-2 backdrop-blur md:hidden"
        style={{
          gridTemplateColumns: `repeat(${Math.max(visibleItems.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === active;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium",
                isActive ? "bg-clay-soft text-clay" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="max-w-full truncate">{item.label.replace(" ejecutivo", "")}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SearchField({
  placeholder = "Buscar",
  value,
  onChange,
}: {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-9 w-64 min-w-0 max-w-full items-center gap-2 rounded-xl border border-line bg-background px-3 text-muted-foreground focus-within:ring-1 focus-within:ring-ring">
      <Search className="size-4 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

export function StatusDot({ tone = "accent" }: { tone?: "accent" | "amber" | "rose" | "clay" }) {
  const toneClass = {
    accent: "bg-accent",
    amber: "bg-amberc",
    rose: "bg-rosec",
    clay: "bg-clay",
  }[tone];
  return <span className={cn("size-1.5 rounded-full", toneClass)} />;
}

export function LiveSyncPill({ scope = "self" }: { scope?: "self" | "team" }) {
  const live = useLiveActivity(scope);
  const liveNow = live.status === "live";
  const label =
    live.status === "loading"
      ? "Telemetría"
      : live.status === "offline"
        ? "Sin conexión"
        : liveNow
          ? scope === "team" && live.sessions.length > 1
            ? `${live.sessions.length} en vivo`
            : "En vivo"
          : "Sin actividad";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium",
        liveNow
          ? "bg-accent-soft text-accent"
          : "bg-background text-muted-foreground ring-1 ring-line",
      )}
      title={live.sessions.map((session) => `${session.userName} · ${session.projectName}`).join(", ")}
    >
      <Wifi className="size-3" />
      {label}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  tone = "accent",
  className = "",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "accent" | "amber" | "muted";
  className?: string;
}) {
  const detailClass =
    tone === "accent" ? "text-accent" : tone === "amber" ? "text-amberc" : "text-muted-foreground";
  return (
    <div
      className={cn(
        "rounded-2xl bg-surface p-4 ring-1 ring-border/70 animate-[rise_0.5s_var(--ease)_both]",
        className,
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-bold tracking-tight">{value}</p>
      <p className={cn("mt-1 font-mono text-[11px]", detailClass)}>{detail}</p>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-surface p-5 ring-1 ring-border/70", className)}>
      {children}
    </section>
  );
}

export function StateMessage({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      className={cn(
        "py-6 text-center text-xs",
        tone === "error" ? "text-rosec" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
      <span className="font-mono">
        Mostrando {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Página anterior"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </Button>
        <span className="px-2 font-mono">
          {page + 1} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Página siguiente"
          disabled={page + 1 >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </Button>
      </div>
    </div>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-sm font-bold tracking-tight">{title}</h2>
      {subtitle ? <p className="font-mono text-[11px] text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
