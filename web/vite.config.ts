import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadBase = () => ((globalThis as any).process?.env?.VITE_BASE as string | undefined) ?? "/";

export default defineConfig({
  base: loadBase(),
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
