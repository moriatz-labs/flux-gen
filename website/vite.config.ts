import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname),
  publicDir: "public",
  build: {
    outDir: resolve(import.meta.dirname, "..", "dist", "website"),
    emptyOutDir: true
  }
});
