/**
 * Lint 规则，承接 charles-coding 里 Prettier 管不到的排版与约束
 * 创建日期：2026-09-21
 * 修改日期：2026-11-23
 */
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["node_modules/", ".wrangler/", "test_cases/"],
	},

	...tseslint.configs.recommendedTypeChecked,

	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["*.js", "*.ts"],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},

	{
		files: ["**/*.{js,mjs,ts}"],
		rules: {
			"padding-line-between-statements": [
				"error",
				{ blankLine: "always", prev: "*", next: "return" },
			],
			"lines-between-class-members": ["error", "always"],
			"object-curly-newline": ["error", { multiline: true, consistent: true }],
			"no-magic-numbers": [
				"error",
				{
					ignore: [0, 1, -1],
					ignoreArrayIndexes: true,
					enforceConst: true,
					detectObjects: false,
				},
			],
			"no-nested-ternary": "error",
			"no-var": "error",
			eqeqeq: ["error", "always"],
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/consistent-type-imports": "error",
		},
	},

	{
		files: ["**/*.{js,mjs}"],
		...tseslint.configs.disableTypeChecked,
	},

	{
		files: ["tests/**/*.ts"],
		rules: {
			"no-magic-numbers": "off",
		},
	},
);
