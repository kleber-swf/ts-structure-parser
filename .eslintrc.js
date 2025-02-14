// const airbnb = require('eslint-config-airbnb-base/rules/variables');

// const noRestrictedGlobals = airbnb.rules['no-restricted-globals'];
module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
	ignorePatterns: [
		'*.d.ts',
		'dist',
		'build',
		'node_modules',
		'resources/**/atlas',
		'resources/**/audiosprite',
		'resources/**/spine',
		'.vscode',
		'.husky',
		'schema',
	],
	extends: [
		// 'airbnb-base/legacy',
		'plugin:@typescript-eslint/recommended',
	],
	rules: {
		'no-tabs': 'off',
		indent: ['error', 'tab', { SwitchCase: 1 }],
		quotes: ['error', 'single'],
		semi: ['error', 'always'],
		curly: ['error', 'multi-line'],
		'max-len': [
			'warn',
			{
				code: 140,
				ignoreStrings: true,
				ignoreTemplateLiterals: true,
				ignoreRegExpLiterals: true,
			},
		],
		'comma-dangle': [
			'warn',
			{
				arrays: 'always-multiline',
				objects: 'always-multiline',
				imports: 'always-multiline',
				exports: 'always-multiline',
				functions: 'never',
			},
		],
		'no-underscore-dangle': 'off',
		'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
		'padding-line-between-statements': [
			'error',
			{ blankLine: 'always', prev: 'export', next: '*' },
			{ blankLine: 'always', prev: 'import', next: '*' },
			{ blankLine: 'never', prev: 'import', next: 'import' },
			{ blankLine: 'any', prev: 'export', next: 'export' },
		],
		'array-element-newline': ['error', 'consistent'],
		'new-cap': ['error', {
			newIsCap: true,
			capIsNew: false,
			properties: false,
			newIsCapExceptions: ['ctor'],
		}],

		'object-curly-newline': ['error', { ImportDeclaration: 'never' }],
		'function-paren-newline': ['error', 'consistent'],

		'object-shorthand': ['error', 'always', { avoidQuotes: true, ignoreConstructors: true, avoidExplicitReturnArrows: true }],
		'newline-per-chained-call': ['error', { ignoreChainWithDepth: 3 }],

		'one-var': 'off',
		'one-var-declaration-per-line': 'off',
		'no-multi-assign': 'off',

		'no-unused-vars': 'off',
		'@typescript-eslint/no-unused-vars': 'off',
		'@typescript-eslint/no-var-requires': 'off',

		'no-bitwise': 'off',
		'no-plusplus': 'off',
		'no-continue': 'off',
		'class-methods-use-this': 'off',

		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/no-empty-function': 'off',
		'@typescript-eslint/no-shadow': ['error'],
		'no-shadow': 'off',

		// 'no-restricted-globals': noRestrictedGlobals,
		'no-param-reassign': 'off',
		'no-use-before-define': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'default-case': 'off',
		'no-return-assign': 'off',
		'max-classes-per-file': 'off',

		// this could be set true for release builds
		'no-console': 'off',

		// 'no-restricted-imports': ['error', {
		// 	paths: [
		// 		// avoid importing node.js core imports
		// 		'assert',
		// 		'buffer',
		// 		'child_process',
		// 		'cluster',
		// 		'crypto',
		// 		'dgram',
		// 		'dns',
		// 		'domain',
		// 		'events',
		// 		'freelist',
		// 		'fs',
		// 		'http',
		// 		'https',
		// 		'module',
		// 		'net',
		// 		'os',
		// 		'path',
		// 		'punycode',
		// 		'querystring',
		// 		'readline',
		// 		'repl',
		// 		'smalloc',
		// 		'stream',
		// 		'string_decoder',
		// 		'sys',
		// 		'timers',
		// 		'tls',
		// 		'tracing',
		// 		'tty',
		// 		'url',
		// 		'util',
		// 		'vm',
		// 		'zlib',
		// 	],
		// 	patterns: ['index'],
		// }],

		// specific for framework
		'@typescript-eslint/no-this-alias': 'off',
		'@typescript-eslint/no-empty-interface': 'off',
		'no-namespace': 'off',
		'@typescript-eslint/no-namespace': 'off',
		'no-cond-assign': 'off',
		'no-nested-ternary': 'off',
		'@typescript-eslint/explicit-member-accessibility': 'off',
	},
	overrides: [
		{
			files: ['*.ts'],
			rules: {
				'@typescript-eslint/explicit-member-accessibility': 'error',
			},
		}
	],
};
