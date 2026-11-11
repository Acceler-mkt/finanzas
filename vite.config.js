import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Rutas relativas: la app funciona igual en la raíz de un dominio que en una subcarpeta.
  base: './',
  plugins: [preact()],
  server: { port: 8801, strictPort: true },
  test: { environment: 'node', testTimeout: 60000, hookTimeout: 60000 },
});
