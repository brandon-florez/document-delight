import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

let adminClient: SupabaseClient | undefined;

/** Client with the service_role key: bypasses RLS. Only for server-side code. */
export function getAdminClient(): SupabaseClient {
  adminClient ??= createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return adminClient;
}

export type StaffCaller = { id: string; role: "Admin" | "Finance" };

/** Resolves the portal user behind a Supabase JWT and requires Admin or Finance. */
export async function requireStaff(jwt: string | null): Promise<StaffCaller | null> {
  if (!jwt) return null;
  const admin = getAdminClient();
  const { data: userData, error } = await admin.auth.getUser(jwt);
  if (error || !userData.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .single();

  if (!profile || (profile.role !== "Admin" && profile.role !== "Finance")) return null;
  return { id: profile.id, role: profile.role };
}
