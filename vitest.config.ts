import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "packages/**/*.test.ts",
      "services/**/*.test.ts",
      "apps/**/*.test.ts"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"]
    }
  },
  resolve: {
    alias: {
      "@kerala-lottery/domain": path.resolve(__dirname, "packages/domain/src"),
      "@kerala-lottery/validation": path.resolve(__dirname, "packages/validation/src"),
      "@kerala-lottery/statistics": path.resolve(__dirname, "packages/statistics/src"),
      "@kerala-lottery/experiments": path.resolve(__dirname, "packages/experiments/src"),
      "@kerala-lottery/ai": path.resolve(__dirname, "packages/ai/src"),
      "@kerala-lottery/knowledge": path.resolve(__dirname, "packages/knowledge/src"),
      "@kerala-lottery/documents": path.resolve(__dirname, "packages/documents/src"),
      "@kerala-lottery/data": path.resolve(__dirname, "packages/data/src")
    }
  }
});
