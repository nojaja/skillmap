/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import { getRoot, ensureDir } from './opfsClient.ts'

export const readJsonFile = async <T>(pathParts: string[], fallback: T): Promise<T> => {
  try {
    const root = await getRoot()
    const filename = pathParts[pathParts.length - 1]
    const dirParts = pathParts.slice(0, -1)
    const dir = dirParts.length > 0 ? await ensureDir(root, dirParts) : root
    const fileHandle = await dir.getFileHandle(filename ?? '', { create: false })
    const file = await fileHandle.getFile()
    const content = await file.text()
    return JSON.parse(content) as T
  } catch (error) {
    const name = (error as Record<string, unknown>).name
    if (name !== 'NotFoundError') {
      console.error('OPFS read failed', error)
    }
    return fallback
  }
}

export const writeJsonFile = async (pathParts: string[], data: unknown): Promise<void> => {
  const root = await getRoot()
  const filename = pathParts[pathParts.length - 1]
  const dirParts = pathParts.slice(0, -1)
  const dir = dirParts.length > 0 ? await ensureDir(root, dirParts) : root
  const fileHandle = await dir.getFileHandle(filename ?? '', { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(JSON.stringify(data))
  await writable.close()
}
