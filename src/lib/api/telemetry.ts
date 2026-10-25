import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/lib/auth";

/** Same idle cutoff as the IDE extension: no keystrokes for 3 minutes ends the block. */
const LIVE_WINDOW_MS = 3 * 60 * 1000;
const POLL_MS = 15_000;

export type LiveSession = {
  userId: string;
  userName: string;
  projectName: string;
  endTime: string;
};

export type LiveStatus = "loading" | "live" | "idle" | "offline";

const seenSignatures = new Map<string, string>();

export function useLiveActivity(scope: "self" | "team" = "self") {
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const selfOnly = scope === "self" || profile?.role === "Developer";
  const scopeKey = selfOnly ? (profile?.id ?? "self") : "team";

  const query = useQuery({
    queryKey: ["telemetry", "live", scopeKey],
    enabled: Boolean(profile),
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<LiveSession[]> => {
      const since = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
      let request = supabase
        .from("time_entries")
        .select("user_id, end_time, projects(name), profiles(name)")
        .gte("end_time", since)
        .order("end_time", { ascending: false })
        .limit(50);
      if (selfOnly) request = request.eq("user_id", profile!.id);

      const { data, error } = await request;
      if (error) throw error;

      const byUser = new Map<string, LiveSession>();
      for (const row of data) {
        if (byUser.has(row.user_id)) continue;
        const project = row.projects;
        const person = row.profiles;
        byUser.set(row.user_id, {
          userId: row.user_id,
          userName: person?.name ?? "Desarrollador",
          projectName: project?.name ?? "Proyecto",
          endTime: row.end_time,
        });
      }
      return [...byUser.values()];
    },
  });

  const signature = query.isSuccess
    ? query.data.map((session) => `${session.userId}:${session.endTime}`).join("|")
    : null;

  useEffect(() => {
    if (signature === null) return;
    const previous = seenSignatures.get(scopeKey);
    if (previous === signature) return;
    seenSignatures.set(scopeKey, signature);
    if (previous === undefined && signature === "") return;
    void queryClient.invalidateQueries({ queryKey: ["time"] });
    if (!selfOnly) void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, scopeKey, selfOnly, signature]);

  const status: LiveStatus = !profile || query.isPending
    ? "loading"
    : query.isError
      ? "offline"
      : query.data.length > 0
        ? "live"
        : "idle";

  return { status, sessions: query.data ?? [] };
}

export function liveStatusLabel(status: LiveStatus, sessions: LiveSession[], team: boolean) {
  if (status === "loading") return "Telemetría";
  if (status === "offline") return "Sin conexión";
  if (status !== "live" || sessions.length === 0) return "Sin actividad";
  if (!team) return `En vivo · ${sessions[0]?.projectName ?? "Proyecto"}`;
  if (sessions.length === 1) return `En vivo · ${sessions[0]?.userName ?? "Desarrollador"}`;
  return `${sessions.length} en vivo`;
}
