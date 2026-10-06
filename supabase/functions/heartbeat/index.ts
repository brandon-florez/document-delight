// POST /functions/v1/heartbeat
// Recibe la telemetría del IDE. Autenticación: "Authorization: Bearer <token personal>"
// (generado con create_developer_token). Se despliega con verify_jwt = false porque
// el token no es un JWT de Supabase.
import { parseHeartbeat } from "../_shared/heartbeat.ts";
import { bearerToken, corsHeaders, json, problem, sha256Hex } from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return problem(405, "Method Not Allowed");

  const token = bearerToken(req);
  if (!token) return problem(401, "Unauthorized", "Falta el token del IDE.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Bad Request", "El cuerpo no es JSON válido.");
  }

  const parsed = parseHeartbeat(body);
  if (!parsed.ok) return problem(422, "Unprocessable Entity", parsed.error);

  const { data, error } = await getAdminClient().rpc("register_heartbeat_with_token", {
    p_token_hash: await sha256Hex(token),
    p_repository_url: parsed.value.repositoryUrl,
    p_ts: parsed.value.timestamp,
    p_is_typing: parsed.value.isTyping,
    p_claimed_user_id: parsed.value.userId,
  });

  if (error) {
    console.error("register_heartbeat_with_token failed", error);
    return problem(500, "Internal Server Error", "No se pudo registrar el heartbeat.");
  }

  switch ((data as { status: string }).status) {
    case "tracked":
      return new Response(null, { status: 204, headers: corsHeaders });
    case "ignored":
      return json(
        { tracked: false, reason: "El repositorio no pertenece a un proyecto activo." },
        202,
      );
    case "forbidden":
      return problem(403, "Forbidden", "El userId no corresponde al token.");
    default:
      return problem(401, "Unauthorized", "Token inválido o revocado.");
  }
});
