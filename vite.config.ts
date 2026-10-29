/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset URLs relative, so the build works on a GitHub Pages project site or a custom domain
export default defineConfig({
  base: "./",
  plugins: [react()],
  // mermaid ships large lazily-loaded chunks for diagram types we never draw (mindmap, ELK); they are never fetched
  build: { chunkSizeWarningLimit: 1600 },
  test: { environment: "node" },
});
