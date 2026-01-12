import { resolve } from 'path'

/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  options: {
    tsConfig: {
      fileName: resolve('./tsconfig.app.json'),
    },
    doNotFollow: {
      path: 'node_modules',
    },
    includeOnly: ['^src'],
  },
  forbidden: [],
}

export default config
