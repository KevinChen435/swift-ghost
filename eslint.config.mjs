import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "evidence/**",
    "public/vendor/**",
    "judge-gateway/.wrangler*/**",
    "judge-gateway/node_modules/**",
    "judge-gateway/root-compat.d.ts",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
