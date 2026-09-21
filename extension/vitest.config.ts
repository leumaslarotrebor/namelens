import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __API_BASE__: JSON.stringify("https://api.test"), __WEB_BASE__: JSON.stringify("https://web.test") },
  test: { environment: "jsdom", globals: true },
});
