import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, describe, test } from "node:test";

import { USERS, asService, asUser, createDb, projectId } from "./helpers.mjs";

const heartbeat = (db, userId, repo, ts, typing = true) =>
  asService(db, `select public.register_heartbeat($1, $2, $3, $4) as id`, [
    userId,
    repo,
    ts,
    typing,
  ]).then((r) => r.rows[0].id);

const entriesOf = (db, userId) =>
  db
    .query(
      `select t.*, p.name as project from public.time_entries t
       join public.projects p on p.id = t.project_id
       where user_id = $1 order by start_time`,
      [userId],
    )
    .then((r) => r.rows);

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

describe("normalize_repo_url", () => {
  test("produce la misma clave para variantes de la misma URL", async () => {
    const db = await createDb();
    const variants = [
      "github.com/nexo/billing-core",
      "https://github.com/Nexo/billing-core.git",
      "git@github.com:nexo/billing-core.git",
      "https://user@www.github.com/nexo/billing-core/",
      "  ssh://git@github.com/nexo/billing-core  ",
    ];
    for (const url of variants) {
      const { rows } = await db.query(`select public.normalize_repo_url($1) as key`, [url]);
      assert.equal(rows[0].key, "github.com/nexo/billing-core", url);
    }
  });

  test("impide registrar dos proyectos con el mismo repositorio escrito distinto", async () => {
    const db = await createDb();
    await assert.rejects(
      db.query(
        `insert into public.projects (name, repository_url, hourly_rate, client_id)
         values ('dup', 'https://github.com/nexo/billing-core.git', 10, '00000000-0000-0000-0000-000000000101')`,
      ),
      /projects_repository_key_key/,
    );
  });
});

describe("register_heartbeat", () => {
  let db;
  beforeEach(async () => {
    db = await createDb();
  });

  test("ignora repositorios sin proyecto activo", async () => {
    assert.equal(
      await heartbeat(db, USERS.dev, "github.com/otro/repo", "2025-06-10T15:00:00Z"),
      null,
    );
    assert.equal(
      await heartbeat(db, USERS.dev, "github.com/cobalto/data-pipeline", "2025-06-10T15:00:00Z"),
      null,
      "data-pipeline está Inactive",
    );
    assert.equal((await entriesOf(db, USERS.dev)).length, 0);
  });

  test("agrupa heartbeats continuos y corta tras más de 3 minutos de inactividad", async () => {
    const repo = "https://github.com/nexo/billing-core.git";
    await heartbeat(db, USERS.dev, repo, "2025-06-10T15:00:00Z", true);
    await heartbeat(db, USERS.dev, repo, "2025-06-10T15:02:00Z", false);
    await heartbeat(db, USERS.dev, repo, "2025-06-10T15:05:00Z", true);
    await heartbeat(db, USERS.dev, repo, "2025-06-10T15:08:01Z", true);

    const entries = await entriesOf(db, USERS.dev);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].total_minutes, 5);
    assert.equal(entries[0].heartbeat_count, 3);
    assert.equal(entries[0].activity_score, 67);
    assert.equal(entries[1].total_minutes, 0);
    assert.equal(entries[1].activity_score, 100);
  });

  test("abre un bloque nuevo al cambiar de proyecto y no reabre el anterior", async () => {
    await heartbeat(db, USERS.dev, "github.com/nexo/billing-core", "2025-06-10T15:00:00Z");
    await heartbeat(db, USERS.dev, "github.com/nexo/api-gateway", "2025-06-10T15:01:00Z");
    await heartbeat(db, USERS.dev, "github.com/nexo/billing-core", "2025-06-10T15:02:00Z");

    const entries = await entriesOf(db, USERS.dev);
    assert.deepEqual(
      entries.map((e) => e.project),
      ["billing-core", "api-gateway", "billing-core"],
    );
  });

  test("separa los bloques de cada desarrollador", async () => {
    await heartbeat(db, USERS.dev, "github.com/nexo/billing-core", "2025-06-10T15:00:00Z");
    await heartbeat(db, USERS.dev2, "github.com/nexo/billing-core", "2025-06-10T15:01:00Z");
    assert.equal((await entriesOf(db, USERS.dev)).length, 1);
    assert.equal((await entriesOf(db, USERS.dev2)).length, 1);
  });

  test("asigna la fecha según la zona horaria de México", async () => {
    await heartbeat(db, USERS.dev, "github.com/nexo/billing-core", "2025-06-11T03:00:00Z");
    const [entry] = await entriesOf(db, USERS.dev);
    assert.equal(entry.entry_date.toISOString().slice(0, 10), "2025-06-10");
  });

  test("no extiende un bloque que ya fue facturado", async () => {
    const repo = "github.com/nexo/billing-core";
    await heartbeat(db, USERS.dev, repo, "2025-06-10T15:00:00Z");
    await heartbeat(db, USERS.dev, repo, "2025-06-10T15:02:00Z");
    await asUser(db, USERS.finance, `select * from public.generate_invoices(6, 2025)`);
    await heartbeat(db, USERS.dev, repo, "2025-06-10T15:03:00Z");
    assert.equal((await entriesOf(db, USERS.dev)).length, 2);
  });

  test("rechaza timestamps en el futuro", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await assert.rejects(
      heartbeat(db, USERS.dev, "github.com/nexo/billing-core", future),
      /future/,
    );
  });

  test("un usuario autenticado no puede llamar register_heartbeat directamente", async () => {
    await assert.rejects(
      asUser(
        db,
        USERS.dev,
        `select public.register_heartbeat($1, 'github.com/nexo/billing-core', now(), true)`,
        [USERS.dev],
      ),
      /permission denied/,
    );
  });
});

describe("tokens del IDE", () => {
  let db;
  let token;
  beforeEach(async () => {
    db = await createDb();
    const { rows } = await asUser(
      db,
      USERS.dev,
      `select * from public.create_developer_token('VS Code')`,
    );
    token = rows[0];
  });

  const withToken = (hash, claimed = null) =>
    asService(
      db,
      `select public.register_heartbeat_with_token($1, 'github.com/nexo/billing-core', '2025-06-10T15:00:00Z', true, $2) as r`,
      [hash, claimed],
    ).then((r) => r.rows[0].r);

  test("guarda solo el hash y el prefijo", async () => {
    assert.match(token.token, /^nxo_[0-9a-f]{64}$/);
    const { rows } = await db.query(`select token_hash, token_prefix from public.developer_tokens`);
    assert.equal(rows[0].token_hash, sha256(token.token));
    assert.equal(rows[0].token_prefix, token.token.slice(0, 12));
  });

  test("registra heartbeats con un token válido", async () => {
    const result = await withToken(sha256(token.token));
    assert.equal(result.status, "tracked");
    assert.equal((await entriesOf(db, USERS.dev)).length, 1);
  });

  test("responde unauthorized, forbidden o ignored según el caso", async () => {
    assert.equal((await withToken(sha256("nxo_falso"))).status, "unauthorized");
    assert.equal((await withToken(sha256(token.token), USERS.dev2)).status, "forbidden");
    const ignored = await asService(
      db,
      `select public.register_heartbeat_with_token($1, 'github.com/otro/repo', now(), true) as r`,
      [sha256(token.token)],
    );
    assert.equal(ignored.rows[0].r.status, "ignored");
  });

  test("un token revocado deja de funcionar y solo su dueño lo ve", async () => {
    const others = await asUser(
      db,
      USERS.dev2,
      `select count(*)::int as n from public.developer_tokens`,
    );
    assert.equal(others.rows[0].n, 0);

    const revoked = await asUser(db, USERS.dev2, `select public.revoke_developer_token($1) as ok`, [
      token.id,
    ]);
    assert.equal(revoked.rows[0].ok, false, "otro desarrollador no puede revocarlo");

    const own = await asUser(db, USERS.dev, `select public.revoke_developer_token($1) as ok`, [
      token.id,
    ]);
    assert.equal(own.rows[0].ok, true);
    assert.equal((await withToken(sha256(token.token))).status, "unauthorized");
  });
});

describe("generate_invoices", () => {
  let db;
  let billingCore;
  let apiGateway;

  const addEntry = (project, date, start, end, invoiceUser = USERS.dev) =>
    db.query(
      `insert into public.time_entries (entry_date, start_time, end_time, user_id, project_id)
       values ($1, $2, $3, $4, $5)`,
      [date, `${date}T${start}:00-06:00`, `${date}T${end}:00-06:00`, invoiceUser, project],
    );

  const generate = (userId, month = 6, year = 2025, clientId = null) =>
    asUser(db, userId, `select * from public.generate_invoices($1, $2, $3)`, [
      month,
      year,
      clientId,
    ]).then((r) => r.rows);

  beforeEach(async () => {
    db = await createDb();
    billingCore = await projectId(db, "billing-core");
    apiGateway = await projectId(db, "api-gateway");
    await addEntry(billingCore, "2025-06-10", "09:00", "10:30");
    await addEntry(billingCore, "2025-06-11", "09:00", "09:45", USERS.dev2);
    await addEntry(apiGateway, "2025-06-12", "13:00", "15:00");
    await addEntry(apiGateway, "2025-07-01", "13:00", "14:00");
  });

  test("solo Admin y Finance pueden generar facturas", async () => {
    await assert.rejects(generate(USERS.dev), /only Admin or Finance/);
    assert.equal((await generate(USERS.admin)).length, 2);
  });

  test("crea un borrador por cliente con desglose y totales", async () => {
    const invoices = await generate(USERS.finance);
    assert.equal(invoices.length, 2);

    const andes = invoices.find((i) => i.currency === "MXN");
    assert.equal(andes.status, "Draft");
    assert.equal(Number(andes.total_hours), 2.25);
    assert.equal(Number(andes.total_amount), 281.25);

    const norte = invoices.find((i) => i.currency === "USD");
    assert.equal(Number(norte.total_hours), 2);
    assert.equal(Number(norte.total_amount), 220);

    const { rows: lines } = await db.query(
      `select hours, hourly_rate, subtotal from public.invoice_lines where invoice_id = $1`,
      [andes.id],
    );
    assert.deepEqual(
      lines.map((l) => [Number(l.hours), Number(l.hourly_rate), Number(l.subtotal)]),
      [[2.25, 125, 281.25]],
    );

    const { rows: julyLeft } = await db.query(
      `select count(*)::int as n from public.time_entries where invoice_id is null`,
    );
    assert.equal(julyLeft[0].n, 1, "el tiempo de julio sigue sin facturar");
  });

  test("filtra por cliente", async () => {
    const invoices = await generate(USERS.finance, 6, 2025, "00000000-0000-0000-0000-000000000101");
    assert.equal(invoices.length, 1);
    assert.equal(invoices[0].currency, "USD");
  });

  test("al repetirse completa el borrador existente con el tiempo nuevo", async () => {
    await generate(USERS.finance);
    assert.equal((await generate(USERS.finance)).length, 0, "sin tiempo nuevo no hay cambios");

    await addEntry(billingCore, "2025-06-20", "10:00", "11:00");
    const [updated] = await generate(USERS.finance);
    assert.equal(Number(updated.total_hours), 3.25);
    assert.equal(Number(updated.total_amount), 406.25);

    const { rows } = await db.query(`select count(*)::int as n from public.invoices`);
    assert.equal(rows[0].n, 2);
  });

  test("no modifica facturas ya enviadas", async () => {
    const invoices = await generate(USERS.finance);
    const norte = invoices.find((i) => i.currency === "USD");
    await db.query(
      `update public.invoices set status = 'Sent', external_id = 'plink_1' where id = $1`,
      [norte.id],
    );

    await addEntry(apiGateway, "2025-06-25", "10:00", "11:00");
    assert.equal((await generate(USERS.finance)).length, 0);

    const { rows } = await db.query(`select total_hours from public.invoices where id = $1`, [
      norte.id,
    ]);
    assert.equal(Number(rows[0].total_hours), 2);
  });
});

describe("vistas", () => {
  test("v_my_week devuelve los 7 días con las horas del usuario actual", async () => {
    const db = await createDb();
    const billingCore = await projectId(db, "billing-core");
    await db.query(
      `insert into public.time_entries (entry_date, start_time, end_time, user_id, project_id)
       values ((now() at time zone 'America/Mexico_City')::date, now() - interval '90 minutes', now(), $1, $2),
              ((now() at time zone 'America/Mexico_City')::date, now() - interval '60 minutes', now(), $3, $2)`,
      [USERS.dev, billingCore, USERS.dev2],
    );

    const { rows } = await asUser(
      db,
      USERS.dev,
      `select * from public.v_my_week order by entry_date`,
    );
    assert.equal(rows.length, 7);
    assert.deepEqual(
      rows.map((r) => r.iso_day),
      [1, 2, 3, 4, 5, 6, 7],
    );
    assert.equal(
      rows.reduce((sum, r) => sum + Number(r.total_hours), 0),
      1.5,
    );
  });

  test("v_dashboard_kpis y v_unbilled_by_project reflejan el mes en curso", async () => {
    const db = await createDb();
    const apiGateway = await projectId(db, "api-gateway");
    await db.query(
      `insert into public.time_entries (entry_date, start_time, end_time, user_id, project_id)
       values ((now() at time zone 'America/Mexico_City')::date, now() - interval '2 hours', now(), $1, $2)`,
      [USERS.dev, apiGateway],
    );

    const { rows: kpis } = await asUser(db, USERS.finance, `select * from public.v_dashboard_kpis`);
    assert.equal(Number(kpis[0].unbilled_hours), 2);
    assert.equal(kpis[0].unbilled_projects, 1);
    assert.equal(kpis[0].active_clients, 4);

    const { rows: unbilled } = await asUser(
      db,
      USERS.finance,
      `select * from public.v_unbilled_by_project`,
    );
    assert.equal(unbilled.length, 1);
    assert.equal(Number(unbilled[0].unbilled_amount), 220);

    const { rows: devView } = await asUser(
      db,
      USERS.dev2,
      `select * from public.v_unbilled_by_project`,
    );
    assert.equal(devView.length, 0, "un desarrollador no ve el tiempo de otros");
  });
});

describe("RLS", () => {
  test("un desarrollador no ve datos fiscales del emisor ni clientes", async () => {
    const db = await createDb();
    const company = await asUser(
      db,
      USERS.dev,
      `select count(*)::int as n from public.company_settings`,
    );
    const clients = await asUser(db, USERS.dev, `select count(*)::int as n from public.clients`);
    assert.equal(company.rows[0].n, 0);
    assert.equal(clients.rows[0].n, 0);

    const finance = await asUser(
      db,
      USERS.finance,
      `select count(*)::int as n from public.company_settings`,
    );
    assert.equal(finance.rows[0].n, 1);
  });

  test("solo Admin modifica los datos del emisor", async () => {
    const db = await createDb();
    const byFinance = await asUser(
      db,
      USERS.finance,
      `update public.company_settings set legal_name = 'X' returning id`,
    );
    assert.equal(byFinance.rows.length, 0);
    const byAdmin = await asUser(
      db,
      USERS.admin,
      `update public.company_settings set legal_name = 'Y' returning id`,
    );
    assert.equal(byAdmin.rows.length, 1);
  });
});
