import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/src-tauri/**",
      "**/github_upload/**",
      "**/distribution/**",
      "**/release/**",
    ],
  },
});
