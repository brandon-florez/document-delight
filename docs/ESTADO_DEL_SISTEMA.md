# Estado actual del sistema — Nexo IT·Fin

> Documento de diagnóstico del repositorio `document-delight`.
> Última actualización: 24 de octubre de 2026 (primera versión: 27 de septiembre de 2026).
> Escrito en lenguaje sencillo; al final hay un pequeño glosario con los términos técnicos que aparecen.

---

## 1. Resumen en pocas palabras

**Nexo IT·Fin** es un portal web pensado para empresas de desarrollo de software. Su idea central es:

1. Medir **automáticamente** cuánto tiempo pasa cada programador trabajando en cada proyecto (sin cronómetros manuales).
2. Relacionar ese tiempo con el **cliente** y la **tarifa por hora** del proyecto.
3. Convertir esas horas en **facturas** (en dólares o pesos mexicanos) y cobrarlas.

**Estado actual: el sistema funciona de punta a punta.**

- Hay **base de datos real** (Supabase) con clientes, proyectos, usuarios, registros de tiempo y facturas.
- Hay **inicio de sesión real** con correo y contraseña, y cada rol (Developer, Admin, Finance) solo ve lo que le corresponde.
- Una **extensión para el editor de código** (VS Code / Cursor) mide la actividad del programador y la envía al portal.
- El portal **calcula las horas**, genera los **borradores de factura** del mes y permite **timbrar** (pesos, ante el SAT vía Facturama) o **cobrar** (dólares, con un enlace de pago de Stripe).
- Ya se probó con éxito: registro de actividad desde el editor, generación de facturas, timbrado de una factura en MXN y creación de un enlace de pago en USD.

Lo que queda pendiente son detalles de acabado y algunas pantallas opcionales (ver secciones 9 y 10).

El proyecto fue generado con **Lovable** (una herramienta que crea aplicaciones a partir de instrucciones escritas) y se mantiene sincronizado con ella a través de GitHub. Trabajan en él dos personas: una en la **plataforma y el cobro**, otra en la **extensión de telemetría** (ver `docs/actividades_por_persona.md`).

---

## 2. ¿Qué puede hacer hoy un usuario?

| Pantalla | Dirección | ¿Quién entra? | ¿Qué funciona de verdad? |
| --- | --- | --- | --- |
| Inicio | `/` | Todos | Redirige al login. |
| Iniciar sesión | `/login` | Todos | Valida correo y contraseña contra Supabase y lleva a cada quien a su pantalla. |
| Dashboard ejecutivo | `/dashboard` | Admin, Finance | Indicadores reales, horas por repositorio, tiempo sin facturar, generar pre-facturas y exportar a CSV. |
| Mi tiempo | `/my-time` | Todos | Horas reales de la semana, gráfico por día, bitácora y tokens para la extensión del editor. |
| Clientes | `/clients` | Admin, Finance | Buscar, filtrar por moneda, paginar, crear clientes (con datos fiscales) y pausarlos/activarlos. |
| Proyectos | `/projects` | Admin, Finance | Buscar, paginar, crear proyectos con su repositorio y tarifa, y activarlos/desactivarlos. |
| Facturación | `/invoices` | Admin, Finance | Generar cierre mensual, filtrar por estado, ver la factura con sus conceptos, timbrar/cobrar, descargar XML/PDF, abrir el enlace de pago y marcar como pagada. |

### Detalle de cada pantalla

**Iniciar sesión (**`/login`**)**

- Formulario de correo y contraseña conectado a **Supabase Auth**. Ya no hay selector de rol: el rol se lee del perfil del usuario en la base de datos.
- Según el rol, lleva a **Mi tiempo** (Developer) o al **Dashboard** (Admin y Finance).
- Si el archivo `.env` no tiene la dirección y la clave de Supabase, la pantalla muestra un aviso amarillo explicando qué falta, en vez de romperse.
- Los usuarios se crean desde el panel de Supabase (Authentication → Users). Todo usuario nuevo empieza como **Developer**; para hacerlo Admin o Finance se cambia su rol en la tabla `profiles`.

**Dashboard ejecutivo (**`/dashboard`**)**

- Cuatro tarjetas con cifras **calculadas por la base de datos**: facturación en USD, facturación en MXN, horas no facturadas y clientes activos.
- Barras con las horas de la semana por repositorio.
- Lista del **tiempo no facturado** del mes, por proyecto, con el botón **Generar Pre-Facturas** (crea o actualiza los borradores del mes).
- Botón **Exportar**: descarga un archivo CSV con el tiempo no facturado del mes.
- Tabla de las últimas facturas y vista previa de una de ellas.

**Mi tiempo (**`/my-time`**)**

- Saluda al usuario real que inició sesión y muestra sus horas de la semana.
- Muestra su **proyecto principal** de la semana (el que más tiempo acumula) y su repositorio.
- Gráfico de lunes a viernes con las horas reales de cada día.
- "Time Log": bitácora de solo lectura con fecha, proyecto, hora de inicio, hora de fin y total. Se alimenta sola desde la extensión del editor.
- **Tokens del IDE**: el programador genera aquí un token (empieza con `nxo_`, se muestra una sola vez) para conectar su editor. Puede ver sus tokens y revocarlos.

**Clientes (**`/clients`**)**

- Tabla con nombre, RFC, moneda, correo de facturación, estado y monto del mes, leída de la base de datos.
- **Buscador** (por nombre o RFC), **filtro por moneda** y **paginación** de 10 en 10, todos funcionando.
- Botón **Nuevo Cliente** con validación de campos (por ejemplo, formato del RFC y del correo).
  - Si la moneda es **MXN**, pide además los datos fiscales que exige el SAT: **régimen fiscal** (3 dígitos), **código postal** (5 dígitos) y **uso de CFDI** (por ejemplo `G03`).
- Botón para **pausar o activar** un cliente.

**Proyectos (**`/projects`**)**

- Tabla con nombre, cliente, URL del repositorio, tarifa por hora, estado y horas del mes.
- **Buscador** y **paginación** funcionando.
- Botón **Nuevo Proyecto** con validación (tarifa mayor que cero, cliente obligatorio, URL del repositorio).
- La **URL del repositorio** es la pieza clave: es lo que enlaza el tiempo medido por la extensión con el proyecto correcto. El sistema entiende la misma URL escrita de varias formas (`https://…`, `git@github.com:…`, con o sin `.git`) y no permite dos proyectos con el mismo repositorio.
- Botón para **activar o desactivar** un proyecto. El tiempo de proyectos inactivos no se registra.

**Facturación (**`/invoices`**)**

- A la izquierda, la lista de facturas con pestañas para filtrar por estado: **Todas, Borrador, Enviadas y Pagadas**.
- A la derecha, la vista previa de la factura elegida con sus **conceptos reales** (proyecto, horas, tarifa y subtotal), subtotal, impuestos y total.
- **Generar Cierre**: elige mes y año, agrupa el tiempo sin facturar por cliente, lo multiplica por la tarifa de cada proyecto y crea o actualiza los borradores.
- **Timbrar / Cobrar** (solo en borradores):
  - **Cliente en MXN**: timbra la factura ante el SAT (CFDI 4.0) a través de **Facturama**. Guarda el **XML** y el **PDF** oficiales, que se pueden descargar con sus botones.
  - **Cliente en USD**: crea un **enlace de pago de Stripe**. El botón **Enlace de pago** lo abre.
  - En ambos casos la factura pasa a **Enviada**.
- **Marcar pagada** (en facturas enviadas): cambio manual a **Pagada**. Además, cuando el cliente paga el enlace de Stripe, la factura pasa a Pagada sola (ver sección 4).

### Elementos comunes a las pantallas internas

Todas las pantallas (menos el login) comparten un mismo "marco":

- **Menú lateral** (en computadora) o **barra inferior** (en celular). Solo muestra las secciones que el rol del usuario puede abrir.
- **Usuario real** en la esquina: nombre, iniciales, rol y correo de quien inició sesión.
- **Protección por rol**: si un Developer escribe a mano `/invoices` u otra dirección que no le corresponde, el sistema lo regresa a Mi tiempo. Si no hay sesión, lo manda al login.
- Botón para **cerrar sesión** de verdad (borra la sesión y vuelve al login).
- **Avisos emergentes** (esquina superior derecha) para confirmar acciones o mostrar errores, por ejemplo "Factura marcada como pagada".

---

## 3. Parte visual (Frontend)

El frontend es todo lo que el usuario ve y toca en el navegador.

### Tecnologías principales

| Herramienta | Para qué se usa, en palabras simples |
| --- | --- |
| **React 19** | La base con la que se construyen las pantallas, pieza por pieza. |
| **TypeScript** | El lenguaje de programación. Es JavaScript con "reglas extra" que ayudan a evitar errores. |
| **TanStack Router** | Decide qué pantalla mostrar según la dirección y protege las páginas por rol. |
| **TanStack Query** | Pide los datos a la base de datos, los guarda en memoria y los refresca después de cada cambio. |
| **Supabase (cliente web)** | Conecta el navegador con la base de datos, el inicio de sesión y los archivos guardados. |
| **React Hook Form + Zod** | Formularios con validación (RFC, correo, tarifa, datos fiscales). |
| **Sonner** | Avisos emergentes de éxito o error. |
| **Tailwind CSS 4** | Da estilo (colores, tamaños, espacios) escribiendo clases cortas directamente en el código. |
| **shadcn/ui + Radix UI** | Un catálogo de piezas visuales ya hechas: botones, ventanas emergentes, selectores… |
| **Lucide** | La colección de iconos. |
| **Google Fonts** | Tipografías *Inter* (texto normal) y *JetBrains Mono* (números y datos). |

### Diseño visual

- Paleta basada en **azul** como color principal, **verde menta** para estados positivos, **ámbar** para avisos, **rosa** para alertas y **violeta** como acento.
- Tarjetas con esquinas redondeadas, sombras suaves y animaciones de entrada.
- Diseño **adaptable**: en pantallas pequeñas el menú lateral se oculta y aparece una barra de navegación inferior.
- Mensajes de estado en cada lista: "Cargando…", "No hay resultados" o el error correspondiente.

---

## 4. Parte del servidor (Backend)

El backend vive completo en **Supabase**, un servicio en la nube que reúne base de datos, inicio de sesión, almacenamiento de archivos y pequeñas funciones de servidor.

### 4.1 Base de datos (PostgreSQL)

Las tablas se crean con tres archivos de "migración" en `supabase/migrations/`.

| Tabla | Qué guarda |
| --- | --- |
| `profiles` | Un perfil por usuario: nombre, correo, **rol** y costo por hora. Se crea solo al registrar al usuario. |
| `clients` | Clientes: nombre, RFC, moneda, correo de facturación, datos fiscales (régimen, código postal, uso de CFDI) y si está activo. |
| `projects` | Proyectos: nombre, cliente, URL del repositorio, tarifa por hora y estado (activo/inactivo). |
| `time_entries` | Bloques de tiempo: quién, qué proyecto, fecha, inicio, fin, minutos, nivel de actividad y a qué factura quedaron asignados. |
| `invoices` | Facturas: cliente, mes y año, moneda, totales, estado (Borrador, Enviada, Pagada), folio externo, enlace de pago, rutas del XML/PDF y fechas de envío y pago. |
| `invoice_lines` | Conceptos de cada factura: proyecto, horas, tarifa y subtotal. |
| `developer_tokens` | Tokens de la extensión del editor. Solo se guarda una "huella" cifrada del token, nunca el token original. |
| `company_settings` | Datos fiscales de la empresa que emite las facturas: RFC, razón social, régimen y código postal. Es una sola fila. |

**Seguridad por filas:** cada tabla tiene reglas que dicen quién puede leer o modificar qué. Por ejemplo, un Developer solo ve su propio tiempo y sus propios tokens; solo Admin y Finance ven clientes y facturas; solo Admin cambia los datos del emisor.

**Archivo de ejemplo (`supabase/seed.sql`):** carga clientes, proyectos y el emisor de pruebas del SAT (`EKU9003173C9`, ESCUELA KEMPER URGATE) cuando se usa una base de datos local.

### 4.2 Funciones dentro de la base de datos

| Función | Qué hace |
| --- | --- |
| `register_heartbeat` | Recibe una señal de actividad. Si el repositorio pertenece a un proyecto activo, **alarga el bloque de tiempo** actual (si la señal llega a 3 minutos o menos de la anterior) o **abre uno nuevo**. Rechaza señales con fecha futura. |
| `register_heartbeat_with_token` | Igual que la anterior, pero primero identifica al programador por su token. Solo la puede usar el servidor. |
| `create_developer_token` / `revoke_developer_token` | Crea un token nuevo para la extensión (lo muestra una sola vez) o lo invalida. |
| `generate_invoices` | Cierre mensual: junta el tiempo sin facturar del mes por cliente, crea o actualiza el borrador, arma sus conceptos y recalcula totales. No toca facturas ya enviadas o pagadas. |
| `normalize_repo_url` | Convierte cualquier forma de escribir la URL de un repositorio en una sola forma estándar. |

**Vistas** (consultas guardadas que alimentan las pantallas): tiempo sin facturar por proyecto, horas por repositorio, semana del usuario actual e indicadores del dashboard.

### 4.3 Funciones de servidor (Edge Functions)

Pequeños programas que corren en los servidores de Supabase (carpeta `supabase/functions/`).

| Función | Qué hace |
| --- | --- |
| `heartbeat` | Recibe las señales de la extensión del editor. Valida el token y el contenido, y responde: **204** registrado, **202** repositorio no registrado en un proyecto activo, **401** token inválido, **422** datos mal formados. |
| `issue-invoice` | Botón "Timbrar / Cobrar". Solo Admin o Finance. Evita que se procese dos veces la misma factura. **MXN**: arma el CFDI 4.0, lo timbra con Facturama y guarda el XML y el PDF en el almacenamiento privado `invoices`. **USD**: crea el precio y el enlace de pago en Stripe. Después marca la factura como Enviada. |
| `stripe-webhook` | Stripe la llama cuando un cliente paga. Verifica que el aviso sea auténtico y marca la factura como **Pagada**. |

**Piezas compartidas** (`supabase/functions/_shared/`): respuestas de error estándar, validación de la señal de actividad, armado del CFDI (IVA 16 %, pago en parcialidades "PPD", clave de servicio y unidad "hora"), conexión con Facturama y con Stripe.

### 4.4 Servicios externos y secretos

| Servicio | Para qué | Dónde se configura |
| --- | --- | --- |
| **Supabase** | Base de datos, usuarios, archivos y funciones. | `.env` local: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. |
| **Facturama** (sandbox) | PAC que timbra los CFDI ante el SAT, en modo "multiemisor". | Secretos de Supabase: `PAC_USER`, `PAC_PASSWORD` (y opcional `PAC_BASE_URL`). La cuenta de pruebas ya tiene cargado el certificado de sello digital (CSD) de pruebas de `EKU9003173C9`, vigente hasta mayo de 2027. |
| **Stripe** (modo prueba) | Enlaces de pago para clientes en dólares. | Secretos de Supabase: `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`. |

> **Importante:** las funciones de servidor **no leen el archivo `.env` local**. Las claves de Stripe y Facturama se suben a Supabase con `npx supabase secrets set …` o desde el panel (Edge Functions → Secrets). La clave `service_role` nunca debe ir en el `.env` ni en el frontend.

### 4.5 Infraestructura heredada de la plantilla

- **TanStack Start**: arma las páginas públicas en el servidor antes de enviarlas. Las páginas internas se arman en el navegador porque dependen de la sesión.
- **Nitro**: prepara la aplicación para publicarse; configurada para **Cloudflare**.
- **Manejo de errores**: muestra una página amable si algo falla en el servidor.
- **Protección CSRF**: impide que otras páginas web hagan peticiones falsas en nombre del usuario.

---

## 5. Extensión del editor de código (telemetría)

Vive en `extensions/vscode/` y funciona en **VS Code** y **Cursor**.

**Cómo se usa:**

1. En el portal, en **Mi tiempo**, el programador genera un token.
2. En el editor ejecuta el comando **"Nexo: conectar"** y pega el token. Se guarda en el almacén cifrado del editor, nunca en el repositorio.
3. A partir de ahí la extensión trabaja sola.

**Qué hace:**

- Cada **45 segundos**, si el programador escribió algo desde el envío anterior, manda una señal ("heartbeat") a la función `heartbeat` con la URL del repositorio abierto (la toma de `git remote origin`).
- **No envía nada** si la ventana del editor no está activa o si pasaron más de **3 minutos sin escribir**, para no inflar el tiempo.
- Muestra su estado en la barra inferior del editor: *en espera*, *sincronizado*, *sin token*, *repo no registrado*, *token rechazado*, *sin conexión*, etc.
- La dirección del servidor se puede cambiar con el ajuste `nexo.heartbeatUrl`.

**Para probarla en desarrollo:** abrir la carpeta `extensions/vscode`, ejecutar `npm install` y `npm run compile`, y pulsar **F5** ("Run Extension").

---

## 6. Arquitectura (cómo está organizado por dentro)

### Vista general

```
 Editor del programador (VS Code / Cursor)
   └─ Extensión Nexo ──(señal cada 45 s con token)──┐
                                                    ▼
 Navegador del usuario                   ┌───────────────────────────┐
   │                                     │  SUPABASE (nube)           │
   ▼                                     │                            │
 ┌─────────────────────────────┐         │  Edge Functions:           │
 │  Páginas (routes/)          │         │   heartbeat                │
 │   login, _authed/*          │◄───────►│   issue-invoice ──► Facturama (SAT)
 │  PortalShell (marco)        │  datos  │   stripe-webhook ◄── Stripe │
 │  lib/api (consultas)        │  y      │                            │
 │  lib/auth (sesión y roles)  │  sesión │  Base de datos PostgreSQL  │
 └─────────────────────────────┘         │   tablas + reglas por rol  │
                                         │   funciones + vistas       │
                                         │  Auth (usuarios)           │
                                         │  Storage (XML y PDF)       │
                                         └───────────────────────────┘
```

### Ideas clave de la arquitectura

- **Cada archivo dentro de** `src/routes/` **es una página.** Las páginas internas están dentro de `src/routes/_authed/`, una "capa" que comprueba la sesión y el rol antes de mostrarlas.
- **Toda la lógica de negocio importante vive en la base de datos** (cálculo de horas, cierre mensual, reglas de acceso). Así las reglas se cumplen aunque alguien intente saltarse el portal.
- **Las operaciones con terceros** (Facturama, Stripe) y la recepción de la telemetría van en funciones de servidor, donde los secretos están protegidos.
- **Las pantallas no guardan datos fijos**: todo se pide a Supabase mediante las funciones de `src/lib/api/`.
- **La extensión y el portal solo comparten un "contrato"**: el formato de la señal de actividad definido en `supabase/functions/_shared/heartbeat.ts`.

---

## 7. Estructura de archivos

```
document-delight/
├── docs/                         Documentación (PRD, este documento, reparto de actividades).
├── extensions/vscode/            ← EXTENSIÓN DEL EDITOR
│   ├── src/extension.ts          Activa la extensión y el comando "Nexo: conectar".
│   ├── src/activityTracker.ts    Detecta actividad y envía las señales.
│   ├── src/repository.ts         Lee la URL del repositorio (git remote origin).
│   ├── src/token.ts              Valida y guarda el token.
│   └── package.json              Configuración de la extensión.
├── supabase/                     ← BACKEND
│   ├── config.toml               Configuración del proyecto y de las funciones.
│   ├── migrations/               Scripts SQL: tablas, reglas, funciones y vistas.
│   ├── functions/
│   │   ├── heartbeat/            Recibe la telemetría.
│   │   ├── issue-invoice/        Timbra (MXN) o crea el enlace de pago (USD).
│   │   ├── stripe-webhook/       Marca facturas como pagadas.
│   │   └── _shared/              Piezas comunes (Facturama, Stripe, CFDI, validaciones) y sus pruebas.
│   ├── tests/                    Pruebas automáticas de la base de datos.
│   └── seed.sql                  Datos de ejemplo para desarrollo local.
├── public/                       Icono y robots.txt.
├── src/
│   ├── routes/                   ← LAS PÁGINAS
│   │   ├── __root.tsx            Marco general, avisos emergentes, página 404 y de error.
│   │   ├── index.tsx             "/" → redirige al login.
│   │   ├── login.tsx             "/login"
│   │   ├── _authed.tsx           Capa que exige sesión y revisa el rol.
│   │   └── _authed/              dashboard, my-time, clients, projects, invoices.
│   ├── components/
│   │   ├── portal/PortalShell.tsx     Marco del portal y piezas propias.
│   │   ├── portal/InvoicePreview.tsx  Vista previa de factura y etiqueta de estado.
│   │   └── ui/                   46 piezas visuales genéricas.
│   ├── integrations/supabase/
│   │   ├── client.ts             Conexión con Supabase (con aviso si falta configuración).
│   │   └── types.ts              Descripción de las tablas para TypeScript.
│   ├── lib/
│   │   ├── api/                  Consultas y acciones por tema (clientes, proyectos, tiempo, facturas, dashboard).
│   │   ├── auth.ts               Sesión, roles y permisos por página.
│   │   ├── format.ts             Formato de dinero, horas, fechas (zona horaria de Ciudad de México) y folios.
│   │   └── …                     Utilidades y manejo de errores de la plantilla.
│   ├── router.tsx, server.ts, start.ts, styles.css
│   └── routeTree.gen.ts          Mapa de páginas generado AUTOMÁTICAMENTE (no editar).
├── .env.example                  Plantilla de variables de entorno (el .env real no se sube a Git).
├── package.json                  Librerías y comandos.
└── AGENTS.md, README.md          Advertencias para asistentes de IA y descripción del proyecto.
```

---

## 8. Funciones y piezas principales

### Piezas propias del portal

| Pieza | Qué hace |
| --- | --- |
| `PortalShell` | Marco de todas las páginas internas: menú filtrado por rol, usuario real, cabecera y cerrar sesión. |
| `KpiCard`, `Panel`, `SectionTitle`, `StatusDot`, `LiveSyncPill` | Tarjetas, cajas, títulos e indicadores visuales. |
| `SearchField` | Buscador que filtra de verdad (Clientes y Proyectos). |
| `Pagination` | Controles "anterior / siguiente" con "Mostrando X–Y de Z". |
| `StateMessage` | Mensaje de "cargando", "sin resultados" o error. |
| `InvoicePreview` | Documento de la factura con sus conceptos reales, subtotal, IVA y total. |
| `StatusBadge` | Etiqueta de color: Borrador, Enviada o Pagada. |

### Sesión y permisos (`src/lib/auth.ts`)

| Función | Qué hace |
| --- | --- |
| `currentProfileQuery` / `useCurrentProfile` | Obtiene el perfil (nombre, rol) de quien inició sesión. |
| `canAccess` | Dice si un rol puede abrir una página. |
| `homeForRole` | Pantalla de inicio de cada rol. |
| `signOut` | Cierra la sesión y limpia los datos en memoria. |

### Consultas y acciones (`src/lib/api/`)

| Archivo | Funciones |
| --- | --- |
| `clients.ts` | Listar con búsqueda/filtro/paginación, opciones para selectores, crear, pausar/activar. |
| `projects.ts` | Listar, horas del mes por proyecto, crear, activar/desactivar. |
| `timeEntries.ts` | Semana del usuario, bitácora, tokens (listar, crear, revocar). |
| `invoices.ts` | Listar por estado, conceptos, generar cierre, timbrar/cobrar, marcar pagada, abrir XML/PDF. |
| `dashboard.ts` | Indicadores, tiempo sin facturar del mes y horas por repositorio. |

### Componentes genéricos (`src/components/ui/`)

Hay **46** piezas listas para usar; **6 se usan hoy**: botón, campo de texto, etiqueta, selector, ventana emergente y avisos (`sonner`). El botón tiene un estilo propio llamado `clay` (azul con sombra) para las acciones principales.

---

## 9. Librerías y comandos

### Se usan actualmente

| Librería | Uso |
| --- | --- |
| `react`, `react-dom` | Base de las pantallas. |
| `@tanstack/react-router`, `@tanstack/react-start` | Páginas, navegación, protección por rol y servidor. |
| `@tanstack/react-query` | Consultas a la base de datos y refresco automático. |
| `@supabase/supabase-js` | Conexión con Supabase (datos, sesión, archivos, funciones). |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Formularios con validación. |
| `sonner` | Avisos emergentes. |
| `tailwindcss`, `tw-animate-css` | Estilos y animaciones. |
| `@radix-ui/*` | Comportamiento accesible de ventanas y selectores. |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Variantes y combinación de estilos. |
| `lucide-react` | Iconos. |
| `stripe` (en las funciones de servidor) | Crear enlaces de pago y verificar avisos de pago. |

### Herramientas de desarrollo y pruebas

| Herramienta | Para qué sirve |
| --- | --- |
| **Vite 8** | Arranca la app en modo desarrollo y la empaqueta. |
| **Supabase CLI** (`npx supabase`) | Aplicar migraciones, subir secretos y desplegar funciones. |
| **PGlite** | Base de datos PostgreSQL en memoria para probar las migraciones sin conexión. |
| **Deno** | Ejecuta las pruebas de las funciones de servidor. |
| **ESLint / Prettier** | Revisión y formato del código. |

### Comandos disponibles

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Arranca la app en modo desarrollo. |
| `npm run build` | Crea la versión final para publicar. |
| `npm run test:db` | Pruebas de la base de datos (telemetría, cierre mensual, permisos). |
| `npm run test:functions` | Pruebas de las funciones de servidor (validación de señales, armado del CFDI). |
| `npm run lint` / `npm run format` | Revisa / da formato al código. |
| `npx supabase db push` | Aplica las migraciones al proyecto de Supabase. |
| `npx supabase functions deploy <nombre>` | Publica una función de servidor. |

---

## 10. Observaciones y detalles a corregir

Detalles detectados en el primer análisis que **siguen pendientes**:

1. **Idiomas mezclados.** La página se declara en inglés (`lang="en"`), las pantallas de error y "404" siguen en inglés ("This page didn't load", "Page not found", "Try again") y la bitácora de Mi tiempo se titula "Time Log".
2. **Dos instaladores de paquetes a la vez.** Existen `bun.lock` (Bun) y `package-lock.json` (npm). Lo recomendable es elegir uno para evitar diferencias de versiones.
3. **Piezas y librerías sin usar.** 40 de los 46 componentes visuales no se usan, igual que varias librerías de la plantilla (`recharts`, `date-fns`, `react-day-picker`, `cmdk`, `embla-carousel-react`, `vaul`, `input-otp`, `react-resizable-panels`). No es grave, pero agregan peso y ruido.
4. **Modo oscuro incompleto.** Los estilos lo definen a medias, pero no hay forma de activarlo y no incluye todos los colores del portal.

---

## 11. ¿Qué falta para terminar el sistema?

Pendientes del primer análisis que **aún no están completos**:

1. **Editar clientes y proyectos.** Hoy se pueden crear y pausar/activar, pero no hay forma de **corregir sus datos** desde el portal (por ejemplo, un RFC o un régimen fiscal mal capturado). Hay que hacerlo directamente en Supabase.
2. **Búsqueda y exportación en el resto de pantallas.** Clientes y Proyectos ya tienen buscador y paginación, y el Dashboard exporta a CSV el tiempo no facturado. Faltan buscador y paginación en **Facturación**, y exportar facturas o bitácoras de tiempo.

Pendientes nuevos detectados en esta revisión:

3. **Pantalla de datos del emisor (solo Admin).** La tabla `company_settings` y sus permisos ya existen, pero la fila se carga a mano. Falta la pantalla para leer y editar RFC, razón social, régimen y código postal.
4. **Proyecto de Supabase común para el equipo.** La extensión trae como dirección predeterminada el proyecto de Supabase de la otra persona del equipo. Hay que acordar un solo proyecto y actualizar ese valor en `extensions/vscode/package.json` y `src/activityTracker.ts`.
5. **Confirmar el pago automático con Stripe.** El webhook ya está programado; falta comprobar que, al pagar un enlace de prueba, la factura pase sola a Pagada (requiere que el webhook esté dado de alta en el dashboard de Stripe con su `whsec_…`).
6. **Limpieza del repositorio.** La carpeta `supabase/.temp/` (archivos internos del CLI de Supabase) se subió a Git; conviene quitarla y agregarla al `.gitignore`.
7. **Publicar la extensión.** Hoy se ejecuta en modo desarrollo (F5). Para que la usen otros programadores hay que empaquetarla (archivo `.vsix`) o publicarla.

---

## 12. Glosario

| Término | Significado sencillo |
| --- | --- |
| **Frontend** | Lo que el usuario ve y usa en el navegador. |
| **Backend** | La parte "trasera" que guarda datos, aplica reglas y habla con otros servicios. |
| **Supabase** | Servicio en la nube que ofrece base de datos, inicio de sesión, archivos y funciones de servidor. |
| **Migración** | Script que crea o modifica las tablas de la base de datos de forma ordenada. |
| **Edge Function** | Pequeño programa que corre en los servidores de Supabase. |
| **Secreto** | Clave privada (por ejemplo, de Stripe) guardada en el servidor, nunca en el navegador. |
| **Componente** | Una pieza reutilizable de la pantalla (un botón, una tarjeta, una tabla). |
| **Ruta** | Una dirección dentro de la app, como `/clients`. |
| **Telemetría** | Medición automática de actividad; aquí, del tiempo que el programador pasa en cada proyecto. |
| **Heartbeat** | "Latido": una pequeña señal periódica que dice "sigo trabajando". |
| **Token** | Contraseña larga y única que identifica a la extensión de un programador ante el portal. |
| **Repositorio** | Carpeta en la nube (por ejemplo, en GitHub) donde vive el código de un proyecto. |
| **KPI** | Indicador clave; una cifra importante para el negocio. |
| **Pre-factura / Borrador** | Factura antes de emitirla oficialmente. |
| **Cierre mensual** | Proceso que convierte el tiempo sin facturar de un mes en borradores de factura. |
| **Timbrar / CFDI** | En México, validar una factura electrónica ante el SAT para que tenga validez fiscal. CFDI 4.0 es la versión vigente. |
| **PAC** | Proveedor autorizado por el SAT para timbrar facturas; aquí, Facturama. |
| **CSD** | Certificado de sello digital: el "sello" con el que la empresa firma sus facturas. |
| **Stripe / Payment Link** | Plataforma para cobrar con tarjeta por internet / enlace de pago que se envía al cliente. |
| **Webhook** | Aviso automático que un servicio (Stripe) envía al portal cuando pasa algo, como un pago. |
| **RFC** | Registro Federal de Contribuyentes; identificador fiscal en México. |
| **CSRF** | Tipo de ataque donde otra página intenta actuar en tu nombre; el sistema ya trae protección. |
| **Lovable** | Herramienta que genera aplicaciones a partir de instrucciones y se sincroniza con GitHub. |
