import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactJsx from "eslint-plugin-react-jsx";
import reactX from "eslint-plugin-react-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**"]),
  {
    files: ["**/*.config.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      sourceType: "commonjs",
    },
  },
  {
    files: ["**/*.config.mjs"],
    extends: [js.configs.recommended],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      jsxA11y.configs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-jsx": reactJsx,
      "react-x": reactX,
    },
    rules: {
      "react-jsx/no-comment-textnodes": "error",
      "react-jsx/no-namespace": "error",
      "react-jsx/no-useless-fragment": "error",
      "react-x/no-class-component": "error",
      "react-x/no-create-ref": "error",
      "react-x/no-missing-component-display-name": "error",
      "react-x/no-missing-key": "error",
      "react-x/no-unstable-context-value": "error",
    },
  },
]);
