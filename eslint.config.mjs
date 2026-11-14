import pluginAstro from "eslint-plugin-astro";

export default [
	{
		ignores: [
			"dist/",
			".astro/",
			"node_modules/",
			"coverage/",
			"data/",
			"*.config.*",
			"lefthook.yml",
			"src/components/**/*.astro",
			"src/pages/**/*.astro",
			"src/layouts/**/*.astro",
			"src/lib/**/*.ts",
			"src/lib/**/*.tsx",
			"src/utils/**/*.ts",
			"src/i18n/**/*.ts",
			"scripts/**/*.ts",
			"scripts/**/*.js",
			"tests/**/*.ts",
			".hermes/**",
			".impeccable/**",
			"editions/**",
			"scripts/init-thesaurus.js",
			"**/*.json",
			"**/*.jsonc",
		],
	},
	...pluginAstro.configs["flat/recommended"],
	{
		files: ["**/*.{js,jsx,mjs,cjs}"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				browser: true,
				node: true,
				es2024: true,
			},
		},
		rules: {
			"no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
			"no-console": "off",
			"prefer-const": "error",
			"no-var": "error",
		},
	},
];
