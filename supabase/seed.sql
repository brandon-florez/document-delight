-- =============================================================================
-- Datos de ejemplo (coinciden con los datos fijos del frontend actual).
-- Solo para desarrollo local. Los usuarios se crean desde Supabase Auth;
-- por eso aquí no hay profiles ni time_entries.
-- =============================================================================

insert into public.clients (id, name, tax_id, currency, billing_email) values
  ('00000000-0000-0000-0000-000000000101', 'Norte Digital', 'NDI940101H12', 'USD', 'billing@nortedigital.com'),
  ('00000000-0000-0000-0000-000000000102', 'Grupo Andes',   'GAN880411K92', 'MXN', 'finanzas@grupoandes.mx'),
  ('00000000-0000-0000-0000-000000000103', 'Vela Labs',     'VLA010620N35', 'USD', 'ap@velalabs.io'),
  ('00000000-0000-0000-0000-000000000104', 'Cobalto Bank',  'CBA760902M18', 'MXN', 'cfdi@cobalto.mx'),
  ('00000000-0000-0000-0000-000000000105', 'Lumen Health',  'LHE021114P09', 'USD', 'billing@lumen.health');

insert into public.projects (name, repository_url, hourly_rate, status, client_id) values
  ('billing-core',  'github.com/nexo/billing-core',      125.00,  'Active',   '00000000-0000-0000-0000-000000000102'),
  ('api-gateway',   'github.com/nexo/api-gateway',       110.00,  'Active',   '00000000-0000-0000-0000-000000000101'),
  ('mobile-app',    'github.com/vela/mobile-app',         95.00,  'Active',   '00000000-0000-0000-0000-000000000103'),
  ('data-pipeline', 'github.com/cobalto/data-pipeline', 1850.00,  'Inactive', '00000000-0000-0000-0000-000000000104');
