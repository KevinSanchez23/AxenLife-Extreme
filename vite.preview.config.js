import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build especial para una PREVIEW autónoma en un solo archivo:
// - inlinea todos los assets como data-URI (assetsInlineLimit alto)
// - un solo CSS (cssCodeSplit:false)
// - bundle IIFE (script clásico) para poder abrirlo con file:// sin CORS
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-preview',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
  plugins: [react()],
});
