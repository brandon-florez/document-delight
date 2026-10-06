import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function isValidHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** False when .env is missing or still has the .env.example placeholders. */
export const isSupabaseConfigured =
  isValidHttpUrl(SUPABASE_URL) &&
  Boolean(SUPABASE_PUBLISHABLE_KEY) &&
  !SUPABASE_PUBLISHABLE_KEY!.includes("<");

if (!isSupabaseConfigured) {
  console.error(
    "VITE_SUPABASE_URL y/o VITE_SUPABASE_PUBLISHABLE_KEY faltan o no son válidas. Revisa el archivo .env (ver .env.example).",
  );
}

// An invalid URL makes createClient throw at import time and breaks every page,
// so fall back to a local placeholder and let the UI report the misconfiguration.
export const supabase = createClient<Database>(
  isSupabaseConfigured ? SUPABASE_URL! : "http://localhost:54321",
  isSupabaseConfigured ? SUPABASE_PUBLISHABLE_KEY! : "missing-key",
  {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  },
);
