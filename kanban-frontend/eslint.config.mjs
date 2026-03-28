import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Type-aware rules: catch async/await issues before code review
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tsPlugin },
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Catch async functions whose returned Promise is not handled
      // (e.g., onClick={asyncFn} without void keyword)
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
      // Upgrade exhaustive-deps from warning to error
      "react-hooks/exhaustive-deps": "error",
    },
  },
]);

export default eslintConfig;
