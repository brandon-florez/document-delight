-- =============================================================================
-- Nexo IT·Fin — Esquema inicial
-- Portal de Asignación y Facturación de Recursos IT (ver docs/prd.md, sección 2)
--
-- Entidades: profiles (User), clients, projects, time_entries, invoices,
--            invoice_lines (desglose de la factura).
-- Restricción del PRD: no existen tablas de Tickets, Tasks ni Issues.
-- El tiempo se vincula exclusivamente al proyecto.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tipos enumerados
-- -----------------------------------------------------------------------------

create type public.user_role as enum ('Admin', 'Developer', 'Finance');
create type public.currency_code as enum ('USD', 'MXN');
create type public.project_status as enum ('Active', 'Inactive');
create type public.invoice_status as enum ('Draft', 'Sent', 'Paid');


-- -----------------------------------------------------------------------------
-- 2. Utilidades
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. profiles (User)
-- Supabase Auth guarda email y contraseña (hasheada con bcrypt) en auth.users,
-- por eso aquí no existe PasswordHash.
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  email        text not null unique,
  role         public.user_role not null default 'Developer',
  hourly_cost  numeric(12, 2) not null default 0 check (hourly_cost >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Usuarios del portal. 1 a N con time_entries.';
comment on column public.profiles.hourly_cost is 'Costo interno por hora del empleado.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- El rol nunca se toma de los metadatos del registro: todo usuario nuevo entra
-- como Developer y solo un Admin puede cambiarlo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;


-- -----------------------------------------------------------------------------
-- 4. clients
-- -----------------------------------------------------------------------------

create table public.clients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  tax_id         text not null unique check (tax_id ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  currency       public.currency_code not null,
  billing_email  text not null check (billing_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.clients is 'Clientes. 1 a N con projects e invoices.';
comment on column public.clients.tax_id is 'RFC del cliente (12 o 13 caracteres, en mayúsculas).';

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 5. projects
-- -----------------------------------------------------------------------------

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) > 0),
  repository_url  text not null check (length(trim(repository_url)) > 0),
  hourly_rate     numeric(12, 2) not null check (hourly_rate > 0),
  status          public.project_status not null default 'Active',
  client_id       uuid not null references public.clients (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.projects is 'Proyectos. N a 1 con clients, 1 a N con time_entries.';
comment on column public.projects.repository_url is 'Clave para asignar los heartbeats del IDE al proyecto.';
comment on column public.projects.hourly_rate is 'Tarifa por hora en la moneda del cliente. Obligatoria (US 2.1).';

create unique index projects_repository_url_key on public.projects (lower(trim(repository_url)));
create index projects_client_id_idx on public.projects (client_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 6. invoices
-- -----------------------------------------------------------------------------

create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  month         smallint not null check (month between 1 and 12),
  year          smallint not null check (year between 2000 and 2100),
  total_hours   numeric(10, 2) not null default 0 check (total_hours >= 0),
  total_amount  numeric(14, 2) not null default 0 check (total_amount >= 0),
  currency      public.currency_code not null,
  status        public.invoice_status not null default 'Draft',
  external_id   text,
  client_id     uuid not null references public.clients (id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint invoices_client_period_key unique (client_id, year, month),
  constraint invoices_external_id_required check (status = 'Draft' or external_id is not null)
);

comment on table public.invoices is 'Facturas mensuales por cliente. N a 1 con clients.';
comment on column public.invoices.external_id is 'UUID del CFDI (SAT) o id del Payment Link (Stripe). Obligatorio al pasar a Sent/Paid.';

create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_status_idx on public.invoices (status);

create or replace function public.set_invoice_currency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.currency is null then
    select c.currency into new.currency from public.clients c where c.id = new.client_id;
  end if;
  return new;
end;
$$;

create trigger invoices_set_currency
  before insert on public.invoices
  for each row execute function public.set_invoice_currency();

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 7. invoice_lines (desglose por proyecto, US 3.1)
-- La tarifa se copia al generar la factura para que cambios futuros en
-- projects.hourly_rate no alteren facturas ya emitidas.
-- -----------------------------------------------------------------------------

create table public.invoice_lines (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete restrict,
  hours        numeric(10, 2) not null check (hours >= 0),
  hourly_rate  numeric(12, 2) not null check (hourly_rate > 0),
  subtotal     numeric(14, 2) generated always as (round(hours * hourly_rate, 2)) stored,
  created_at   timestamptz not null default now(),
  constraint invoice_lines_invoice_project_key unique (invoice_id, project_id)
);

comment on table public.invoice_lines is 'Líneas de factura: horas x tarifa por proyecto.';

create index invoice_lines_project_id_idx on public.invoice_lines (project_id);


-- -----------------------------------------------------------------------------
-- 8. time_entries
-- Bloques continuos de trabajo generados a partir de los heartbeats del IDE.
-- -----------------------------------------------------------------------------

create table public.time_entries (
  id               uuid primary key default gen_random_uuid(),
  entry_date       date not null,
  start_time       timestamptz not null,
  end_time         timestamptz not null,
  total_minutes    integer generated always as ((extract(epoch from (end_time - start_time)) / 60)::integer) stored,
  activity_score   smallint not null default 0 check (activity_score between 0 and 100),
  heartbeat_count  integer not null default 0 check (heartbeat_count >= 0),
  user_id          uuid not null references public.profiles (id) on delete restrict,
  project_id       uuid not null references public.projects (id) on delete restrict,
  invoice_id       uuid references public.invoices (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint time_entries_valid_range check (end_time >= start_time)
);

comment on table public.time_entries is 'Registros de tiempo. N a 1 con profiles y projects.';
comment on column public.time_entries.activity_score is 'Porcentaje (0-100) de heartbeats con isTyping = true.';
comment on column public.time_entries.heartbeat_count is 'Heartbeats agrupados; necesario para recalcular activity_score.';
comment on column public.time_entries.invoice_id is 'Factura que cobró este tiempo. NULL = tiempo no facturado.';

create index time_entries_user_date_idx on public.time_entries (user_id, entry_date);
create index time_entries_project_date_idx on public.time_entries (project_id, entry_date);
create index time_entries_unbilled_idx on public.time_entries (project_id) where invoice_id is null;
create index time_entries_invoice_id_idx on public.time_entries (invoice_id);

create trigger time_entries_set_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 9. Seguridad a nivel de fila (RLS)
--   Admin     -> todo.
--   Finance   -> clientes, proyectos, facturas y lectura/marcado de tiempo.
--   Developer -> solo su propio perfil, su propio tiempo y la lista de proyectos.
-- Los heartbeats se insertarán desde el backend con la service_role key,
-- que omite RLS.
-- -----------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.clients       enable row level security;
alter table public.projects      enable row level security;
alter table public.invoices      enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.time_entries  enable row level security;

-- profiles
create policy "profiles_select_own_or_staff" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.current_app_role()) in ('Admin', 'Finance'));

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using ((select public.current_app_role()) = 'Admin')
  with check ((select public.current_app_role()) = 'Admin');

-- clients
create policy "clients_all_staff" on public.clients
  for all to authenticated
  using ((select public.current_app_role()) in ('Admin', 'Finance'))
  with check ((select public.current_app_role()) in ('Admin', 'Finance'));

-- projects
create policy "projects_select_authenticated" on public.projects
  for select to authenticated
  using (true);

create policy "projects_insert_staff" on public.projects
  for insert to authenticated
  with check ((select public.current_app_role()) in ('Admin', 'Finance'));

create policy "projects_update_staff" on public.projects
  for update to authenticated
  using ((select public.current_app_role()) in ('Admin', 'Finance'))
  with check ((select public.current_app_role()) in ('Admin', 'Finance'));

create policy "projects_delete_staff" on public.projects
  for delete to authenticated
  using ((select public.current_app_role()) in ('Admin', 'Finance'));

-- invoices
create policy "invoices_all_staff" on public.invoices
  for all to authenticated
  using ((select public.current_app_role()) in ('Admin', 'Finance'))
  with check ((select public.current_app_role()) in ('Admin', 'Finance'));

-- invoice_lines
create policy "invoice_lines_all_staff" on public.invoice_lines
  for all to authenticated
  using ((select public.current_app_role()) in ('Admin', 'Finance'))
  with check ((select public.current_app_role()) in ('Admin', 'Finance'));

-- time_entries (Developer: solo lectura de lo propio, US 1.1 / pantalla /my-time)
create policy "time_entries_select_own_or_staff" on public.time_entries
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_app_role()) in ('Admin', 'Finance'));

create policy "time_entries_update_staff" on public.time_entries
  for update to authenticated
  using ((select public.current_app_role()) in ('Admin', 'Finance'))
  with check ((select public.current_app_role()) in ('Admin', 'Finance'));

create policy "time_entries_delete_admin" on public.time_entries
  for delete to authenticated
  using ((select public.current_app_role()) = 'Admin');
