import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Bewusst minimal: kein Framework, kein CSS-Präprozessor, keine Plugins.
 * Vite liefert hier nur Dev-Server, ES-Modul-Bündelung und Minifizierung.
 *
 * Zwei Einstiegspunkte, weil das Impressum eine eigene Seite ist und ohne
 * JavaScript auskommen soll.
 */
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        impressum: resolve(__dirname, 'impressum.html'),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
