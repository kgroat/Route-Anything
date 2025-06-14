import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths({ root: 'tests' })],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
