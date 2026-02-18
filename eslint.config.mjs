import eslint from '@eslint/js'

export default [
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...eslint.configs.recommended,
  },
  {
    ignores: ['dist/', 'coverage/', 'node_modules/', '__tests__/'],
  },
]
