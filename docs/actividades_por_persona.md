PASOS POR PERSONA — Nexo IT·Fin (document-delight)
====================================================

Reparto: una persona deja el portal encendido y listo para cobrar.
La otra construye la extensión que manda el tiempo.
Esas dos partes casi no se tocan en el código, así que pueden avanzar a la vez.

  Persona A — Plataforma y cobro     Puntos 1, 2, 4 y 5
  Persona B — Telemetría             Punto 3

Ramas:
  feature/supabase-cobro
  feature/extension-ide

La extensión vive en una carpeta nueva, por ejemplo extensions/vscode,
para no chocar con las pantallas ni con supabase/.

El primer día la persona A solo necesita dejar el proyecto creado,
las migraciones aplicadas y un usuario Developer. Con eso la persona B
ya puede probar la extensión. El cobro (puntos 4 y 5) puede seguir en
paralelo. Para ver una factura con monto real sí necesitan al menos
un bloque de tiempo registrado.


====================================================
PERSONA A — PLATAFORMA Y COBRO
====================================================

1. Dejar el portal conectado
----------------------------
1. Entra a la carpeta document-delight, ejecuta npm install
   y copia .env.example a .env.
2. Crea un proyecto en https://supabase.com
   (o levanta uno local con Docker: npx supabase start).
3. Copia la URL del proyecto y la clave anon a:
     VITE_SUPABASE_URL
     VITE_SUPABASE_PUBLISHABLE_KEY
   No subas el archivo .env a Git.
4. Vincula el repo:
     npx supabase login
     npx supabase link --project-ref tamihgvrooapgnwzbwhv5 
   Aplica las migraciones:
     npx supabase db push
   En local, npx supabase db reset también carga el seed.
6. Arranca npm run dev e inicia sesión.
   Si falta la configuración, el login lo dice en pantalla.

2. Crear los usuarios de prueba
-------------------------------
1. En Supabase: Authentication → Users → Add user.
   Marca "Auto Confirm User".
   Crea al menos un Developer y un Admin.
2. El trigger los deja como Developer. Para el segundo, en el SQL Editor:

     update public.profiles set role = 'Admin'
     where email = 'correo-del-admin@empresa.com';

3. Entra con cada uno:
   - El Developer debe caer en Mi tiempo.
   - El Admin debe caer en el dashboard.
   - Si el Developer abre /invoices, debe volver a Mi tiempo.
4. Pásale a tu pareja el correo y la contraseña del Developer,
   y la URL de la función hartaba cuando la publiques.

4. Publicar las funciones de cobro
----------------------------------
1. Crea una cuenta de prueba en Stripe y un usuario de sandbox en Facturama.
2. Carga los secretos (valores de prueba, nunca en el frontend):

     npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... PAC_USER=... PAC_PASSWORD=... PAC_BASE_URL=https://apisandbox.facturama.mx

3. Despliega las tres funciones:

     npx supabase functions deploy heartbeat
     npx supabase functions deploy issue-invoice
     npx supabase functions deploy stripe-webhook

4. En Stripe, crea un webhook hacia:

     https://<project-ref>.supabase.co/functions/v1/stripe-webhook

   con el evento checkout.session.completed.
   El whsec_... de ese endpoint es el que va en STRIPE_WEBHOOK_SECRET.
5. Con el usuario Admin, entra a Facturación, genera el cierre de un mes
   que tenga horas y pulsa "Timbrar / Cobrar".
   - En MXN debe guardar XML y PDF.
   - En USD, un enlace de pago.
   Cuando se pague el enlace de prueba, la factura debe pasar a Paid sola.

5. Datos del emisor
-------------------
1. Mientras no haya pantalla, carga una fila en company_settings.
   El seed ya trae el RFC de pruebas del SAT EKU9003173C9.
   Sin esa fila, el timbrado en pesos se detiene.
2. Para un cliente en MXN, completa:
   - régimen fiscal (3 dígitos)
   - código postal (5 dígitos)
   - uso de CFDI (por ejemplo G03)
   El formulario de Clientes ya tiene esos campos.
3. Si les da tiempo, añade una pantalla solo para Admin que lea y
   actualice esa única fila: RFC, razón social, régimen y código postal.


====================================================
PERSONA B — EXTENSIÓN DEL EDITOR
====================================================

Puede empezar hoy. El contrato ya está fijo en:
  supabase/functions/_shared/heartbeat.ts

1. Crea la extensión en extensions/vscode
   (un package.json con contributes y un src/extension.ts).
   Para probarla en VS Code o Cursor: Extension: Run Extension.

2. Al activarse, pide un token y lo guarda en el almacén secreto
   de la extensión (SecretStorage), no en un archivo del repo.

3. Cada cierto tiempo (unos 30–60 segundos basta; el corte de 3 minutos
   lo hace el servidor), si el usuario escribió desde el último envío,
   manda un POST a:

     https://<project-ref>.supabase.co/functions/v1/heartbeat

   Cabecera:
     Authorization: Bearer <token>

   Cuerpo:

     {
       "userId": null,
       "repositoryUrl": "github.com/nexo/billing-core",
       "timestamp": "2026-10-18T20:00:00.000Z",
       "isTyping": true
     }

   repositoryUrl debe coincidir con la URL del proyecto en el portal.
   El servidor acepta https://..., git@github.com:... y quita .git.
   userId puede ir null: el token ya identifica a la persona.
   isTyping es true solo si hubo teclado desde el latido anterior.

4. Trata las respuestas:
     204  se registró
     202  el repo no está en un proyecto activo
     401  token inválido
     422  el JSON está mal

5. Deja de enviar si el editor pierde el foco o pasan 3 minutos
   sin teclear, para no alargar el bloque.

6. Prueba primero con curl o con la extensión apuntando a la URL
   que te pase la persona A.
   En Mi tiempo: Generar token, cópialo (solo se muestra una vez)
   y pégalo en la extensión.

7. Confirma en Mi tiempo que aparece un registro con horas y que,
   al dejar de escribir, el bloque se cierra.


====================================================
PUNTO DE ENCUENTRO
====================================================

Cuando la extensión mande el primer heartbeat, revisen juntos Mi tiempo
y, con el usuario Admin, pulsen "Generar Pre-Facturas".
