import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { currentProfileQuery, homeForRole } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Nexo IT·Fin" },
      {
        name: "description",
        content:
          "Acceso al portal de asignación, telemetría automática y facturación de recursos IT.",
      },
      { property: "og:title", content: "Iniciar sesión — Nexo IT·Fin" },
      {
        property: "og:description",
        content: "Ingreso seguro para desarrolladores, administración y finanzas en Nexo IT·Fin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void queryClient.fetchQuery(currentProfileQuery).then((profile) => {
      if (profile) void navigate({ to: homeForRole(profile.role) });
    });
  }, [navigate, queryClient]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Email o contraseña incorrectos."
            : signInError.message,
        );
        return;
      }
      queryClient.removeQueries({ queryKey: currentProfileQuery.queryKey });
      const profile = await queryClient.fetchQuery(currentProfileQuery);
      if (!profile) {
        setError("Tu usuario no tiene perfil en el portal. Contacta a un administrador.");
        return;
      }
      await navigate({ to: homeForRole(profile.role) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 font-sans text-foreground">
      <div className="absolute inset-x-0 top-0 h-64 bg-clay-soft/60" />
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-surface ring-1 ring-border/70 shadow-[var(--shadow-panel)]">
        <div className="grid min-h-[620px] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-between border-b border-line bg-clay-soft/80 p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2.5">
              <div className="grid size-10 place-items-center rounded-xl bg-clay text-primary-foreground shadow-[var(--shadow-clay)]">
                <span className="font-mono text-sm font-bold">N</span>
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-tight">Nexo</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Portal IT·Fin
                </p>
              </div>
            </div>

            <div className="my-12 max-w-md">
              <p className="font-mono text-[11px] uppercase tracking-wider text-clay">
                Asignación y cobro
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Tiempo de código convertido en facturas claras.
              </h1>
              <p className="mt-4 text-sm leading-6 text-foreground/70">
                Acceso para desarrolladores, administración y finanzas con telemetría automática por
                repositorio.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["100ms", "Recepción de heartbeat"],
                ["3 min", "Corte por inactividad"],
                ["0", "Timers manuales"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-surface/75 p-3 ring-1 ring-border/70">
                  <p className="font-mono text-xl font-bold">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center p-6 sm:p-10">
            <form className="w-full space-y-6" onSubmit={(event) => void handleSubmit(event)}>
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] font-medium text-accent">
                  <ShieldCheck className="size-3.5" />
                  Acceso seguro
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Iniciar Sesión</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Serás redirigido según tu rol: desarrolladores a Mi tiempo; administración y
                  finanzas al dashboard.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="tu@empresa.com"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {!isSupabaseConfigured ? (
                <p role="alert" className="rounded-xl bg-amberc-soft px-3 py-2 text-sm">
                  Falta configurar Supabase: completa <code>VITE_SUPABASE_URL</code> y{" "}
                  <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> en el archivo <code>.env</code> y
                  reinicia <code>npm run dev</code>.
                </p>
              ) : null}

              {error ? (
                <p role="alert" className="rounded-xl bg-rosec-soft px-3 py-2 text-sm text-rosec">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="clay"
                size="lg"
                className="w-full"
                disabled={submitting || !isSupabaseConfigured}
              >
                {submitting ? <Loader2 className="animate-spin" /> : null}
                Iniciar Sesión
                {submitting ? null : <ArrowRight />}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
