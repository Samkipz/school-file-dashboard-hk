import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Legacy auth wrapper typing is visible debt; auth changes are outside R5B.
    files: ['app/api/auth/**/route.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
])
