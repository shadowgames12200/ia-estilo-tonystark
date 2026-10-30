import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

// Definição de __dirname para ambiente ESM (Node.js moderno)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]react(?:-dom)?[\\/]/.test(id) || id.includes("/wouter/")) return "vendor-react";
          if (id.includes("framer-motion") || id.includes("lucide-react") || id.includes("sonner")) return "vendor-ui";
          if (id.includes("mermaid") || id.includes("cytoscape")) return "vendor-diagrams";
          return "vendor-common";
        },
      },
    },
  },
} );
