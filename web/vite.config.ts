import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@contract": path.resolve(__dirname, "../supabase/functions/_shared/contract"),
      zod: path.resolve(__dirname, "node_modules/zod"),
      "date-fns": path.resolve(__dirname, "node_modules/date-fns"),
    },
  },
  server: { port: 5173 },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
