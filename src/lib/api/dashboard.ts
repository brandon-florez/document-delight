import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { currentPeriod, currentWeek } from "@/lib/format";

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_dashboard_kpis").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Unbilled time of the current month, per project (Unbilled Time Widget). */
export function useUnbilledThisMonth() {
  return useQuery({
    queryKey: ["dashboard", "unbilled"],
    queryFn: async () => {
      const { year, month } = currentPeriod();
      const { data, error } = await supabase
        .from("v_unbilled_by_project")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .order("unbilled_hours", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Hours per repository during the current week, sorted from most to least. */
export function useWeeklyHoursByRepository() {
  return useQuery({
    queryKey: ["dashboard", "weekly-repositories"],
    queryFn: async () => {
      const { monday, sunday } = currentWeek();
      const { data, error } = await supabase
        .from("v_hours_by_repository")
        .select("project_id, project_name, total_hours")
        .gte("entry_date", monday)
        .lte("entry_date", sunday);
      if (error) throw error;

      const byProject = new Map<string, { name: string; hours: number }>();
      for (const row of data) {
        if (!row.project_id) continue;
        const current = byProject.get(row.project_id) ?? { name: row.project_name ?? "", hours: 0 };
        current.hours += row.total_hours ?? 0;
        byProject.set(row.project_id, current);
      }
      return [...byProject.entries()]
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => b.hours - a.hours);
    },
  });
}
