// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      // The *TypeChecked variants enable the rules that consult the
      // compiler — among them the no-unsafe-* ones, which catch `any`
      // coming in from the edges (untyped lib returns, JSON.parse, etc).
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        // Required by the type-aware rules above: without it ESLint has
        // no access to the TypeScript program and fails.
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      // The tsconfig covers implicit `any`; this rule covers the explicit one.
      "@typescript-eslint/no-explicit-any": "error",

      // False positive in components: the inline template processor flags
      // calls such as `control.hasError(...)` in the template as detached
      // methods, but Angular always invokes them with the right receiver.
      // There is no real risk of a lost `this` here.
      "@typescript-eslint/unbound-method": "off",

      // Off until the OnPush migration is done.
      // Re-enable after replacing `ChangeDetectionStrategy.Default` with
      // OnPush (or removing the line, since OnPush is the default in v21).
      "@angular-eslint/prefer-on-push-component-change-detection": "off",

      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {},
  },
  {
    // Specs generate a lot of type-aware noise (mocks, spies, fixtures).
    // This block comes last so it overrides the previous ones.
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
]);
