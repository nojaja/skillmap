/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */

type StorageWithDirectory = StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> }

export type NavigatorWithOPFS = (Navigator | WorkerNavigator) & {
  storage?: StorageWithDirectory
}

declare global {
  // OPFS storage capability exposed on both navigator types in worker context
  interface Navigator {
    storage?: StorageWithDirectory
  }
  interface WorkerNavigator {
    storage?: StorageWithDirectory
  }
}

const swScope: ServiceWorkerGlobalScope | null = typeof self !== 'undefined' ? (self as unknown as ServiceWorkerGlobalScope) : null

export const getRoot = async (scope: ServiceWorkerGlobalScope | null = swScope): Promise<FileSystemDirectoryHandle> => {
  if (!scope) throw new Error('Service Worker scope is not available')
  const storage = (scope.navigator as unknown as NavigatorWithOPFS).storage
  if (!storage?.getDirectory) {
    throw new Error('OPFS がサポートされていません')
  }
  return storage.getDirectory()
}

export const ensureDir = async (root: FileSystemDirectoryHandle, parts: string[]): Promise<FileSystemDirectoryHandle> => {
  let dir = root
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  return dir
}
