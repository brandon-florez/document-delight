import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { errorMessage } from "./utils";

export function useMyWeek() {
  return useQuery({
    queryKey: ["time", "my-week"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_my_week").select("*").order("entry_date");
      if (error) throw error;
      return data;
    },
  });
}

export function useMyTimeEntries(userId: string | undefined) {
  return useQuery({
    queryKey: ["time", "entries", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select(
          "id, entry_date, start_time, end_time, total_minutes, activity_score, projects(name, repository_url)",
        )
        .eq("user_id", userId!)
        .order("start_time", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useMyTokens(userId: string | undefined) {
  return useQuery({
    queryKey: ["developer-tokens", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("developer_tokens")
        .select("id, name, token_prefix, last_used_at, revoked_at, created_at")
        .eq("user_id", userId!)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc("create_developer_token", { p_name: name });
      if (error) throw new Error(await errorMessage(error));
      const created = data[0];
      if (!created) throw new Error("No se pudo crear el token.");
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-tokens"] }),
  });
}

export function useRevokeToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase.rpc("revoke_developer_token", { p_token_id: tokenId });
      if (error) throw new Error(await errorMessage(error));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-tokens"] }),
  });
}
