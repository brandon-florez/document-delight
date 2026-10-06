export type Heartbeat = {
  userId: string | null;
  repositoryUrl: string;
  timestamp: string;
  isTyping: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Validates the IDE payload. Returns the heartbeat or a human-readable error. */
export function parseHeartbeat(
  body: unknown,
  now: Date = new Date(),
): { ok: true; value: Heartbeat } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "El cuerpo debe ser un objeto JSON." };
  }
  const { userId, repositoryUrl, timestamp, isTyping } = body as Record<string, unknown>;

  if (
    userId !== undefined &&
    userId !== null &&
    (typeof userId !== "string" || !UUID_RE.test(userId))
  ) {
    return { ok: false, error: "userId debe ser un UUID." };
  }
  if (
    typeof repositoryUrl !== "string" ||
    repositoryUrl.trim() === "" ||
    repositoryUrl.length > 500
  ) {
    return { ok: false, error: "repositoryUrl es obligatorio." };
  }
  if (typeof isTyping !== "boolean") {
    return { ok: false, error: "isTyping debe ser booleano." };
  }

  const ts =
    typeof timestamp === "string" || typeof timestamp === "number" ? new Date(timestamp) : null;
  if (!ts || Number.isNaN(ts.getTime())) {
    return { ok: false, error: "timestamp debe ser una fecha ISO 8601 o epoch en milisegundos." };
  }
  if (now.getTime() - ts.getTime() > MAX_AGE_MS) {
    return { ok: false, error: "timestamp tiene más de 24 horas." };
  }
  if (ts.getTime() - now.getTime() > 5 * 60 * 1000) {
    return { ok: false, error: "timestamp está en el futuro." };
  }

  return {
    ok: true,
    value: {
      userId: (userId as string | undefined) ?? null,
      repositoryUrl: repositoryUrl.trim(),
      timestamp: ts.toISOString(),
      isTyping,
    },
  };
}
