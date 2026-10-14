// Build estático para o GitHub Pages (gera index.html + arquivos na pasta /docs do repositório).
// Uso: npx vite build --config vite.static.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../../docs", import.meta.url)),
    emptyOutDir: true,
  },
});
