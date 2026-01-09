/// <reference lib="WebWorker" />
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import { setupLifecycle } from './service/swLifecycle'
import { setupMessageHandler } from './service/swAdapter'
export { DEFAULT_TREE_ID, DEFAULT_POINTS } from './domain/skillTypes'
export {
  sanitizeTreeId,
  normalizeNodes,
  normalizeConnections,
  normalizeSkillTreePayload,
  normalizeStatusPayload,
  mergeByUpdatedAt,
} from './domain/skillNormalizer'

const swScope: ServiceWorkerGlobalScope | null = typeof self !== 'undefined' ? (self as unknown as ServiceWorkerGlobalScope) : null

if (swScope) {
  setupLifecycle(swScope)
  setupMessageHandler(swScope)
}
