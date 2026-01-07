import { resolve } from 'path'

/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  extends: 'dependency-cruiser/configs/recommended-strict',
  options: {
    tsConfig: {
      fileName: resolve('./tsconfig.app.json'),
    },
    doNotFollow: {
      path: 'node_modules|^src/service-worker',
    },
    includeOnly: ['^src'],
    exclude: ['src/components/HelloWorld.vue'],
  },
  ruleSet: {
    allowedSeverityChanges: [
      {
        name: 'no-orphans',
        from: 'error',
        to: 'ignore',
      },
    ],
    forbidden: [
      {
        name: 'no-orphans',
        severity: 'error',
        from: {},
        to: {
          orphan: true,
          pathNot: '^(src/service-worker/)',
        },
      },
    ],
  },
}

export default config
