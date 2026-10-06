import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const supabaseDir = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal stand-ins for what Supabase provides out of the box: roles, auth.users,
// auth.uid() (read from the JWT "sub" claim) and the storage tables.
const SUPABASE_STUBS = `
  create role anon;
  create role authenticated;
  create role service_role bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

const GRANTS = `
  grant all on all tables in schema public to authenticated, service_role;
  grant select on all tables in schema storage to authenticated;
`;

export const USERS = {
  admin: "11111111-1111-1111-1111-111111111111",
  finance: "22222222-2222-2222-2222-222222222222",
  dev: "33333333-3333-3333-3333-333333333333",
  dev2: "44444444-4444-4444-4444-444444444444",
};

export async function createDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);

  const migrationsDir = join(supabaseDir, "migrations");
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  await db.exec(readFileSync(join(supabaseDir, "seed.sql"), "utf8"));
  await db.exec(GRANTS);

  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${USERS.admin}', 'admin@nexo.it', '{"name":"Ana Admin"}'),
      ('${USERS.finance}', 'fin@nexo.it', '{"name":"Fer Finanzas"}'),
      ('${USERS.dev}', 'diego@nexo.it', '{"name":"Diego Dev"}'),
      ('${USERS.dev2}', 'dana@nexo.it', '{"name":"Dana Dev"}');
    update public.profiles set role = 'Admin' where id = '${USERS.admin}';
    update public.profiles set role = 'Finance' where id = '${USERS.finance}';
  `);

  return db;
}

/** Runs a query as an authenticated user (RLS applies). */
export async function asUser(db, userId, sql, params = []) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`,
  );
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

/** Runs a query as the service_role used by Edge Functions. */
export async function asService(db, sql, params = []) {
  await db.exec(`set role service_role;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role;`);
  }
}

export async function projectId(db, name) {
  const { rows } = await db.query(`select id from public.projects where name = $1`, [name]);
  return rows[0].id;
}
