-- =============================================================================
-- Nexo IT·Fin — Soporte para el backend
-- Normalización de repositorios, tokens del IDE, datos fiscales para CFDI 4.0,
-- datos de cobro en facturas, emisor y almacenamiento de XML/PDF.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Normalización de URLs de repositorio
-- "https://github.com/Nexo/billing-core.git", "git@github.com:nexo/billing-core"
-- y "github.com/nexo/billing-core/" producen "github.com/nexo/billing-core".
-- -----------------------------------------------------------------------------

create or replace function public.normalize_repo_url(p_url text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(lower(trim(p_url)), '^[a-z][a-z0-9+.-]*://', ''),
                   '^[^@/]+@', ''),
                 '^([^/:]+):', '\1/'),
               '^www\.', ''),
             '/+$', ''),
           '\.git$', '');
$$;

alter table public.projects
  add column repository_key text generated always as (public.normalize_repo_url(repository_url)) stored;

comment on column public.projects.repository_key is 'repository_url normalizada; se usa para asignar heartbeats.';

drop index public.projects_repository_url_key;
create unique index projects_repository_key_key on public.projects (repository_key);


-- -----------------------------------------------------------------------------
-- 2. Tokens personales para la extensión del IDE
-- El token en claro solo se muestra una vez (create_developer_token);
-- aquí se guarda su hash SHA-256 en hexadecimal.
-- -----------------------------------------------------------------------------

create table public.developer_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix  text not null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.developer_tokens is 'Tokens con los que la extensión del IDE envía heartbeats.';

create index developer_tokens_user_id_idx on public.developer_tokens (user_id);

alter table public.developer_tokens enable row level security;

create policy "developer_tokens_select_own_or_admin" on public.developer_tokens
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_app_role()) = 'Admin');


-- -----------------------------------------------------------------------------
-- 3. Datos fiscales del cliente (CFDI 4.0) y estado
-- Son opcionales a nivel de tabla porque los clientes USD no los necesitan;
-- issue-invoice los exige antes de timbrar una factura MXN.
-- -----------------------------------------------------------------------------

alter table public.clients
  add column tax_regime          text check (tax_regime ~ '^[0-9]{3}$'),
  add column fiscal_postal_code  text check (fiscal_postal_code ~ '^[0-9]{5}$'),
  add column cfdi_use            text check (cfdi_use ~ '^[A-Z]{1,2}[0-9]{2}$'),
  add column is_active           boolean not null default true;

comment on column public.clients.tax_regime is 'Régimen fiscal SAT del receptor (ej. 601).';
comment on column public.clients.fiscal_postal_code is 'Código postal del domicilio fiscal del receptor.';
comment on column public.clients.cfdi_use is 'Uso del CFDI (ej. G03).';


-- -----------------------------------------------------------------------------
-- 4. Datos de cobro en facturas
-- -----------------------------------------------------------------------------

alter table public.invoices
  add column payment_url          text,
  add column xml_path             text,
  add column pdf_path             text,
  add column sent_at              timestamptz,
  add column paid_at              timestamptz,
  add column issuing_started_at   timestamptz;

comment on column public.invoices.payment_url is 'URL del Payment Link de Stripe (clientes USD).';
comment on column public.invoices.xml_path is 'Ruta del XML timbrado en el bucket invoices.';
comment on column public.invoices.pdf_path is 'Ruta del PDF en el bucket invoices.';
comment on column public.invoices.issuing_started_at is 'Candado para evitar timbrar/cobrar dos veces la misma factura.';

create unique index invoices_external_id_key on public.invoices (external_id) where external_id is not null;


-- -----------------------------------------------------------------------------
-- 5. Datos fiscales del emisor (una sola fila)
-- -----------------------------------------------------------------------------

create table public.company_settings (
  id           boolean primary key default true check (id),
  rfc          text not null check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  legal_name   text not null check (length(trim(legal_name)) > 0),
  tax_regime   text not null check (tax_regime ~ '^[0-9]{3}$'),
  postal_code  text not null check (postal_code ~ '^[0-9]{5}$'),
  updated_at   timestamptz not null default now()
);

comment on table public.company_settings is 'Datos fiscales del emisor para CFDI 4.0.';

create trigger company_settings_set_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

alter table public.company_settings enable row level security;

create policy "company_settings_select_staff" on public.company_settings
  for select to authenticated
  using ((select public.current_app_role()) in ('Admin', 'Finance'));

create policy "company_settings_write_admin" on public.company_settings
  for all to authenticated
  using ((select public.current_app_role()) = 'Admin')
  with check ((select public.current_app_role()) = 'Admin');


-- -----------------------------------------------------------------------------
-- 6. Almacenamiento privado de XML y PDF
-- Solo issue-invoice (service_role) sube archivos; Admin y Finance los leen
-- mediante URLs firmadas.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "invoices_bucket_select_staff" on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and (select public.current_app_role()) in ('Admin', 'Finance'));
