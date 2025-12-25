import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  entryPoints: [path.join(__dirname, 'src/index.ts'), path.join(__dirname, 'src/skillTreeService.ts')],
  tsconfig: path.join(__dirname, 'tsconfig.json'),
  plugin: ['typedoc-plugin-markdown'],
  out: path.join(__dirname, '../docs/typedoc-md/server'),
  excludePrivate: true,
}
