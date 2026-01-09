// @ts-check
const path = require('path')
const js = require('@eslint/js')
const jsdoc = require('eslint-plugin-jsdoc')
const sonarjs = require('eslint-plugin-sonarjs')
const tseslint = require('typescript-eslint')

module.exports = tseslint.config(
  {
    ignores: ['public/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts', '../test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'tsconfig.jest.json'),
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      jsdoc,
      sonarjs,
    },
    rules: {
      'no-unused-vars': 'warn',
      'sonarjs/cognitive-complexity': ['error', 10],
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
        },
      ],
      'jsdoc/require-param': 'error',
      'jsdoc/require-returns': 'error',
    },
  },
  {
    files: ['../test/**/*.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
    },
  },
)
