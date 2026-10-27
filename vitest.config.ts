import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/test/**/*.test.ts"],
          exclude: ["src/test/**/*.int.test.ts"],
        },
      },
      {
        // Needs a migrated database at DATABASE_URL. Each test creates and removes its own data.
        extends: true,
        test: {
          name: "integration",
          include: ["src/test/**/*.int.test.ts"],
        },
      },
    ],
  },
});
