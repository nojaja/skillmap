import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  rootDir: __dirname,
  roots: [__dirname, path.resolve(__dirname, '../test')],
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/../test/unit/server/**/*.test.ts'],
  verbose: true,
  collectCoverage: true,
  coverageDirectory: '<rootDir>/../coverage/server',
  collectCoverageFrom: ['<rootDir>/src/skillTreeService.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: path.join(__dirname, 'tsconfig.jest.json'),
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
