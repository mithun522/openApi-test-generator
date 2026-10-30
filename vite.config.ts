/// <reference types="vitest" />
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset URLs relative, so the build works on a GitHub Pages project site or a custom domain
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // two pages: the test-case generator and the system documentation
    rollupOptions: { input: { tests: resolve(__dirname, "index.html"), docs: resolve(__dirname, "docs.html") } },
    // mermaid ships large lazily-loaded chunks for diagram types we never draw (mindmap, ELK); they are never fetched
    chunkSizeWarningLimit: 1600,
  },
  test: { environment: "node" },
});
