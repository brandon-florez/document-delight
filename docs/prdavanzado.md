# Portal de Asignación y Facturación de Recursos para Proyectos IT

---

## 1. Resumen Ejecutivo

El Portal de Asignación y Facturación de Recursos para Proyectos IT es una solución centralizada diseñada para erradicar las fugas de capital y optimizar el flujo de efectivo en consultoras tecnológicas y agencias de desarrollo de software con operaciones internacionales.

### 1.1 Problemática Identificada

- **Pérdida de ingresos:** El registro manual de horas en proyectos simultáneos provoca que el tiempo efectivo de trabajo se quede sin registrar y, por ende, sin cobrar.
- **Retrasos de cobranza:** El cruce manual de hojas de cálculo para clientes en México y EE. UU. genera cuellos de botella en el área de finanzas y retrasa la emisión de facturas.

### 1.2 Solución y Mecanismos de Acción

- **Captura de tiempo sin fricción:** Integración directa con entornos de desarrollo y gestión (como Jira o GitHub) para asegurar que el 100% de las horas trabajadas sean documentadas de forma natural.
- **Cálculo financiero automatizado:** Motor de reglas que mapea los contratos y cruza instantáneamente el perfil del empleado con la tarifa y divisa exacta del cliente (MXN o USD).
- **Facturación a un clic:** Generación automática de reportes a fin de mes, integrándose directamente con el SAT para el timbrado de facturas en México o emitiendo enlaces de pasarelas de pago para clientes extranjeros.

### 1.3 Justificación para la Gestión de Proyectos

- **Manejo de stakeholders complejos:** Involucra la alineación de requerimientos multidisciplinarios abarcando a Recursos Humanos, Finanzas, Project Managers y Clientes.
- **Desarrollo de planeación estructurada:** Proporciona un escenario ideal para diseñar planes de comunicación robustos y cronogramas de Gantt críticos, enfocados en la migración segura de datos financieros heredados hacia la nueva plataforma unificada.

---

## 2. Antecedentes

Las agencias de desarrollo de software y consultoras tecnológicas operan en un entorno dinámico, gestionando múltiples clientes internacionales (principalmente en México y EE. UU.) con equipos multidisciplinarios.

Actualmente, el registro de horas trabajadas y la facturación se realizan mediante procesos manuales y hojas de cálculo desconectadas. Esto genera una fricción operativa significativa:

- Los desarrolladores olvidan registrar su tiempo exacto.
- El departamento de finanzas invierte días en cruzar tarifas, divisas y contratos.

**Como resultado**, la empresa sufre fugas de capital por horas no facturadas y experimenta retrasos críticos en su flujo de efectivo debido a ciclos de cobranza lentos.

---

## 3. Objetivos

### 3.1 Objetivo General

Desarrollar e implementar un portal interno unificado de asignación de recursos y facturación en un plazo de **6 meses**, que automatice el rastreo de horas y la emisión de facturas internacionales, eliminando las pérdidas por horas no registradas.

### 3.2 Objetivos Específicos

1. Lograr un **100% de adopción** por parte del equipo de desarrollo mediante la integración del portal con herramientas de trabajo diario (Jira, GitHub).
2. Reducir el tiempo del ciclo de facturación mensual de finanzas de varios días a **menos de 4 horas**.
3. Automatizar la conversión de divisas (MXN/USD) y la aplicación de tarifas por contrato en tiempo real.
4. Migrar el **100%** de los datos financieros y de proyectos antiguos al nuevo sistema sin pérdida de integridad.

---

## 4. Metodología

El proyecto se ejecutará bajo el marco de trabajo **Ágil (Scrum)**, permitiendo entregas incrementales y adaptación a los requerimientos complejos de los distintos stakeholders.

| Fase | Nombre | Sprints | Descripción |
|---|---|---|---|
| 1 | Levantamiento y Diseño | 1-2 | Definición de reglas de negocio con Finanzas y Recursos Humanos. Diseño de la arquitectura de la base de datos y UI/UX del portal. |
| 2 | Desarrollo Backend e Integraciones | 3-6 | Construcción del motor de cálculo financiero, integración con la API del SAT para timbrado y conexión con pasarelas de pago internacionales (ej. Stripe). |
| 3 | Desarrollo Frontend | 5-8 | Creación de la interfaz de usuario para la carga de horas y el panel de control administrativo. |
| 4 | Migración de Datos y Pruebas | 9-10 | Ejecución del plan estructurado de migración de datos históricos. Pruebas de estrés y validación de seguridad. |
| 5 | Capacitación y Despliegue | 11-12 | Ejecución del plan de comunicación, entrenamiento a usuarios y salida a producción. |

---

## 5. Recursos

### 5.1 Recursos Humanos

- 1 Project Manager
- 1 Arquitecto de Software / Backend Developer
- 1 Frontend Developer
- 1 Especialista en Bases de Datos
- 1 QA Tester

### 5.2 Recursos Tecnológicos

- **Backend:** C# y .NET para el desarrollo de una API robusta y segura.
- **Base de datos:** Microsoft SQL Server para garantizar la integridad relacional de los datos financieros, contratos y perfiles de usuario.
- **Frontend:** Interfaz web responsiva (ej. utilizando TypeScript y React).
- **Integraciones:** APIs de Jira/GitHub, API del SAT (PAC autorizado) y pasarelas de pago.

### 5.3 Recursos de Infraestructura

- Entornos de desarrollo, pruebas y producción en la nube (ej. Azure o AWS).

---

## 6. Presupuesto

| Concepto | Monto (USD) | Detalle |
|---|---:|---|
| Costos de personal (desarrollo e implementación) | $45,000 | Basado en 6 meses de trabajo del equipo |
| Infraestructura y licencias | $3,000 | Anuales (servidores, SQL Server, Cloud) |
| Integraciones de terceros | $1,500 | Setup inicial y pruebas (PAC para SAT, comisiones de pasarela) |
| Reserva de contingencia (15%) | $7,425 | |
| **Presupuesto total estimado** | **$56,925** | |

---

## 7. Medición e Informes

### 7.1 Indicadores Clave de Rendimiento (KPIs)

- **Tasa de horas registradas a tiempo:** Porcentaje de horas capturadas en el sistema en la misma semana que se trabajaron.
- **Precisión de facturación:** Número de facturas emitidas sin necesidad de corrección manual.
- **Reducción del ciclo de cobro (DSO – Days Sales Outstanding):** Días promedio desde que termina el mes hasta que se recibe el pago del cliente.

### 7.2 Informes

- **Reporte de Sprint (quincenal):** Avance técnico, bloqueos y presupuesto consumido. *Dirigido al equipo y PM.*
- **Informe de Retorno de Inversión (trimestral post-lanzamiento):** Comparativa de horas facturadas vs. periodo anterior al software. *Dirigido a Finanzas y Dirección.*

---

## 8. Riesgos

### Riesgo 1: Resistencia al cambio por parte de los desarrolladores

- **Mitigación:**
  - Crear un plan de comunicación sólido destacando que el sistema elimina la burocracia manual.
  - Asegurar que la integración con herramientas como Jira funcione sin fricciones.

### Riesgo 2: Cambios normativos en la API del SAT (CFDI)

- **Mitigación:**
  - Diseñar el módulo de facturación con una arquitectura desacoplada, permitiendo actualizar las reglas fiscales sin afectar el resto del sistema.

### Riesgo 3: Pérdida o corrupción de datos durante la migración de sistemas legacy (hojas de cálculo antiguas)

- **Mitigación:**
  - Crear un cronograma de Gantt específico para la migración.
  - Utilizar entornos de prueba temporales.
  - Aplicar scripts de validación de datos (ETL).
  - Realizar respaldos totales antes del corte definitivo.