import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  entryPoints: [path.join(__dirname, 'src/main.ts')],
  tsconfig: path.join(__dirname, 'tsconfig.app.json'),
  plugin: ['typedoc-plugin-markdown'],
  out: path.join(__dirname, '../docs/typedoc-md/frontend'),
  excludePrivate: true,
}
