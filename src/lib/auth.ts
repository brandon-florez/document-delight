import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";

export type Role = Enums<"user_role">;
export type Profile = Tables<"profiles">;

export type PortalPath =
  | "/dashboard"
  | "/my-time"
  | "/clients"
  | "/projects"
  | "/invoices"
  | "/company";

export const ROUTE_ROLES: Record<PortalPath, Role[]> = {
  "/dashboard": ["Admin", "Finance"],
  "/my-time": ["Admin", "Developer", "Finance"],
  "/clients": ["Admin", "Finance"],
  "/projects": ["Admin", "Finance"],
  "/invoices": ["Admin", "Finance"],
  "/company": ["Admin"],
};

export function homeForRole(role: Role): PortalPath {
  return role === "Developer" ? "/my-time" : "/dashboard";
}

export function canAccess(role: Role, path: string): boolean {
  const allowed = ROUTE_ROLES[path as PortalPath];
  return allowed ? allowed.includes(role) : true;
}

export const currentProfileQuery = queryOptions({
  queryKey: ["current-profile"],
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<Profile | null> => {
    if (!isSupabaseConfigured) return null;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return null;

    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    return data;
  },
});

export function useCurrentProfile() {
  return useQuery(currentProfileQuery);
}

export async function signOut(queryClient: QueryClient) {
  await supabase.auth.signOut();
  queryClient.clear();
}
