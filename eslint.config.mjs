import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const typescriptRecommended = tseslint.configs.recommended.map((config) => ({
  ...config,
  files: ["**/*.{ts,tsx}"],
}));

const restrictedLayerImports = (patterns) => [
  "error",
  {
    patterns: patterns.map((group) => ({
      group,
      message: "Import crosses an architectural layer boundary.",
    })),
  },
];

export default [
  {
    ignores: [
      "dist",
      "dist-qa",
      "dist-beta",
      "site",
      "coverage",
      "playwright-report",
      "test-results",
      ".playwright-site-root",
    ],
  },
  {
    ...js.configs.recommended,
    files: ["**/*.{js,jsx,mjs}"],
  },
  ...typescriptRecommended,
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedLayerImports([
        ["../application/**", "../../application/**"],
        ["../infrastructure/**", "../../infrastructure/**"],
        ["../features/**", "../../features/**"],
        ["../app/**", "../../app/**"],
        ["../qa/**", "../../qa/**"],
        ["react", "react-dom", "react-dom/**"],
      ]),
    },
  },
  {
    files: ["src/application/**/*.{ts,tsx}"],
    ignores: ["src/application/react/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedLayerImports([
        ["../infrastructure/**", "../../infrastructure/**"],
        ["../features/**", "../../features/**"],
        ["../app/**", "../../app/**"],
        ["../qa/**", "../../qa/**"],
        ["react", "react-dom", "react-dom/**"],
      ]),
    },
  },
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedLayerImports([
        ["../../infrastructure/**", "../infrastructure/**"],
        ["../../app/**", "../app/**"],
        ["../../qa/**", "../qa/**"],
      ]),
    },
  },
  {
    files: ["src/infrastructure/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedLayerImports([
        ["../../features/**", "../features/**"],
        ["../../app/**", "../app/**"],
        ["../../qa/**", "../qa/**"],
      ]),
    },
  },
  {
    files: ["src/**/*.{jsx,tsx}"],
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
