-- =============================================================================
-- Nexo IT·Fin — Funciones de negocio y vistas
--   * Telemetría: register_heartbeat, register_heartbeat_with_token
--   * Tokens del IDE: create_developer_token, revoke_developer_token
--   * Facturación: generate_invoices
--   * Vistas de lectura para dashboard y "Mi tiempo"
-- Zona horaria del negocio: America/Mexico_City (define día, semana y mes).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Telemetría
-- -----------------------------------------------------------------------------

-- Agrupa heartbeats en bloques continuos (US 1.1): si el último bloque del
-- usuario es del mismo proyecto, no está facturado y terminó hace 3 minutos o
-- menos, se extiende; si no, se abre uno nuevo.
-- Devuelve el id del time_entry, o NULL si el repositorio no pertenece a un
-- proyecto activo.
create or replace function public.register_heartbeat(
  p_user_id uuid,
  p_repository_url text,
  p_ts timestamptz,
  p_is_typing boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_last public.time_entries%rowtype;
  v_entry_id uuid;
begin
  if p_ts > now() + interval '5 minutes' then
    raise exception 'heartbeat timestamp is in the future' using errcode = '22023';
  end if;

  select p.id into v_project_id
  from public.projects p
  where p.repository_key = public.normalize_repo_url(p_repository_url)
    and p.status = 'Active';

  if v_project_id is null then
    return null;
  end if;

  -- Serializa los heartbeats de un mismo usuario para no crear bloques duplicados.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into v_last
  from public.time_entries t
  where t.user_id = p_user_id
  order by t.end_time desc
  limit 1;

  if v_last.id is not null
     and v_last.project_id = v_project_id
     and v_last.invoice_id is null
     and p_ts >= v_last.start_time
     and p_ts - v_last.end_time <= interval '3 minutes' then
    update public.time_entries
    set end_time        = greatest(end_time, p_ts),
        heartbeat_count = heartbeat_count + 1,
        activity_score  = round(
          (activity_score * heartbeat_count + case when p_is_typing then 100 else 0 end)::numeric
          / (heartbeat_count + 1)
        )
    where id = v_last.id
    returning id into v_entry_id;
  else
    insert into public.time_entries (
      entry_date, start_time, end_time, activity_score, heartbeat_count, user_id, project_id
    )
    values (
      (p_ts at time zone 'America/Mexico_City')::date,
      p_ts,
      p_ts,
      case when p_is_typing then 100 else 0 end,
      1,
      p_user_id,
      v_project_id
    )
    returning id into v_entry_id;
  end if;

  return v_entry_id;
end;
$$;

-- Punto de entrada de la Edge Function heartbeat: valida el token y registra el
-- heartbeat en un solo viaje a la base de datos (objetivo < 100 ms).
-- status: tracked | ignored (repo sin proyecto activo) | unauthorized | forbidden
create or replace function public.register_heartbeat_with_token(
  p_token_hash text,
  p_repository_url text,
  p_ts timestamptz,
  p_is_typing boolean,
  p_claimed_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.developer_tokens%rowtype;
  v_entry_id uuid;
begin
  select * into v_token
  from public.developer_tokens
  where token_hash = p_token_hash and revoked_at is null;

  if v_token.id is null then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  if p_claimed_user_id is not null and p_claimed_user_id <> v_token.user_id then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if v_token.last_used_at is null or v_token.last_used_at < now() - interval '1 minute' then
    update public.developer_tokens set last_used_at = now() where id = v_token.id;
  end if;

  v_entry_id := public.register_heartbeat(v_token.user_id, p_repository_url, p_ts, p_is_typing);

  if v_entry_id is null then
    return jsonb_build_object('status', 'ignored');
  end if;

  return jsonb_build_object('status', 'tracked', 'time_entry_id', v_entry_id);
end;
$$;

revoke all on function public.register_heartbeat(uuid, text, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.register_heartbeat_with_token(text, text, timestamptz, boolean, uuid) from public, anon, authenticated;
grant execute on function public.register_heartbeat(uuid, text, timestamptz, boolean) to service_role;
grant execute on function public.register_heartbeat_with_token(text, text, timestamptz, boolean, uuid) to service_role;


-- -----------------------------------------------------------------------------
-- 2. Tokens del IDE
-- -----------------------------------------------------------------------------

-- Devuelve el token en claro una sola vez; solo se guarda su hash.
create or replace function public.create_developer_token(p_name text)
returns table (id uuid, token text, token_prefix text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_token := 'nxo_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.developer_tokens as dt (user_id, name, token_hash, token_prefix)
  values (
    v_user_id,
    coalesce(nullif(trim(p_name), ''), 'IDE'),
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
    left(v_token, 12)
  )
  returning dt.id into v_id;

  id := v_id;
  token := v_token;
  token_prefix := left(v_token, 12);
  return next;
end;
$$;

create or replace function public.revoke_developer_token(p_token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.developer_tokens
  set revoked_at = now()
  where id = p_token_id
    and revoked_at is null
    and (user_id = auth.uid() or public.current_app_role() = 'Admin');
  return found;
end;
$$;

revoke all on function public.create_developer_token(text) from public, anon;
revoke all on function public.revoke_developer_token(uuid) from public, anon;
grant execute on function public.create_developer_token(text) to authenticated;
grant execute on function public.revoke_developer_token(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Motor de facturación (US 3.1)
-- Para cada cliente con tiempo sin facturar en el mes: crea (o completa) su
-- factura Draft, le asigna ese tiempo, rehace el desglose por proyecto y
-- recalcula totales. Las facturas Sent/Paid no se tocan; el tiempo tardío de
-- esos meses queda pendiente para revisión manual.
-- -----------------------------------------------------------------------------

create or replace function public.generate_invoices(
  p_month integer,
  p_year integer,
  p_client_id uuid default null
)
returns setof public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start date;
  v_period_end date;
  v_client record;
  v_invoice public.invoices%rowtype;
begin
  if public.current_app_role() is distinct from 'Admin'
     and public.current_app_role() is distinct from 'Finance' then
    raise exception 'only Admin or Finance can generate invoices' using errcode = '42501';
  end if;

  if p_month not between 1 and 12 or p_year not between 2000 and 2100 then
    raise exception 'invalid billing period %-%', p_year, p_month using errcode = '22023';
  end if;

  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (v_period_start + interval '1 month')::date;

  perform pg_advisory_xact_lock(hashtextextended('generate_invoices', 0));

  for v_client in
    select distinct p.client_id
    from public.time_entries t
    join public.projects p on p.id = t.project_id
    where t.invoice_id is null
      and t.total_minutes > 0
      and t.entry_date >= v_period_start
      and t.entry_date < v_period_end
      and (p_client_id is null or p.client_id = p_client_id)
  loop
    insert into public.invoices (month, year, client_id)
    values (p_month, p_year, v_client.client_id)
    on conflict (client_id, year, month) do nothing;

    select * into v_invoice
    from public.invoices i
    where i.client_id = v_client.client_id and i.year = p_year and i.month = p_month
    for update;

    continue when v_invoice.status <> 'Draft';

    update public.time_entries t
    set invoice_id = v_invoice.id
    from public.projects p
    where p.id = t.project_id
      and p.client_id = v_client.client_id
      and t.invoice_id is null
      and t.total_minutes > 0
      and t.entry_date >= v_period_start
      and t.entry_date < v_period_end;

    delete from public.invoice_lines where invoice_id = v_invoice.id;

    insert into public.invoice_lines (invoice_id, project_id, hours, hourly_rate)
    select v_invoice.id, p.id, round(sum(t.total_minutes) / 60.0, 2), p.hourly_rate
    from public.time_entries t
    join public.projects p on p.id = t.project_id
    where t.invoice_id = v_invoice.id
    group by p.id, p.hourly_rate;

    update public.invoices i
    set total_hours  = coalesce(l.hours, 0),
        total_amount = coalesce(l.amount, 0)
    from (
      select sum(hours) as hours, sum(subtotal) as amount
      from public.invoice_lines
      where invoice_id = v_invoice.id
    ) l
    where i.id = v_invoice.id
    returning i.* into v_invoice;

    return next v_invoice;
  end loop;
end;
$$;

revoke all on function public.generate_invoices(integer, integer, uuid) from public, anon;
grant execute on function public.generate_invoices(integer, integer, uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 4. Vistas de lectura (security_invoker: respetan el RLS de quien consulta)
-- -----------------------------------------------------------------------------

-- Tiempo sin facturar por proyecto y mes (widget "Tiempo no facturado").
create view public.v_unbilled_by_project
with (security_invoker = true)
as
select
  p.id                                      as project_id,
  p.name                                    as project_name,
  p.repository_url,
  c.id                                      as client_id,
  c.name                                    as client_name,
  c.currency,
  extract(year from t.entry_date)::integer  as year,
  extract(month from t.entry_date)::integer as month,
  sum(t.total_minutes)::integer             as unbilled_minutes,
  round(sum(t.total_minutes) / 60.0, 2)     as unbilled_hours,
  round(sum(t.total_minutes) / 60.0 * p.hourly_rate, 2) as unbilled_amount
from public.time_entries t
join public.projects p on p.id = t.project_id
join public.clients c on c.id = p.client_id
where t.invoice_id is null
group by p.id, c.id, extract(year from t.entry_date), extract(month from t.entry_date);

-- Horas por proyecto y día (barras por repositorio del dashboard).
create view public.v_hours_by_repository
with (security_invoker = true)
as
select
  p.id                                  as project_id,
  p.name                                as project_name,
  p.repository_url,
  t.entry_date,
  sum(t.total_minutes)::integer         as total_minutes,
  round(sum(t.total_minutes) / 60.0, 2) as total_hours
from public.time_entries t
join public.projects p on p.id = t.project_id
group by p.id, t.entry_date;

-- Horas del usuario actual por día de la semana en curso (lunes a domingo).
create view public.v_my_week
with (security_invoker = true)
as
with week as (
  select date_trunc('week', now() at time zone 'America/Mexico_City')::date as monday
)
select
  d::date                                                as entry_date,
  extract(isodow from d)::integer                        as iso_day,
  coalesce(round(sum(t.total_minutes) / 60.0, 2), 0)     as total_hours
from week
cross join generate_series(week.monday, week.monday + 6, interval '1 day') as d
left join public.time_entries t
  on t.entry_date = d::date and t.user_id = (select auth.uid())
group by d;

-- Indicadores del mes en curso (KPI cards del dashboard).
create view public.v_dashboard_kpis
with (security_invoker = true)
as
with period as (
  select
    extract(year from now() at time zone 'America/Mexico_City')::integer  as year,
    extract(month from now() at time zone 'America/Mexico_City')::integer as month
)
select
  period.year,
  period.month,
  coalesce((select sum(i.total_amount) from public.invoices i
            where i.year = period.year and i.month = period.month
              and i.currency = 'USD' and i.status in ('Sent', 'Paid')), 0) as billed_usd,
  coalesce((select sum(i.total_amount) from public.invoices i
            where i.year = period.year and i.month = period.month
              and i.currency = 'MXN' and i.status in ('Sent', 'Paid')), 0) as billed_mxn,
  coalesce((select sum(u.unbilled_hours) from public.v_unbilled_by_project u
            where u.year = period.year and u.month = period.month), 0)    as unbilled_hours,
  (select count(distinct u.project_id) from public.v_unbilled_by_project u
   where u.year = period.year and u.month = period.month)::integer         as unbilled_projects,
  (select count(*) from public.clients c where c.is_active)::integer       as active_clients,
  (select count(*) from public.invoices i where i.status = 'Draft')::integer as draft_invoices,
  (select count(*) from public.invoices i where i.status = 'Sent')::integer  as sent_invoices,
  (select count(*) from public.invoices i where i.status = 'Paid')::integer  as paid_invoices
from period;

grant select on public.v_unbilled_by_project, public.v_hours_by_repository,
  public.v_my_week, public.v_dashboard_kpis to authenticated;
