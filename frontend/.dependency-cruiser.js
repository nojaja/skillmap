import { resolve } from 'path'

/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  extends: 'dependency-cruiser/configs/recommended-strict',
  options: {
    tsConfig: {
      fileName: resolve('./tsconfig.app.json'),
    },
    doNotFollow: {
      path: 'node_modules',
    },
    includeOnly: ['^src'],
    exclude: ['src/utils/grid.ts', 'src/components/HelloWorld.vue', 'src/service-worker/sw.ts'],
  },
}

export default config
