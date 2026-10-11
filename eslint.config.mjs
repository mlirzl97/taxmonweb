import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  {
    ignores: [".next/**", ".next-*/*", "coverage/**", "playwright-report/**", "test-results/**"],
  },
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    ".next-qa/**",
    ".next-audit/**",
    ".next-cache-backup/**",
    ".next-verification/**",
    "out/**",
    "coverage/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
