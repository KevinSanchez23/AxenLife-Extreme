# Axen Life Extreme · Whistler — Vite + React

Landing del evento **Axen Life Extreme** migrada a **Vite + React** (JavaScript),
conservando el mismo diseño, animaciones (GSAP + ScrollTrigger + Lenis) y la
flujo de abono conectado a Stripe mediante el backend.

El backend de Stripe y Google Sheets está en `server/`. Configuración, contrato de API,
pruebas y despliegue en Azure: [server/README.md](server/README.md).
El formulario valida el mínimo de $1,500 MXN, abre Stripe y verifica el pago al volver.
El comprobante se descarga en PDF desde el backend. Configurar las cuentas y probar
en modo de prueba antes de habilitar cobros reales.

## Requisitos

- Node.js 18+ (recomendado 20/22)

## Puesta en marcha

```bash
npm install      # instala dependencias
npm run dev      # desarrollo con hot-reload (http://localhost:5173)
npm run build    # genera el sitio estático en dist/
npm run preview  # sirve el build de dist/ para revisarlo
```

Para publicar, sube el contenido de `dist/` a cualquier hosting estático
(Vercel, Netlify, un bucket, etc.).

## Estructura

```
index.html                 Punto de entrada de Vite (fuentes + <div id="root">)
vite.config.js             base:'./' → rutas relativas (funciona en subcarpetas)
src/
  main.jsx                 Monta React e importa styles.css global
  App.jsx                  Composición + estado (menú, modales, pausa) + WebMCP
  styles.css               Sistema de diseño y animaciones (CSS global)
  data/site.js             CONTENIDO editable: ponentes, navegación, marquee
  lib/scroll.js            Smooth scroll compartido (Lenis)
  hooks/useSite.js         Animaciones: Lenis, GSAP parálax, revelados, cristal,
                           cursor copo, nieve, magnético, ascenso, pausa
  components/
    Header, MenuOverlay, Hero, Marquee, Speakers, Experience, Closing,
    Footer, Cursor, Ascent, Button, kinetic, PaymentDialog, WhatsappDialog
  assets/                  Imágenes y logos (Vite los versiona en el build)
```

## Cómo actualizar el contenido

- **Ponentes / navegación / marquee** → `src/data/site.js` (arreglos data-driven).
  Agregar o quitar un ponente = editar el arreglo `speakers`.
- **WhatsApp real** → en `src/App.jsx`, define `WHATSAPP_NUMBER` con los dígitos
  internacionales (sin `+`). Con número válido, el botón abre wa.me; si no, muestra
  el aviso "por confirmar".
- **Estilos** → `src/styles.css` (tokens de color en `:root`, acento glaciar `--frost`).

## Notas

- Respeta `prefers-reduced-motion` y el botón "Pausar animaciones".
- Los pagos requieren el backend, Stripe y el Apps Script de Google Sheets configurados.
- Fuentes desde Google Fonts (única dependencia externa en runtime).
