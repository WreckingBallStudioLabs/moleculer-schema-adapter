/*
 * Add the following options to your VScode to enable real-time error check.
 * For other IDEs, please follow the same "idea".
 *
 * Note: If you have ESLint installed globally, you may consider removing it,
 * as you may work in a project that requires and operates with a different
 * version, and perhaps even incompatible with the global version.

"eslint.alwaysShowStatus": true,
"eslint.validate": [
	"javascript",
	"javascriptreact",
	"typescript",
	"typescriptreact"
],
"sqltools.telemetry": false,
"[javascript]": {
	"editor.defaultFormatter": "vscode.typescript-language-features"
},
"[yaml]": {
	"editor.defaultFormatter": "redhat.vscode-yaml"
},
"[jsonc]": {
	"editor.defaultFormatter": "vscode.json-language-features"
}
 */
module.exports = {
	"parser": "babel-eslint",
	"root": true,
	"env": {
		"node": true,
		"commonjs": true,
		"es6": true,
		"jquery": false,
		"jest": true,
		"jasmine": true
	},
	"extends": "eslint:recommended",
	"parserOptions": {
		"sourceType": "module",
		"ecmaFeatures": {
			"ecmaVersion": "8",
			"experimentalObjectRestSpread": true,
			"jsx": true
		}
	},
	"rules": {
		"indent": [
			"warn",
			"tab",
			{ "SwitchCase": 1 }
		],
		"quotes": [
			"warn",
			"double"
		],
		"semi": [
			"error",
			"always"
		],
		"no-var": [
			"error"
		],
		"no-console": [
			"off"
		],
		"no-unused-vars": [
			"warn"
		],
		"no-mixed-spaces-and-tabs": [
			"warn"
		]
	}
};
