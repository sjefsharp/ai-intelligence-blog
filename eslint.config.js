export default [
  {
    ignores: [
      "dist/",
      ".astro/",
      "node_modules/",
      "coverage/",
      "data/",
      "*.config.*",
      "lefthook.yml"
    ]
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        browser: true,
        node: true,
        es2024: true
      }
    },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
        }
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error"
    }
  },
  {
    files: ["**/*.astro"],
    processor: "astro/astro",
    languageOptions: {
      parser: require.resolve("astro-eslint-parser"),
      parserOptions: {
        extraFileExtensions: [".astro"]
      }
    },
    rules: {
      "astro/no-unused-define-vars": "warn",
      "astro/missing-client-only-directive-value": "error",
      "astro/no-set-html-directive": "error"
    }
  }
]