import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src/webchat",
  base: "./",
  build: {
    outDir: resolve(__dirname, "api_webchat"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/webchat/index.html"),
      external: [
        "../options/mzta-options-default.js",
        "../js/mzta-placeholders.js",
        "../js/mzta-utils.js",
        "../js/mzta-prompts.js",
      ],
    },
  },
});
