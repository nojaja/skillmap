import { resolve } from 'path'

/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  extends: 'dependency-cruiser/configs/recommended-strict',
  options: {
    tsConfig: {
      fileName: resolve('./tsconfig.json'),
    },
    doNotFollow: {
      path: 'node_modules',
    },
    includeOnly: ['^src'],
  },
}

export default config
