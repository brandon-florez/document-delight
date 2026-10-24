# Estado actual del sistema — Nexo IT·Fin

> Documento de diagnóstico del repositorio `document-delight`.
> Fecha del análisis: 27 de septiembre de 2026.
> Escrito en lenguaje sencillo; al final hay un pequeño glosario con los términos técnicos que aparecen.

---

## 1. Resumen en pocas palabras

**Nexo IT·Fin** es un portal web pensado para empresas de desarrollo de software. Su idea central es:

1. Medir **automáticamente** cuánto tiempo pasa cada programador trabajando en cada proyecto (sin cronómetros manuales).
2. Relacionar ese tiempo con el **cliente** y la **tarifa por hora** del proyecto.
3. Convertir esas horas en **facturas** (en dólares o pesos mexicanos) y cobrarlas.

**Estado actual: es una maqueta visual navegable (un prototipo de pantallas).**

- Las pantallas existen y se ven terminadas.
- Se puede navegar entre ellas.
- **Todos los datos que se muestran están escritos a mano dentro del código** (son de ejemplo).
- **No hay base de datos, no hay inicio de sesión real, no se guarda nada y los botones de acción no hacen nada todavía.**

Dicho de otra forma: está lista la "fachada" del edificio, pero todavía no hay instalaciones eléctricas ni tuberías detrás.

El proyecto fue generado con **Lovable** (una herramienta que crea aplicaciones a partir de instrucciones escritas) y se mantiene sincronizado con ella a través de GitHub.

---



## 2. ¿Qué puede hacer hoy un usuario?


| Pantalla            | Dirección    | ¿Qué se ve?                                                                | ¿Qué funciona de verdad?                  |
| ------------------- | ------------ | -------------------------------------------------------------------------- | ----------------------------------------- |
| Inicio              | `/`          | Nada; redirige solo al login                                               | La redirección                            |
| Iniciar sesión      | `/login`     | Formulario con email, contraseña y rol                                     | Solo elegir rol y entrar (no valida nada) |
| Dashboard ejecutivo | `/dashboard` | Indicadores de facturación, horas por repositorio, facturas y vista previa | Solo mostrar datos de ejemplo             |
| Mi tiempo           | `/my-time`   | Horas de la semana de un programador, gráfico por día y bitácora           | Solo mostrar datos de ejemplo             |
| Clientes            | `/clients`   | Tabla de clientes y ventana para "Nuevo cliente"                           | Abrir y cerrar la ventana                 |
| Proyectos           | `/projects`  | Tabla de proyectos y ventana para "Nuevo proyecto"                         | Abrir y cerrar la ventana                 |
| Facturación         | `/invoices`  | Lista de facturas y vista previa del documento                             | Seleccionar una factura de la lista       |




### Detalle de cada pantalla

**Iniciar sesión (**`/login`**)**

- Tiene email y contraseña ya rellenados (`ana.rios@nexo.it` / `demo-password`) y un selector de rol: *Developer*, *Admin* o *Finance*.
- Al pulsar "Iniciar Sesión":
  - Si el rol es **Developer**, lleva a **Mi tiempo**.
  - Si es **Admin** o **Finance**, lleva al **Dashboard ejecutivo**.
- No comprueba usuario ni contraseña. Es una "sesión de demostración" (así lo indica la propia pantalla).

**Dashboard ejecutivo (**`/dashboard`**)**

- Cuatro tarjetas con cifras: facturación en USD, facturación en MXN, horas no facturadas y clientes activos.
- Barras con horas por repositorio (por ejemplo `api-gateway`, `billing-core`).
- Lista de "tiempo no facturado" con botón **Generar Pre-Facturas**.
- Tabla de facturas con su estado (*Draft* = borrador, *Sent* = enviada, *Paid* = pagada).
- Vista previa de una factura con botones **Generar Cierre** y **Timbrar / Cobrar**.
- Botones **Filtrar** y **Exportar** en la cabecera.
- Ninguno de estos botones tiene acción asignada todavía.

**Mi tiempo (**`/my-time`**)**

- Saluda a un programador de ejemplo ("Hola, Diego") con su total semanal (39 horas).
- Muestra su proyecto principal y la dirección de su repositorio.
- Gráfico de barras de lunes a viernes.
- "Time Log": tabla de solo lectura con fecha, proyecto, hora de inicio, hora de fin y total.

**Clientes (**`/clients`**)**

- Tabla con nombre, RFC, moneda (USD/MXN), correo de facturación, estado y monto del mes.
- Botón **Nuevo Cliente** que abre una ventana con nombre, RFC y moneda. El botón "Guardar" no guarda.
- El buscador y los botones de paginación son solo dibujos: no filtran ni cambian de página.

**Proyectos (**`/projects`**)**

- Tabla con nombre, cliente, URL del repositorio, tarifa por hora, estado y horas del mes.
- Botón **Nuevo Proyecto** con nombre, cliente, tarifa y URL de repositorio. Tampoco guarda.
- La URL del repositorio es la pieza clave del diseño: es lo que, en el futuro, enlazará el tiempo medido automáticamente con el proyecto correcto.

**Facturación (**`/invoices`**)**

- A la izquierda, la lista de facturas. Al hacer clic en una, queda seleccionada y la vista previa cambia de cliente, estado, moneda, método y total.
- Métodos de cobro mencionados: **SAT CFDI 4.0** (facturación electrónica mexicana) y **Stripe Link** (cobro con tarjeta).
- Botones **Generar Cierre**, **Validar** y **Timbrar / Cobrar**, todos sin acción.



### Elementos comunes a las pantallas internas

Todas las pantallas (menos el login) comparten un mismo "marco":

- **Menú lateral** (en computadora) o **barra inferior** (en celular) para navegar entre secciones.
- Tarjeta de "Telemetría" que indica "12 repos conectados" (texto fijo).
- Usuario de ejemplo en la esquina: **Ana Ríos, admin · finanzas** (fijo, no cambia según quién entra).
- Botón para **cerrar sesión**, que simplemente vuelve al login.

---



## 3. Parte visual (Frontend)

El frontend es todo lo que el usuario ve y toca en el navegador.

### Tecnologías principales


| Herramienta              | Para qué se usa, en palabras simples                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| **React 19**             | La base con la que se construyen las pantallas, pieza por pieza.                            |
| **TypeScript**           | El lenguaje de programación. Es JavaScript con "reglas extra" que ayudan a evitar errores.  |
| **TanStack Router**      | Decide qué pantalla mostrar según la dirección (`/login`, `/clients`, etc.).                |
| **Tailwind CSS 4**       | Da estilo (colores, tamaños, espacios) escribiendo clases cortas directamente en el código. |
| **shadcn/ui + Radix UI** | Un catálogo de piezas visuales ya hechas: botones, ventanas emergentes, selectores, tablas… |
| **Lucide**               | La colección de iconos (reloj, carpeta, factura, etc.).                                     |
| **Google Fonts**         | Tipografías *Inter* (texto normal) y *JetBrains Mono* (números y datos).                    |




### Diseño visual

- Paleta basada en **azul** como color principal, **verde menta** para estados positivos, **ámbar** para avisos, **rosa** para alertas y **violeta** como acento.
- Tarjetas con esquinas redondeadas, sombras suaves y animaciones de entrada (los elementos "suben" al aparecer y las barras "crecen").
- Diseño **adaptable**: en pantallas pequeñas el menú lateral se oculta y aparece una barra de navegación inferior.
- Existe un **modo oscuro definido a medias** en los estilos, pero no hay forma de activarlo y no incluye todos los colores propios del portal.

---



## 4. Parte del servidor (Backend)

**Hoy no existe un backend con lógica de negocio.** No hay:

- Base de datos.
- Sistema de usuarios, contraseñas o permisos.
- Servicios para guardar clientes, proyectos o facturas.
- Recepción de la telemetría (la medición automática de tiempo).
- Conexión con el SAT (timbrado) ni con Stripe (cobros).
- Variables de entorno ni claves de servicios externos.

Lo único que hay del lado del servidor es la **infraestructura base** que trae la plantilla:

- **TanStack Start**: permite que las páginas se "armen" en el servidor antes de enviarse al navegador (esto hace que carguen más rápido y se vean bien en buscadores).
- **Nitro**: prepara la aplicación para publicarse. Por defecto está configurada para **Cloudflare** (un servicio de alojamiento en la nube).
- **Manejo de errores**: si algo falla en el servidor, en vez de mostrar un error feo, se muestra una página amable de "This page didn't load" con botón para reintentar.
- **Protección CSRF**: una medida de seguridad ya activada que impide que otras páginas web hagan peticiones falsas en nombre del usuario. Está lista para cuando se creen funciones de servidor.

También está instalado **TanStack Query** (herramienta para pedir y guardar datos del servidor), pero **no se usa todavía** porque no hay datos reales que pedir.

---



## 5. Arquitectura (cómo está organizado por dentro)



### Vista general

```
 Navegador del usuario
        │
        ▼
 ┌─────────────────────────────┐
 │  server.ts                  │  ← Puerta de entrada. Atrapa errores graves.
 │  start.ts                   │  ← Filtros de seguridad y errores.
 └─────────────┬───────────────┘
               ▼
 ┌─────────────────────────────┐
 │  router.tsx                 │  ← Decide qué página mostrar.
 │  routes/__root.tsx          │  ← Marco HTML general de toda la app.
 └─────────────┬───────────────┘
               ▼
 ┌─────────────────────────────┐
 │  Páginas (routes/*.tsx)     │  ← login, dashboard, my-time, clients...
 │    usan PortalShell         │  ← Menú, cabecera y piezas comunes.
 │    usan componentes ui/     │  ← Botones, ventanas, selectores...
 └─────────────┬───────────────┘
               ▼
 ┌─────────────────────────────┐
 │  Datos de ejemplo           │  ← Escritos dentro de cada página.
 │  (no hay base de datos)     │
 └─────────────────────────────┘
```



### Ideas clave de la arquitectura

- **Cada archivo dentro de** `src/routes/` **es una página.** El nombre del archivo es la dirección web: `clients.tsx` → `/clients`. Esto se llama *enrutamiento por archivos*.
- **Un marco compartido (**`PortalShell`**)** evita repetir el menú y la cabecera en cada página.
- **Piezas reutilizables** en `src/components/ui/` para que todo se vea coherente.
- **Los datos viven dentro de cada página** como listas fijas. Cuando exista un backend, estas listas se sustituirán por datos reales.

---



## 6. Estructura de archivos

```
document-delight/
├── .lovable/project.json       Datos de la plantilla de Lovable.
├── public/
│   ├── favicon.ico             Icono de la pestaña del navegador.
│   └── robots.txt              Instrucciones para buscadores (Google, etc.).
├── src/
│   ├── routes/                 ← LAS PÁGINAS
│   │   ├── __root.tsx          Marco general, título, tipografías, página 404 y de error.
│   │   ├── index.tsx           "/"  → redirige al login.
│   │   ├── login.tsx           "/login"
│   │   ├── dashboard.tsx       "/dashboard"
│   │   ├── my-time.tsx         "/my-time"
│   │   ├── clients.tsx         "/clients"
│   │   ├── projects.tsx        "/projects"
│   │   ├── invoices.tsx        "/invoices"
│   │   └── README.md           Guía de cómo nombrar páginas.
│   ├── components/
│   │   ├── portal/
│   │   │   └── PortalShell.tsx Marco del portal + piezas propias del proyecto.
│   │   └── ui/                 48 piezas visuales genéricas (botón, tabla, ventana…).
│   ├── hooks/
│   │   └── use-mobile.tsx      Detecta si la pantalla es de celular.
│   ├── lib/
│   │   ├── utils.ts            Función para combinar estilos.
│   │   ├── error-capture.ts    Guarda y detalla errores del servidor.
│   │   ├── error-page.ts       Página HTML de "algo salió mal".
│   │   └── lovable-error-reporting.ts  Envía errores al editor de Lovable.
│   ├── router.tsx              Configuración del sistema de páginas.
│   ├── routeTree.gen.ts        Mapa de páginas generado AUTOMÁTICAMENTE (no editar).
│   ├── server.ts               Entrada del servidor.
│   ├── start.ts                Filtros del servidor (errores y seguridad).
│   └── styles.css              Colores, tipografías y animaciones.
├── package.json                Lista de librerías y comandos del proyecto.
├── vite.config.ts              Configuración de la herramienta que ejecuta y empaqueta la app.
├── tsconfig.json               Reglas del lenguaje TypeScript.
├── components.json             Configuración del catálogo shadcn/ui.
├── eslint.config.js            Reglas de revisión automática del código.
├── .prettierrc                 Reglas de formato automático del código.
├── bunfig.toml / bun.lock      Configuración para el instalador "Bun".
├── package-lock.json           Registro de versiones para el instalador "npm" (sin subir a Git).
├── AGENTS.md                   Advertencias para asistentes de IA (no reescribir historial de Git).
└── README.md                   Descripción breve y cómo arrancar el proyecto.
```

---



## 7. Funciones y piezas principales



### Piezas propias del portal (`src/components/portal/PortalShell.tsx`)


| Pieza          | Qué hace                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PortalShell`  | El marco de todas las páginas internas: menú lateral, barra inferior en celular, cabecera con título, subtítulo, botones extra y "cerrar sesión". Recibe cuál sección está activa para resaltarla. |
| `KpiCard`      | Tarjeta de indicador: una etiqueta, un número grande y un detalle de color (verde, ámbar o gris).                                                                                                  |
| `Panel`        | Caja blanca con bordes redondeados donde se agrupa contenido.                                                                                                                                      |
| `SectionTitle` | Título de sección con subtítulo opcional.                                                                                                                                                          |
| `StatusDot`    | Puntito de color para indicar estado (activo, en pausa, inactivo).                                                                                                                                 |
| `LiveSyncPill` | Etiqueta verde "Auto-sync" con icono de wifi.                                                                                                                                                      |
| `SearchField`  | Caja de búsqueda decorativa. **Definida pero no usada** en ninguna página.                                                                                                                         |




### Funciones de cada página


| Archivo         | Función principal            | Comportamiento                                                      |
| --------------- | ---------------------------- | ------------------------------------------------------------------- |
| `index.tsx`     | `Index`                      | Redirige a `/login`.                                                |
| `login.tsx`     | `LoginPage`                  | Guarda el rol elegido y, al enviar, redirige según ese rol.         |
| `dashboard.tsx` | `DashboardPage`              | Pinta indicadores, barras, tabla y vista previa con datos fijos.    |
| `my-time.tsx`   | `MyTimePage`                 | Pinta resumen semanal, gráfico y bitácora con datos fijos.          |
| `clients.tsx`   | `ClientsPage`                | Pinta la tabla de clientes y la ventana "Nuevo cliente".            |
| `projects.tsx`  | `ProjectsPage`               | Pinta la tabla de proyectos y la ventana "Nuevo proyecto".          |
| `invoices.tsx`  | `InvoicesPage`               | Recuerda qué factura está seleccionada y actualiza la vista previa. |
| `invoices.tsx`  | `StatusBadge`                | Etiqueta de color según el estado de la factura.                    |
| `__root.tsx`    | `RootShell`, `RootComponent` | Arman el HTML base y conectan el sistema de datos.                  |
| `__root.tsx`    | `NotFoundComponent`          | Página "404 – no encontrada".                                       |
| `__root.tsx`    | `ErrorComponent`             | Página de error con botón "Try again".                              |




### Funciones de apoyo (`src/lib/` y `src/hooks/`)


| Función                      | Qué hace                                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| `cn()`                       | Junta varias clases de estilo y resuelve conflictos entre ellas.          |
| `useIsMobile()`              | Responde "sí/no" a "¿la pantalla mide menos de 768 píxeles?".             |
| `renderErrorPage()`          | Devuelve la página HTML de "algo salió mal".                              |
| `describeError()`            | Convierte un error en un texto detallado (mensaje, origen y causas).      |
| `consumeLastCapturedError()` | Entrega el último error registrado (si ocurrió hace menos de 5 segundos). |
| `reportLovableError()`       | Avisa al editor de Lovable cuando una página falla.                       |
| `getRouter()`                | Crea el sistema de navegación entre páginas.                              |




### Componentes genéricos (`src/components/ui/`)

Hay **48** piezas listas para usar, pero **solo 5 se usan hoy**: botón (`button`), campo de texto (`input`), etiqueta (`label`), selector desplegable (`select`) y ventana emergente (`dialog`).

El botón tiene un estilo propio del proyecto llamado `clay` (azul con sombra), que es el que se usa en las acciones principales.

---



## 8. Librerías instaladas



### Se usan actualmente


| Librería                                             | Uso                                                |
| ---------------------------------------------------- | -------------------------------------------------- |
| `react`, `react-dom`                                 | Base de las pantallas.                             |
| `@tanstack/react-router`, `@tanstack/react-start`    | Páginas, navegación y servidor.                    |
| `@tanstack/react-query`                              | Conectado, pero sin consultas todavía.             |
| `tailwindcss`, `tw-animate-css`                      | Estilos y animaciones.                             |
| `@radix-ui/*` (select, dialog, label, slot…)         | Comportamiento accesible de ventanas y selectores. |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Manejo de variantes y combinación de estilos.      |
| `lucide-react`                                       | Iconos.                                            |




### Instaladas, pero sin uso real en las páginas

Vienen con la plantilla y estarán disponibles cuando se necesiten:


| Librería                                        | Para qué serviría                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Formularios con validación (por ejemplo, comprobar que el RFC sea válido). |
| `recharts`                                      | Gráficos reales (hoy las barras están dibujadas a mano).                   |
| `date-fns`, `react-day-picker`                  | Manejo de fechas y calendarios.                                            |
| `sonner`                                        | Avisos emergentes ("Cliente guardado").                                    |
| `cmdk`                                          | Buscador tipo "paleta de comandos".                                        |
| `embla-carousel-react`                          | Carruseles.                                                                |
| `vaul`                                          | Paneles deslizantes en celular.                                            |
| `input-otp`                                     | Campos para códigos de verificación.                                       |
| `react-resizable-panels`                        | Paneles que se pueden redimensionar.                                       |




### Herramientas de desarrollo


| Herramienta                           | Para qué sirve                                                             |
| ------------------------------------- | -------------------------------------------------------------------------- |
| **Vite 8**                            | Arranca la app en modo desarrollo y la empaqueta para publicar.            |
| **@lovable.dev/vite-tanstack-config** | Configuración preparada por Lovable que ya incluye casi todo lo necesario. |
| **ESLint**                            | Revisa el código en busca de errores comunes.                              |
| **Prettier**                          | Ordena el formato del código automáticamente.                              |
| **Nitro**                             | Prepara la versión final para publicarse en la nube.                       |




### Comandos disponibles


| Comando           | Qué hace                               |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Arranca la app en modo desarrollo.     |
| `npm run build`   | Crea la versión final para publicar.   |
| `npm run preview` | Muestra cómo se verá la versión final. |
| `npm run lint`    | Revisa el código.                      |
| `npm run format`  | Da formato al código.                  |


---



## 9. Observaciones y detalles a corregir

Cosas encontradas durante el análisis que conviene tener en cuenta:

1. **La vista previa de facturas no coincide con la factura elegida.** En `/invoices`, al cambiar de factura cambian el cliente y el total, pero la tabla de conceptos (api-gateway, billing-core, mobile-app) es siempre la misma. Además, esos conceptos suman $9,362, cifra que no coincide con ninguno de los totales mostrados.
2. **Idiomas mezclados.** El contenido está en español, pero la página se declara en inglés (`lang="en"`), y las pantallas de error y "404" están en inglés. También se mezclan términos como *Draft/Sent/Paid*, *Active/Inactive* o *RepositoryUrl*.
3. **El usuario mostrado es siempre el mismo.** Aunque entres como *Developer*, el menú lateral muestra "Ana Ríos · admin · finanzas", y la página "Mi tiempo" saluda a "Diego".
4. **Los roles no restringen nada.** Un *Developer* puede entrar a Facturación o Clientes escribiendo la dirección.
5. **Buscadores, filtros y paginación son decorativos.** Se ven, pero no responden.
6. **Los números del dashboard no se calculan**; están escritos a mano y pueden no cuadrar entre pantallas.
7. **Dos instaladores de paquetes a la vez.** Existen `bun.lock` (Bun) y `package-lock.json` (npm). Lo recomendable es elegir uno para evitar diferencias de versiones.
8. **Piezas y librerías sin usar.** 43 de los 48 componentes visuales y varias librerías no se utilizan. No es un problema grave, pero agregan peso y ruido.
9. **Modo oscuro incompleto**, como se mencionó en la sección 3.

---



## 10. ¿Qué falta para que sea un sistema funcional?

En orden aproximado de prioridad:

1. **Base de datos** para clientes, proyectos, desarrolladores, registros de tiempo y facturas.
2. **Inicio de sesión real** con usuarios, contraseñas y permisos por rol (Developer, Admin, Finance).
3. **Guardar y editar** clientes y proyectos desde las ventanas que ya existen (con validación de campos, por ejemplo el RFC).
4. **Receptor de telemetría**: un servicio que reciba las señales de actividad del editor de código de cada programador. La pantalla de login ya menciona las reglas previstas: recibir una señal cada 100 ms y cortar el conteo tras 3 minutos de inactividad.
5. **Cálculo automático** de horas, horas no facturadas y montos según la tarifa de cada proyecto.
6. **Generación de pre-facturas y cierre mensual.**
7. **Integraciones de cobro**: timbrado ante el SAT (CFDI 4.0) para clientes en pesos y Stripe para clientes en dólares.
8. **Buscadores, filtros, paginación y exportación** funcionando.
9. **Extensión o plugin para el editor de código** (VS Code/Cursor) que envíe la actividad al portal.

---



## 11. Glosario


| Término            | Significado sencillo                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Frontend**       | Lo que el usuario ve y usa en el navegador.                                                  |
| **Backend**        | La parte "trasera" que guarda datos, aplica reglas y habla con otros servicios.              |
| **Componente**     | Una pieza reutilizable de la pantalla (un botón, una tarjeta, una tabla).                    |
| **Ruta**           | Una dirección dentro de la app, como `/clients`.                                             |
| **Telemetría**     | Medición automática de actividad; aquí, del tiempo que el programador pasa en cada proyecto. |
| **Heartbeat**      | "Latido": una pequeña señal periódica que dice "sigo trabajando".                            |
| **Repositorio**    | Carpeta en la nube (por ejemplo, en GitHub) donde vive el código de un proyecto.             |
| **KPI**            | Indicador clave; una cifra importante para el negocio.                                       |
| **Pre-factura**    | Borrador de factura antes de emitirla oficialmente.                                          |
| **Timbrar / CFDI** | En México, validar una factura electrónica ante el SAT para que tenga validez fiscal.        |
| **Stripe**         | Plataforma para cobrar con tarjeta por internet.                                             |
| **RFC**            | Registro Federal de Contribuyentes; identificador fiscal en México.                          |
| **CSRF**           | Tipo de ataque donde otra página intenta actuar en tu nombre; el sistema ya trae protección. |
| **Lovable**        | Herramienta que genera aplicaciones a partir de instrucciones y se sincroniza con GitHub.    |


