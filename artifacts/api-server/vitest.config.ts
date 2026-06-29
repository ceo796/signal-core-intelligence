import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      XAI_API_KEY: "test-xai-key",
      CLERK_BYPASS_AUTH: "true",
      DEV_USER_ID: "test-user-bypass",
      APPROVED_EMAILS: "test@signal87.test",
      PRIVATE_OBJECT_DIR: "",
      DEFAULT_OBJECT_STORAGE_BUCKET_ID: "",
    },
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
