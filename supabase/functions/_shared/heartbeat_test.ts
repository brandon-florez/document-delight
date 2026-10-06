import { assertEquals } from "jsr:@std/assert@1";

import { parseHeartbeat } from "./heartbeat.ts";

const NOW = new Date("2025-06-10T15:00:00Z");

Deno.test("acepta un heartbeat válido y normaliza el timestamp", () => {
  const result = parseHeartbeat(
    {
      userId: "33333333-3333-3333-3333-333333333333",
      repositoryUrl: "  https://github.com/nexo/billing-core.git ",
      timestamp: "2025-06-10T08:59:00-06:00",
      isTyping: true,
    },
    NOW,
  );
  assertEquals(result, {
    ok: true,
    value: {
      userId: "33333333-3333-3333-3333-333333333333",
      repositoryUrl: "https://github.com/nexo/billing-core.git",
      timestamp: "2025-06-10T14:59:00.000Z",
      isTyping: true,
    },
  });
});

Deno.test("userId es opcional y el timestamp puede ser epoch en ms", () => {
  const result = parseHeartbeat(
    { repositoryUrl: "github.com/nexo/api", timestamp: NOW.getTime(), isTyping: false },
    NOW,
  );
  assertEquals(result.ok && result.value.userId, null);
});

Deno.test("rechaza cuerpos inválidos", () => {
  const cases: unknown[] = [
    null,
    { repositoryUrl: "", timestamp: NOW.toISOString(), isTyping: true },
    { repositoryUrl: "x", timestamp: "ayer", isTyping: true },
    { repositoryUrl: "x", timestamp: NOW.toISOString(), isTyping: "si" },
    { repositoryUrl: "x", timestamp: NOW.toISOString(), isTyping: true, userId: "123" },
    { repositoryUrl: "x", timestamp: "2025-06-08T15:00:00Z", isTyping: true },
    { repositoryUrl: "x", timestamp: "2025-06-10T15:10:00Z", isTyping: true },
  ];
  for (const body of cases) {
    assertEquals(parseHeartbeat(body, NOW).ok, false, JSON.stringify(body));
  }
});
