import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

import { PAGE_SIZE, errorMessage, sanitizeSearch } from "./utils";

export type ClientFilters = {
  search: string;
  currency: "all" | "USD" | "MXN";
  page: number;
};

export function useClients(filters: ClientFilters) {
  return useQuery({
    queryKey: ["clients", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from("clients").select("*", { count: "exact" }).order("name");
      const search = sanitizeSearch(filters.search);
      if (search) query = query.or(`name.ilike.%${search}%,tax_id.ilike.%${search}%`);
      if (filters.currency !== "all") query = query.eq("currency", filters.currency);

      const from = filters.page * PAGE_SIZE;
      const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });
}

export function useClientOptions() {
  return useQuery({
    queryKey: ["clients", "options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, currency")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<"clients">) => {
      const { error } = await supabase.from("clients").insert(values);
      if (error) throw new Error(await errorMessage(error, "Ya existe un cliente con ese RFC."));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useSetClientActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("clients").update({ is_active: isActive }).eq("id", id);
      if (error) throw new Error(await errorMessage(error));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
