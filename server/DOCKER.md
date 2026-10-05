# Backend con Docker y Apache

Requiere Docker Engine y el complemento Docker Compose en el servidor Linux.
Node.js y npm se ejecutan dentro de la imagen; no se instalan en el servidor.
Apache debe estar en el mismo host para acceder al puerto publicado en loopback.

## Primera instalación

Desde el repositorio, fuera de `public_html`:

```bash
cd /var/www/extreme.danteeludier.com/app
cp .env.example .env
chmod 600 .env
nano .env
```

Si ya existe `.env`, edítalo sin copiar encima el ejemplo. Completa las claves de Stripe,
el secreto del webhook público y los datos de Apps Script. Para este dominio:

```env
PUBLIC_SITE_URL=https://extreme.danteeludier.com/
TRUST_PROXY_HOPS=1
```

El valor de proxy presupone un único Apache delante del backend. Revisar si hay más
proxies o balanceadores. Compose establece `NODE_ENV=production`, `HOST=0.0.0.0` y
`PORT=3001` dentro del contenedor. Por ello la URL pública debe usar HTTPS.
Las claves se inyectan al iniciar, no se incluyen en el contexto de build ni la imagen.

```bash
docker compose config --quiet
docker compose up -d --build backend
docker compose ps
curl --fail http://127.0.0.1:3001/api/health
```

La respuesta esperada es `{"ok":true}`. Esta comprobación valida que el proceso
responde, no los permisos de Stripe ni la conexión con Google. No ejecutar además
el antiguo servicio systemd de Node: ambos intentarían ocupar el puerto 3001.
El estado unhealthy no reinicia por sí solo el contenedor; revisar sus logs.

## Reverse proxy

En el VirtualHost HTTPS existente de `extreme.danteeludier.com`, con `proxy` y
`proxy_http` habilitados, conservar los certificados y el DocumentRoot de la landing:

```apache
ProxyRequests Off
ProxyPass        "/api/" "http://127.0.0.1:3001/api/" timeout=30
ProxyPassReverse "/api/" "http://127.0.0.1:3001/api/"
```

Excluir `/api/` de cualquier reescritura a `index.html`. Validar la configuración
de Apache antes de recargar. El puerto 3001 no requiere apertura en Azure.
El webhook de Stripe es `https://extreme.danteeludier.com/api/stripe/webhook`.
La imagen no sirve ni compila la landing: Apache continúa sirviendo `public_html`.

## Actualización y diagnóstico

```bash
git pull --ff-only
docker compose up -d --build backend
docker compose ps
docker compose logs --tail=100 backend
```

Después de modificar `.env`, recrear el contenedor para cargar las variables:

```bash
docker compose up -d --force-recreate backend
```

No basta con `docker compose restart` para aplicar variables nuevas.
Para recuperar pagos faltantes usando la configuración del contenedor:

```bash
docker compose exec backend node dist-server/reconcile.js 2026-10-01T00:00:00Z
```

Elegir la fecha inicial adecuada; el comando puede escribir abonos confirmados en Sheets.
El PDF se genera en memoria; no hay base de datos ni volumen persistente del backend.
