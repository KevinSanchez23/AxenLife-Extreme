# Backend de abonos: Azure + Stripe + Google Sheets

Para servidores con Docker y Apache: [guía de Docker](DOCKER.md).

Node.js 22 o superior, TypeScript y Express. Sin base de datos propia.
La landing está conectada a la API y descarga el comprobante PDF al confirmar el pago.
No activar cobros públicos hasta configurar las cuentas y probar el recorrido completo.

## Configuración local

1. `npm ci`
2. Copiar `.env.example` a `.env` y completar los valores. Nunca usar prefijo `VITE_` para secretos.
3. Crear el Google Apps Script siguiendo la sección siguiente.
4. `npm run backend:dev`. En otra terminal, `npm run dev`.

Vite reenvía `/api` a `127.0.0.1:3001`. En producción debe hacerlo el proxy HTTPS.
`PUBLIC_SITE_URL` es la URL completa de la landing (admite subcarpetas, usar `/` final).
El retorno usa `?pago=recibido&session_id={CHECKOUT_SESSION_ID}` o `?pago=cancelado`;
esos parámetros NO acreditan un pago. El backend consulta la sesión y el cargo en Stripe.
No se expone una consulta pública de abonos por correo.

## Google Sheets y Apps Script

1. Crear una hoja privada y un proyecto en Google Apps Script con la cuenta que la administra.
2. Copiar `google-apps-script/Code.gs` al editor. Mostrar el manifiesto en Configuración
   y copiar `google-apps-script/appsscript.json`.
3. En Propiedades del script agregar:
   - `SPREADSHEET_ID`: identificador de la hoja.
   - `SHARED_SECRET`: secreto aleatorio compartido con `GOOGLE_SHEETS_SHARED_SECRET` del backend.
4. Generar el secreto localmente, por ejemplo con
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Guardarlo solo en la configuración privada de ambos servicios.
5. Implementar como **Aplicación web**, ejecutar como el propietario y permitir acceso
   a **Cualquier usuario** (incluye llamadas sin inicio de sesión). La autenticación de cada
   escritura la realiza el HMAC del cuerpo con vigencia de cinco minutos.
   Si Workspace prohíbe este tipo de despliegue, el administrador debe habilitarlo;
   esta implementación no funcionará con una pantalla de inicio de sesión.
6. Copiar la URL publicada terminada en `/exec` a `GOOGLE_SHEETS_WEB_APP_URL`.
   Tras editar el script, publicar una nueva versión del mismo despliegue.

Se crean `Abonos_pruebas` y `Abonos` según el modo de Stripe. El importe es numérico en pesos.
El bloqueo del script cubre comprobar el ID del PaymentIntent y añadir la fila:
las notificaciones repetidas del mismo pago no crean nuevos abonos, incluso desde varias
instancias del backend. Usar **un solo proyecto Apps Script** como escritor. No borrar
IDs ni cambiar encabezados; utilizar otra pestaña para reportes y totales por correo.
La hoja y Stripe almacenan datos personales; el backend no los persiste ni los registra en logs.

## API para conectar el formulario

`POST /api/crear-pago`, `Content-Type: application/json`, encabezado
`Idempotency-Key: <UUID v4 generado con crypto.randomUUID()>`.

```json
{
  "name": "Ana Pérez",
  "email": "ana@example.com",
  "phone": "+52 5555555555",
  "amount": "1500.00",
  "accessToken": "<64 caracteres hexadecimales aleatorios>"
}
```

`phone` es opcional; `amount` es **texto en pesos**, sin comas, hasta dos decimales.
El mínimo es 150000 centavos. `MAX_AMOUNT_CENTS` fija el máximo (por defecto
99999999 centavos, $999,999.99 MXN); ajustar al límite de negocio antes de producción.
Moneda y URLs las controla el servidor. Inicialmente solo se ofrecen tarjetas.
Respuesta: `{ "url": "https://checkout.stripe.com/..." }`; redirigir a esa URL.

Reutilizar el mismo UUID para reintentos de la misma solicitud; crear otro si se editan
los datos o se inicia otro abono. Deshabilitar el botón durante el envío.
El SDK envía la clave de idempotencia a Stripe; no requiere almacenamiento local.
El correo original normalizado se conserva en metadata, aunque se cambie el correo de
facturación en Checkout. La hoja usa el original como vínculo del abono.

### Retorno y comprobante PDF

El cliente crea una clave de 32 bytes aleatorios y la guarda, junto al UUID del intento,
en `sessionStorage`. No guarda nombre, correo ni teléfono. El backend almacena únicamente
el hash de la clave en metadata de la sesión Stripe. Reintentos conservan clave y UUID;
editar el abono genera un intento nuevo.

`POST /api/pago` y `POST /api/comprobante` reciben:

```json
{ "sessionId": "cs_test_...", "accessToken": "<clave guardada en la pestaña>" }
```

Ambos verifican la clave y consultan Stripe. La primera ruta devuelve `status` y,
solo cuando está pagado, `receipt` con los datos originales. La segunda devuelve
`application/pdf` únicamente para pagos confirmados sin devolución ni disputa.
No aceptan importes o datos personales aportados por el navegador para generar el PDF.
El documento identifica los pagos de prueba y aclara que no es factura fiscal.
La fecha procede del cargo de Stripe, con zona horaria de Ciudad de México.

La clave no se envía en URLs. La landing y la API desactivan el Referer; las respuestas
de la API no se cachean. El identificador de sesión aparece en el retorno de Stripe,
pero no basta para acceder al comprobante. No registrar cuerpos de estas rutas en el proxy.
Volver desde Stripe a **la misma pestaña y al mismo origen exacto** (incluye www/puerto).
Al cerrar la pestaña o limpiar su almacenamiento se pierde este acceso; el equipo puede
recuperar el pago en Stripe. No se habilita recuperación por correo sin verificación.
El PDF confirma el cobro de Stripe; no implica que Google Sheets ya haya terminado de sincronizar.

## Stripe y prueba de extremo a extremo

Usar primero claves de prueba. Registrar el endpoint HTTPS
`https://TU-DOMINIO/api/stripe/webhook` para:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Copiar su secreto de firma a `STRIPE_WEBHOOK_SECRET`. Localmente, Stripe CLI:
`stripe listen --forward-to localhost:3001/api/stripe/webhook`; usar el secreto que imprime.
Crear una sesión **a través de esta API** para incluir metadata; los eventos genéricos de
`stripe trigger` no contienen el vínculo de esta landing y se ignoran.

Completar Checkout con una tarjeta de prueba de Stripe, confirmar una fila en
`Abonos_pruebas` y reenviar el evento desde Stripe: debe permanecer una fila.
Probar importe inferior a $1,500, cancelación, pago rechazado y caída del escritor.
Ante error de Sheets se devuelve 503 para que Stripe reintente. No se responde 200
antes de confirmar la escritura. Una notificación válida pero ajena a esta landing se ignora.
El webhook verifica el cuerpo original y firma, y exige estado `paid` y moneda MXN.

Los reintentos de Stripe son finitos. Revisar entregas fallidas en Stripe y errores
`payment_sync_failed` (solo ID de evento). Si la interrupción se prolonga, recuperar con:

```sh
npm run backend:build
npm run backend:reconcile -- 2026-09-01T00:00:00Z
```

La fecha filtra **creación de sesiones**, por lo que debe anteceder a las sesiones afectadas.
Revisa todos los pagos confirmados de esta landing desde esa fecha, sin cobrar otra vez;
los ya registrados se omiten. Para filas recuperadas se marca `reconciliation` y la fecha
de recuperación, no una fecha de pago inventada. Si falla, corregir y repetir el comando.
Esta primera versión registra abonos cobrados; reembolsos y disputas se consultan en Stripe
y no se sincronizan todavía. No interpretar una suma de la hoja como saldo neto tras devoluciones.

## Despliegue en servidores privados Azure

No requiere Vercel ni servicios adicionales de Azure. En Linux o Windows:

1. Instalar Node 22+, ejecutar `npm ci` y `npm run backend:build`.
2. Configurar `.env` privado (permisos solo del usuario del servicio), `NODE_ENV=production`,
   URL HTTPS real, claves correctas y el secreto de firma del endpoint de producción.
3. Ejecutar `npm run backend:start` con su gestor de servicios (systemd, servicio Windows, etc.).
   Incluir `src/assets/fonts/Grift-500.woff2` y `Grift-700.woff2` junto al proyecto:
   el generador PDF incorpora estas fuentes desde disco para conservar la identidad visual.
4. Publicar `/api/` mediante su proxy Nginx/IIS hacia `http://127.0.0.1:3001`,
   conservando la ruta, el cuerpo original y el encabezado `Stripe-Signature`.
   Dar al proxy al menos 30 segundos para la respuesta. No exponer el puerto de Node.
5. Servir `dist/` como hasta ahora; `/api/` no debe caer en la reescritura a `index.html`.
6. Si existe un único proxy confiable, establecer `TRUST_PROXY_HOPS=1` y configurar
   el proxy para reemplazar `X-Forwarded-For` con la IP real. Ajustar según topología;
   nunca confiar en encabezados arbitrarios de Internet.
7. Permitir salida HTTPS a Stripe y Google (`script.google.com` y `script.googleusercontent.com`).
8. Verificar `GET /api/health` y hacer la prueba completa antes de usar claves reales.

El límite local de creación es 10 solicitudes por minuto e IP; en varios procesos es
por instancia. Configurar también limitación en el proxy de entrada si escalan instancias.
La comprobación de Origin no es autenticación; el endpoint de creación es público.
`/api/health` indica que el proceso responde, no comprueba las credenciales externas.

## Verificación automática

`npm run backend:test` prueba validación monetaria, Checkout simulado, firma real del SDK,
rechazo de webhooks falsos, fallo/reintento de Sheets, HMAC, deduplicación y escape de fórmulas
del Apps Script en un entorno simulado. `npm run backend:build` verifica TypeScript.
Estas pruebas no sustituyen la prueba en las cuentas reales de Stripe y Google.

# IVA fijo del 16 %

El importe del formulario es el abono antes de impuestos: $1,500.00 + $240.00 de IVA =
$1,740.00 MXN. Se redondea el impuesto a centavos. El máximo configurado limita el
total con IVA. Checkout usa una tasa manual exclusiva del 16 %, sin Stripe Tax automático.
El backend busca o crea la tasa en la cuenta de la clave configurada; si se usa una clave
restringida, necesita lectura y escritura de Tax Rates además de sus permisos actuales.

Antes de desplegar, actualizar `google-apps-script/Code.gs` y publicar una **nueva versión**
de la implementación existente (conservar la URL `/exec`). Después reconstruir el backend
Docker y publicar el frontend. No se necesitan variables de entorno adicionales.
Sheets conserva sus primeras 11 columnas: **Abono MXN (H) contiene el total cobrado**.
Agrega automáticamente L (Abono antes de impuestos MXN) y M (IVA MXN); las filas anteriores
no se modifican. La actualización es compatible con el backend anterior.

Los pagos anteriores se consultan con su desglose original. Los enlaces Checkout ya
creados conservan sus importes: para probar el IVA, iniciar un pago nuevo desde la landing.
Verificar $1,500 → $240 IVA → $1,740 total en Checkout, comprobante y Sheets antes de
aceptar pagos. Las pruebas automatizadas no hacen cargos ni contactan la cuenta Stripe.
