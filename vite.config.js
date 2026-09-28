import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' → rutas relativas en el build, para poder alojar el sitio en
// cualquier subcarpeta o abrir el dist directamente. Cámbialo a '/' si lo
// sirves desde la raíz de un dominio.
export default defineConfig({
  base: './',
  plugins: [react()],
});
