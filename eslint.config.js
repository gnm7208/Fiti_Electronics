import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    {
        files: ['server.js', 'server/**/*.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
];
