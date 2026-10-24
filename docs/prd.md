# Product Requirements Document (PRD)

## Proyecto: Portal de Asignación y Facturación de Recursos IT

**Objetivo del documento:** Proveer contexto unificado, requerimientos técnicos y flujos de trabajo estructurados para su ingesta por asistentes de Inteligencia Artificial (**Lovable** para Frontend / **Cursor AI** para Backend).

---

## 1. Arquitectura y Stack Tecnológico

Este sistema utiliza una arquitectura desacoplada: **Frontend SPA + Backend REST API**.

### 1.1 Frontend (generado por Lovable)

- **Framework:** React + TypeScript + Vite.
- **Estilos y UI:** Tailwind CSS, Shadcn UI (componentes recomendados), Lucide Icons.
- **Manejo del estado:**
  - React Query (para consumo de API).
  - Zustand o Context API (para estado global de autenticación).

### 1.2 Backend (desarrollado con Cursor AI)

- **Framework:** C# .NET 8 (Web API).
- **Base de datos:** Microsoft SQL Server (Entity Framework Core).
- **Autenticación:** JWT (JSON Web Tokens).
- **Arquitectura:** Clean Architecture o Patrón Repositorio.

---

## 2. Modelos de Datos (Entidades Core)

Cursor AI deberá generar los modelos de Entity Framework basados en la siguiente estructura:

| Entidad | Campos principales | Relaciones |
|---|---|---|
| **User** | Id, Name, Email, PasswordHash, Role (Admin, Developer, Finance), HourlyCost | 1 a N con TimeEntry |
| **Client** | Id, Name, TaxId (RFC), Currency (USD/MXN), BillingEmail | 1 a N con Project, 1 a N con Invoice |
| **Project** | Id, Name, RepositoryUrl, HourlyRate, Status (Active/Inactive), ClientId | N a 1 con Client, 1 a N con TimeEntry |
| **TimeEntry** | Id, Date, StartTime, EndTime, TotalMinutes, ActivityScore (0-100), UserId, ProjectId | N a 1 con User, N a 1 con Project |
| **Invoice** | Id, Month, Year, TotalHours, TotalAmount, Currency, Status (Draft, Sent, Paid), ExternalId (SAT/Stripe), ClientId | N a 1 con Client |

> **Restricción estricta:** No existen entidades ni tablas relacionadas con "Tickets", "Tasks" o "Issues". El tiempo se vincula exclusivamente al **Project**.

---

## 3. Requerimientos Funcionales (Backend – Cursor AI)

Instrucciones específicas para la generación de la API:

### 3.1 Auth Module

- Endpoint de login: `/api/auth/login`.
- Debe retornar un token JWT con los claims de rol del usuario.

### 3.2 Telemetry Receiver API

- Endpoint de alta disponibilidad: `POST /api/time/heartbeat`.
- Recibe la telemetría del IDE (VS Code / Visual Studio).
- **Datos requeridos:** `userId`, `repositoryUrl`, `timestamp`, `isTyping`.
- El backend debe agrupar los heartbeats en bloques de tiempo continuos (`TimeEntry`), asignándolos al `Project` que coincida con el `repositoryUrl`.

### 3.3 Billing Engine

Lógica de negocio que, dado un mes y un `clientId`:

1. Agrupa todos los `TimeEntry` de los proyectos del cliente.
2. Los multiplica por el `HourlyRate` del proyecto correspondiente.
3. Genera un `Invoice` preliminar.

### 3.4 Integrations Gateway

Interfaces para conectar con:

- **API del SAT:** generación de CFDI 4.0.
- **Stripe:** creación de Payment Links.

Se disparan al cambiar el estatus de un `Invoice` a **"Sent"**.

---

## 4. Requerimientos No Funcionales

### 4.1 Seguridad

- Las contraseñas deben estar hasheadas con **BCrypt**.
- Todos los endpoints, excepto el login, deben estar protegidos por middleware de autorización JWT.

### 4.2 Rendimiento

- El endpoint de telemetría debe responder en **menos de 100 ms**, ya que recibirá múltiples peticiones por minuto de los desarrolladores.

### 4.3 Manejo de errores

- Implementar un middleware de excepciones globales en .NET.
- Debe retornar un formato JSON estandarizado (**RFC 7807 Problem Details**).

---

## 5. Diseño de Pantallas y Flujos de Usuario (Frontend – Lovable)

Instrucciones para la generación de la interfaz web en React.

### 5.1 Pantalla de Autenticación (`/login`)

- **UI:** Formulario centrado tipo tarjeta con Logo, campo de Email, Password y botón "Iniciar Sesión".
- **Flujo:** Al autenticar exitosamente, redirigir según el rol del usuario:
  - Developer → `/my-time`
  - Admin / Finance → `/dashboard`

### 5.2 Vista de Desarrollador (`/my-time`)

- **UI:** Panel minimalista.
- **Componentes:**
  - **Header:** Saludo al usuario y total de horas registradas en la semana actual.
  - **Activity Chart:** Gráfico de barras simple con las horas por día (lunes a viernes).
  - **Time Log Table:** Tabla de solo lectura que consume los `TimeEntry` del backend.
    - Columnas: Fecha, Proyecto, Hora Inicio, Hora Fin, Total Horas.

> **Nota:** No hay botones de "Iniciar reloj" o "Crear tarea". La tabla se alimenta automáticamente de la API de telemetría del IDE.

### 5.3 Dashboard Financiero y Admin (`/dashboard`)

- **UI:** Panel de métricas ejecutivas.
- **Componentes:**
  - **KPI Cards:**
    - Total facturado del mes actual (USD y MXN).
    - Horas pendientes de facturar.
    - Clientes activos.
  - **Unbilled Time Widget:** Lista de proyectos con horas acumuladas del mes en curso que no han sido facturadas, con un botón de acción rápida **"Generar Pre-Facturas"**.

### 5.4 Gestión de Clientes y Proyectos (`/clients`, `/projects`)

- **UI:** Tablas de datos (DataTables) con paginación, búsqueda y filtros.
- **Flujos:**
  - **"Nuevo Cliente":** abre un modal (Shadcn Dialog) para ingresar RFC, nombre y moneda.
  - **"Nuevo Proyecto":** abre un modal para asociar un cliente, establecer el nombre, la tarifa por hora (`HourlyRate`) y la URL del repositorio (clave para enlazar el tiempo).

### 5.5 Módulo de Facturación (`/invoices`)

- **UI:** Vista dividida.
  - **Izquierda:** Lista de facturas (Borrador, Enviadas, Pagadas).
  - **Derecha:** Vista previa del documento.
- **Flujos de acción:**
  - **Generar Cierre:** Botón que solicita el mes actual y calcula todas las horas.
  - **Timbrar/Cobrar:** Botón en una factura "Borrador" que dispara el llamado al backend para conectarse al SAT o Stripe. La etiqueta (Badge) de estado cambia dinámicamente a **"Sent"**.

---

## 6. Historias de Usuario (Acceptance Criteria)

### Epic 1: Rastreo de Tiempo Invisible

#### US 1.1

> Como **Desarrollador**, quiero que mis horas se registren automáticamente mientras escribo código en el IDE, para no tener que acordarme de pausar/iniciar un cronómetro manual.

**Criterios de aceptación (AC):**

- El backend procesa los heartbeats y crea un registro si hubo actividad constante.
- Se detiene el conteo si hay inactividad mayor a 3 minutos.

### Epic 2: Gestión de Contratos

#### US 2.1

> Como **Project Manager**, quiero crear proyectos y asignarles una URL de repositorio y una tarifa por hora específica, para que el sistema sepa a qué tarifa cobrar el tiempo detectado en ese código.

**Criterios de aceptación (AC):**

- CRUD funcional de proyectos en el frontend.
- Un proyecto no puede guardarse sin tarifa por hora.

### Epic 3: Motor de Facturación

#### US 3.1

> Como **perfil de Finanzas**, quiero presionar un botón a final de mes que calcule automáticamente cuánto debe pagar cada cliente, para evitar cruzar hojas de Excel.

**Criterios de aceptación (AC):**

- El sistema agrupa los registros del mes por cliente.
- Multiplica horas por la tarifa de cada proyecto.
- Muestra un borrador de factura (Draft) con el total desglosado.

#### US 3.2

> Como **perfil de Finanzas**, quiero emitir el cobro de la factura preliminar directamente desde el sistema, para enviarlo al cliente.

**Criterios de aceptación (AC):**

- Si el cliente es **USD**, se genera un Stripe Link.
- Si es **MXN**, se genera el XML/PDF del SAT.
- El estado cambia a **"Enviado"**.