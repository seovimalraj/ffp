// Flat ESLint config for the entire monorepo (ESLint v9)
// Lightweight, type-safe enough to surface unused vars/imports without requiring TS project service
import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  // Global ignores
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/*.generated.*",
      "artifacts/**",
      "artifacts*",
      "apps/**/build/**",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        // Do not enable type-aware linting here; keep it fast and robust across packages
        projectService: false,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      // Disable base rule in favor of TS-aware version
      "no-unused-vars": "off",
      // Promote hygiene without being too noisy on first pass
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Test files: enable Jest globals to avoid no-undef on describe/it/expect
  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
