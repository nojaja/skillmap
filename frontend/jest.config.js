import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  rootDir: __dirname,
  roots: [__dirname, path.resolve(__dirname, '../test')],
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'mjs', 'cjs'],
  testMatch: ['<rootDir>/../test/unit/frontend/**/*.test.ts'],
  verbose: true,
  collectCoverage: true,
  coverageDirectory: '<rootDir>/../coverage/frontend',
  collectCoverageFrom: ['<rootDir>/src/utils/**/*.ts'],
  coveragePathIgnorePatterns: ['/stores/skillStore.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: path.join(__dirname, 'tsconfig.jest.json'),
        // テストでは型チェックを省略し、Vite/esbuildと同様にトランスパイルのみ実施する
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^pinia$': '<rootDir>/../test/mocks/pinia.ts',
    '.*/stores/skillStore\\.ts$': '<rootDir>/../test/mocks/skillStore.ts',
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
