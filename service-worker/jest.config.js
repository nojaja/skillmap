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
  testMatch: ['<rootDir>/../test/unit/service-worker/**/*.test.ts'],
  verbose: true,
  forceExit: true,
  collectCoverage: true,
  coverageDirectory: '<rootDir>/../coverage/service-worker',
  collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: path.join(__dirname, 'tsconfig.jest.json'),
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
