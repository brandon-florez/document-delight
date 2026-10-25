import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Enums, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { currentPeriod, monthRange } from "@/lib/format";

import { PAGE_SIZE, errorMessage, sanitizeSearch } from "./utils";

export type ProjectFilters = {
  search: string;
  status: "all" | Enums<"project_status">;
  page: number;
};

export function useProjects(filters: ProjectFilters) {
  return useQuery({
    queryKey: ["projects", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*, clients(name, currency)", { count: "exact" })
        .order("name");
      const search = sanitizeSearch(filters.search);
      if (search) query = query.or(`name.ilike.%${search}%,repository_url.ilike.%${search}%`);
      if (filters.status !== "all") query = query.eq("status", filters.status);

      const from = filters.page * PAGE_SIZE;
      const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });
}

/** Hours recorded per project in the current month, keyed by project id. */
export function useProjectHoursThisMonth() {
  return useQuery({
    queryKey: ["projects", "hours-this-month"],
    queryFn: async () => {
      const { year, month } = currentPeriod();
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("v_hours_by_repository")
        .select("project_id, total_hours")
        .gte("entry_date", start)
        .lte("entry_date", end);
      if (error) throw error;

      const totals = new Map<string, number>();
      for (const row of data) {
        if (!row.project_id) continue;
        totals.set(row.project_id, (totals.get(row.project_id) ?? 0) + (row.total_hours ?? 0));
      }
      return totals;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<"projects">) => {
      const { error } = await supabase.from("projects").insert(values);
      if (error) {
        throw new Error(
          await errorMessage(error, "Ese repositorio ya está asignado a otro proyecto."),
        );
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<"projects"> }) => {
      const { error } = await supabase.from("projects").update(values).eq("id", id);
      if (error) {
        throw new Error(
          await errorMessage(error, "Ese repositorio ya está asignado a otro proyecto."),
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useSetProjectStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Enums<"project_status"> }) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw new Error(await errorMessage(error));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}
