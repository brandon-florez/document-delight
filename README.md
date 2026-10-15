# Nexo IT·Fin (document-delight)

Portal web para empresas de desarrollo de software que **mide automáticamente el tiempo** que cada desarrollador dedica a cada proyecto y lo convierte en **facturas** (USD vía Stripe, MXN vía CFDI 4.0 del SAT).

## Explicación breve del sistema

1. Una extensión del IDE (VS Code / Cursor) envía *heartbeats* (señales de actividad) con la URL del repositorio en el que trabaja el desarrollador.
2. El backend agrupa esas señales en bloques de tiempo (`time_entries`) y los asocia al **proyecto** cuyo `repository_url` coincide. Si pasan más de 3 minutos sin actividad, el bloque se cierra.
3. Cada proyecto pertenece a un **cliente** y tiene una **tarifa por hora**, así que las horas se pueden convertir en montos.
4. Finanzas genera **pre-facturas** con las horas no facturadas, las emite (timbrado CFDI o enlace de pago de Stripe) y las marca como pagadas.

Roles: **Developer** (ve su propio tiempo), **Admin** y **Finance** (clientes, proyectos, dashboard y facturación).

### Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19, TypeScript, TanStack Start / Router / Query, Tailwind CSS 4, shadcn/ui (Radix), Vite 8 |
| Backend | Supabase: PostgreSQL (tablas, RLS y funciones SQL), Auth, Storage y Edge Functions (Deno) |
| Integraciones | Stripe (cobros en USD) y un PAC tipo Facturama (timbrado CFDI en MXN) |
| Editor visual | [Lovable](https://lovable.dev/projects/913b1e73-4323-4518-845f-d68012e6ede2), sincronizado con este repositorio |

### Estructura relevante

```
src/
├── routes/                 Páginas (cada archivo es una ruta: clients.tsx -> /clients)
├── components/             PortalShell y componentes de UI (shadcn)
├── integrations/supabase/  Cliente de Supabase y tipos de la base de datos
└── lib/api/                Consultas a Supabase por módulo (clientes, proyectos, facturas...)
supabase/
├── config.toml             Configuración del proyecto Supabase y de las Edge Functions
├── migrations/             Migraciones SQL (se aplican en orden por fecha)
├── seed.sql                Datos de ejemplo para desarrollo
├── functions/              Edge Functions: heartbeat, issue-invoice, stripe-webhook
└── tests/                  Pruebas de la base de datos (PGlite, sin Docker)
docs/                       PRD y documento de estado del sistema
```

---

## Guía para colaborar

### 1. Herramientas necesarias

| Herramienta | Versión | Para qué | Obligatoria |
| --- | --- | --- | --- |
| [Git](https://git-scm.com/downloads) | Reciente | Clonar y versionar el código | Sí |
| [Node.js](https://nodejs.org/) | **22 LTS** (mínimo 20.19) | Ejecutar el frontend y los scripts | Sí |
| npm | Incluido con Node | Instalar dependencias | Sí |
| Editor (VS Code / Cursor) | — | Desarrollo | Recomendado |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | Se usa con `npx supabase` | Migraciones, Edge Functions, secretos | Para trabajar con la BD |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Reciente | Levantar Supabase en local | Solo para BD local |
| [Deno](https://deno.com/) | Se descarga con `npx` | Probar las Edge Functions | Solo para `test:functions` |

Extensiones recomendadas del editor: **ESLint**, **Prettier**, **Tailwind CSS IntelliSense**.

> El proyecto usa **npm** como gestor de paquetes. Aunque existe un `bun.lock` (generado por Lovable), instala y agrega dependencias con npm para no desincronizar versiones.

### 2. Clonar e instalar

```sh
git clone <url-del-repositorio>
cd document-delight
npm install
```

`npm install` instala todas las librerías declaradas en `package.json` (React, TanStack, Tailwind, Radix, `@supabase/supabase-js`, ESLint, Prettier, etc.). No hace falta instalar ninguna de forma manual.

### 3. Configurar variables de entorno

Copia la plantilla y rellénala (ver la sección [Conectar con Supabase](#conectar-con-la-base-de-datos-supabase)):

```sh
# macOS / Linux
cp .env.example .env
# Windows (PowerShell)
Copy-Item .env.example .env
```

`.env` está en `.gitignore`: **nunca lo subas al repositorio**.

### 4. Ejecutar el proyecto

```sh
npm run dev
```

Abre la URL que muestra la terminal (normalmente `http://localhost:8080` o `http://localhost:5173`).

### 5. Scripts disponibles

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Sirve el build de producción |
| `npm run lint` | Revisa el código con ESLint |
| `npm run format` | Formatea el código con Prettier |
| `npm run test:db` | Aplica migraciones + seed en un Postgres en memoria (PGlite) y prueba RLS y funciones SQL |
| `npm run test:functions` | Pruebas unitarias de las Edge Functions con Deno |

### 6. Flujo de trabajo en equipo

1. Actualiza tu copia: `git pull origin main`.
2. Crea una rama por tarea: `git checkout -b feature/nombre-corto`.
3. Haz commits pequeños y descriptivos.
4. Antes de subir: `npm run lint`, `npm run test:db` y `npm run build`.
5. Sube tu rama (`git push -u origin feature/nombre-corto`) y abre un Pull Request hacia `main`.

Reglas importantes:

- **No hagas `git push --force` ni reescribas commits ya publicados** (rebase, amend, squash). El repositorio está conectado a Lovable y se perdería el historial del proyecto allí.
- Todo lo que llega a `main` se sincroniza con Lovable: mantén `main` siempre funcionando.
- No edites `src/routeTree.gen.ts` (se genera automáticamente).
- No modifiques migraciones ya aplicadas; crea una nueva (ver más abajo).

---

## Conectar con la base de datos Supabase

El frontend solo necesita **dos variables**: la URL del proyecto y la clave pública (*anon / publishable key*). Se leen en `src/integrations/supabase/client.ts`.

### Opción A: proyecto Supabase en la nube (recomendada para el equipo)

1. Pide al administrador del proyecto que te invite a la organización en [supabase.com](https://supabase.com) (o crea tu propio proyecto si vas a trabajar aislado: **New project**, elige nombre, contraseña de la BD y región).
2. Entra al proyecto y ve a **Project Settings → API** (o **Connect → App Frameworks**).
3. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** / **publishable key** → `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Pégalas en tu archivo `.env`:

   ```env
   VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
   ```

5. Reinicia `npm run dev` (Vite solo lee `.env` al arrancar).
6. Si la configuración es incorrecta, la consola del navegador mostrará: *"VITE_SUPABASE_URL y/o VITE_SUPABASE_PUBLISHABLE_KEY faltan o no son válidas"*.

> **Nunca** pongas la `service_role key` en `.env` ni en el frontend: salta todas las políticas de seguridad (RLS). Solo la usan las Edge Functions, y Supabase se la inyecta automáticamente.

### Opción B: Supabase local con Docker

1. Instala y abre **Docker Desktop**.
2. En la raíz del proyecto ejecuta:

   ```sh
   npx supabase start
   ```

   La primera vez descarga las imágenes (tarda unos minutos). Al terminar muestra `API URL`, `anon key` y `Studio URL`.
3. Coloca esos valores en `.env`:

   ```env
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon key que mostró la terminal>
   ```

4. Abre Supabase Studio local en `http://127.0.0.1:54323` para ver tablas y datos.
5. Para detenerlo: `npx supabase stop`.

### Crear usuarios y asignar roles

1. En Supabase: **Authentication → Users → Add user** (email y contraseña, marcando *Auto Confirm User*).
2. Un trigger (`on_auth_user_created`) crea automáticamente su fila en `public.profiles` con rol **Developer**.
3. Para convertirlo en Admin o Finance, en **SQL Editor** ejecuta:

   ```sql
   update public.profiles set role = 'Admin'   -- o 'Finance'
   where id = (select id from auth.users where email = 'correo@empresa.com');
   ```

---

## Ejecutar las migraciones SQL

Las migraciones están en `supabase/migrations/` y **deben aplicarse en orden** (el prefijo es la fecha):

1. `20261004000000_initial_schema.sql` — tipos, tablas (`profiles`, `clients`, `projects`, `time_entries`, `invoices`, `invoice_lines`), trigger de perfiles y políticas RLS.
2. `20261006000000_backend_support.sql` — normalización de URLs de repositorio, tokens del IDE, datos fiscales CFDI, datos de cobro y bucket de Storage.
3. `20261006000100_functions.sql` — funciones de negocio (heartbeats, tokens, `generate_invoices`) y vistas para dashboard y "Mi tiempo".

Después, opcionalmente, `supabase/seed.sql` carga datos de ejemplo (emisor de pruebas del SAT, clientes y proyectos). **No lo ejecutes en producción.**

### Opción 1: con Supabase CLI en un proyecto en la nube (recomendada)

1. Inicia sesión (abre el navegador para autorizar):

   ```sh
   npx supabase login
   ```

2. Obtén el **Project ref**: es el identificador de la URL (`https://<project-ref>.supabase.co`) o está en **Project Settings → General**.
3. Vincula el repositorio con el proyecto (pide la contraseña de la base de datos):

   ```sh
   npx supabase link --project-ref <project-ref>
   ```

4. Revisa qué migraciones faltan por aplicar:

   ```sh
   npx supabase migration list
   ```

5. Aplica las migraciones pendientes:

   ```sh
   npx supabase db push
   ```

   Para incluir además los datos de ejemplo (solo en entornos de desarrollo):

   ```sh
   npx supabase db push --include-seed
   ```

6. Verifica en **Table Editor** que existan las tablas.

### Opción 2: manualmente desde el SQL Editor del dashboard

Útil si no puedes instalar la CLI.

1. Abre tu proyecto en [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Copia **todo** el contenido de `20261004000000_initial_schema.sql`, pégalo y pulsa **Run**. Espera el mensaje *Success*.
3. Repite con `20261006000000_backend_support.sql`.
4. Repite con `20261006000100_functions.sql`.
5. (Opcional, solo desarrollo) Ejecuta `supabase/seed.sql`.

> Con este método Supabase **no registra** qué migraciones se aplicaron. No mezcles después con `db push` en el mismo proyecto sin antes marcarlas como aplicadas (`npx supabase migration repair --status applied <versión>`).

### Opción 3: en Supabase local

Con `npx supabase start` en marcha:

```sh
npx supabase db reset
```

Borra la base local, aplica **todas** las migraciones en orden y ejecuta `seed.sql` (habilitado en `supabase/config.toml`).

### Crear una nueva migración

Cuando necesites cambiar el esquema, no edites las migraciones existentes:

```sh
npx supabase migration new nombre_descriptivo
```

Esto crea `supabase/migrations/<fecha>_nombre_descriptivo.sql`. Escribe ahí tu SQL y luego:

1. Valídalo con `npm run test:db` (y/o `npx supabase db reset` en local).
2. Si cambiaste tablas o vistas, regenera los tipos del frontend:

   ```sh
   npx supabase gen types typescript --project-id <project-ref> > src/integrations/supabase/types.ts
   ```

3. Súbelo en tu Pull Request; una vez aprobado, se aplica con `npx supabase db push`.

---

## Edge Functions (opcional)

| Función | Uso | Requiere JWT |
| --- | --- | --- |
| `heartbeat` | Recibe la telemetría del IDE (se autentica con un token personal del desarrollador) | No |
| `issue-invoice` | Emite una factura: timbrado CFDI (MXN) o enlace de Stripe (USD) | Sí |
| `stripe-webhook` | Recibe la confirmación de pago de Stripe (verifica la firma) | No |

Configurar secretos y desplegar:

```sh
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... PAC_USER=... PAC_PASSWORD=... PAC_BASE_URL=https://apisandbox.facturama.mx
npx supabase functions deploy heartbeat
npx supabase functions deploy issue-invoice
npx supabase functions deploy stripe-webhook
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase automáticamente.

---

## Documentación adicional

- `docs/prd.md` y `docs/prdavanzado.md`: requisitos del producto.
- `docs/ESTADO_DEL_SISTEMA.md`: diagnóstico del estado del sistema.
