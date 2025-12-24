import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  /* --------------------------------
   * Ignore paths
   * -------------------------------- */
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      ".env",
      "next.config.js",
      "postcss.config.js",
    ],
  },

  /* --------------------------------
   * Global environments
   * -------------------------------- */
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  /* --------------------------------
   * Next.js rules
   * -------------------------------- */
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  /* --------------------------------
   * Base JavaScript rules
   * -------------------------------- */
  js.configs.recommended,

  /* --------------------------------
   * TypeScript rules (recommended)
   * -------------------------------- */
  ...tseslint.configs.recommended,

  /* --------------------------------
   * FINAL OVERRIDES (ORDER MATTERS)
   * -------------------------------- */
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      /* Disable base rules that conflict with TS */
      "no-unused-vars": "off",
      "no-undef": "off",

      /* Use TS-aware versions */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      /* Allow `any` */
      "@typescript-eslint/no-explicit-any": "off",

      "@typescript-eslint/no-unused-expressions": [
        "warn",
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],
      /* Style / sanity rules */
      "class-methods-use-this": "warn",
      "eol-last": ["warn", "always"],
      "no-multiple-empty-lines": ["error", { max: 1 }],
      "no-useless-constructor": "off",
      "no-loop-func": "off",
      "@next/next/no-img-element": "off",
    },
  },
];
