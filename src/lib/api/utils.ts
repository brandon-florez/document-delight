import { FunctionsHttpError } from "@supabase/supabase-js";

export const PAGE_SIZE = 10;

/** Removes characters with special meaning inside PostgREST `or()` / `ilike` filters. */
export function sanitizeSearch(term: string) {
  return term.replace(/[,()%*\\]/g, " ").trim();
}

const UNIQUE_VIOLATION = "23505";

/** Turns Supabase / PostgREST / Edge Function errors into a message for the user. */
export async function errorMessage(error: unknown, duplicateMessage?: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await (error.context as Response)
      .clone()
      .json()
      .catch(() => null);
    return (body as { detail?: string; title?: string } | null)?.detail ?? error.message;
  }
  if (typeof error === "object" && error !== null) {
    const { code, message } = error as { code?: string; message?: string };
    if (code === UNIQUE_VIOLATION && duplicateMessage) return duplicateMessage;
    if (message) return message;
  }
  return "Ocurrió un error inesperado.";
}
