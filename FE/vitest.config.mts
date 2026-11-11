import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { NEXT_PUBLIC_BIBBIDI_API_BASE_URL: "" },
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost:3000/",
      },
    },
    setupFiles: ["./src/test/setup.ts"],
  },
});
