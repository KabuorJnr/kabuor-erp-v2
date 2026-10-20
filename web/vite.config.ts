import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API runs on :5080 in development; the built app is served by the API itself (wwwroot).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5080' } },
  build: { outDir: '../src/Kabuor.Erp.Api/wwwroot', emptyOutDir: true },
});
