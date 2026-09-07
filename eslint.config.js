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
      // As variantes *TypeChecked habilitam as regras que consultam o
      // compilador — entre elas as no-unsafe-*, que pegam o `any` que
      // entra pela borda (retorno de lib sem tipagem, JSON.parse, etc).
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        // Necessário para as regras type-aware acima: sem isto o ESLint
        // não tem acesso ao programa do TypeScript e falha.
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      // O tsconfig cobre o `any` implícito; esta regra cobre o explícito.
      "@typescript-eslint/no-explicit-any": "error",

      // Falso positivo em componentes: o processador de template inline
      // sinaliza chamadas como `control.hasError(...)` no template como
      // método desacoplado, mas o Angular sempre invoca com o receiver
      // correto. Não há risco real de `this` perdido aqui.
      "@typescript-eslint/unbound-method": "off",

      // Desligada enquanto a migração para OnPush não é feita.
      // Reative depois de trocar `ChangeDetectionStrategy.Default` por
      // OnPush (ou de remover a linha, já que OnPush é o padrão no v21).
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
    // Specs geram muito ruído type-aware (mocks, spies, fixtures).
    // Este bloco vem por último para sobrescrever os anteriores.
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
]);