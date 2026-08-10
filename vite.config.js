import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so GitHub Pages / tunnels work from any path host
  base: './',
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
});
