import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import js from "@eslint/js";

export default [
  // Base JavaScript rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // React rules
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": hooksPlugin,
      "@next/next": nextPlugin,
    },
    rules: {
      // Next.js rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Common TypeScript adjustments
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // Ownership guard: warn when API routes access core domain tables directly
  // instead of using repository methods with ownership checks
  {
    files: ["src/app/api/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "MemberExpression[object.property.name='booking'][property.name='findUnique']",
          message: "Use BookingRepository.findByIdForProvider/findByIdForCustomer instead of prisma.booking.findUnique for IDOR protection.",
        },
        {
          selector: "MemberExpression[object.property.name='booking'][property.name='findFirst']",
          message: "Use BookingRepository.findByIdForProvider/findByIdForCustomer instead of prisma.booking.findFirst for IDOR protection.",
        },
      ],
    },
  },

  // Sanitize library - intentionally uses control characters in regex
  {
    files: ["src/lib/sanitize.ts"],
    rules: {
      "no-control-regex": "off",
      "no-useless-escape": "off",
    },
  },

  // Ignore patterns
  {
    ignores: [
      ".next/**",
      ".worktrees/**",
      ".claude/worktrees/**",
      ".agents/**",
      "out/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "*.config.js",
      "*.config.mjs",
      "next-env.d.ts",
      "public/sw.js",
      "public/swe-worker*.js",
      "public/swe-worker*.js.map",
    ],
  },
];
