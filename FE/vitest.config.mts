import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __BIBBIDI_API_BASE_URL__: JSON.stringify(""),
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost:3000/",
      },
    },
    setupFiles: ["./src/test/setup.ts"],
  },
});
