import { useQueryClient } from "@tanstack/react-query";
import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { canAccess, currentProfileQuery, homeForRole } from "@/lib/auth";

export const Route = createFileRoute("/_authed")({
  // The Supabase session lives in localStorage, so guards and data only run in the browser.
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const profile = await context.queryClient.ensureQueryData(currentProfileQuery);
    if (!profile) {
      throw redirect({ to: "/login" });
    }
    if (!canAccess(profile.role, location.pathname)) {
      throw redirect({ to: homeForRole(profile.role) });
    }
    return { profile };
  },
  pendingComponent: PortalLoading,
  component: AuthedLayout,
});

function PortalLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <p className="font-mono text-xs text-muted-foreground">Cargando portal…</p>
    </div>
  );
}

function AuthedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        void navigate({ to: "/login" });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, queryClient]);

  return <Outlet />;
}
