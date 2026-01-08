/// <reference lib="WebWorker" />
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import { setupLifecycle } from '../sw/service/swLifecycle.ts'
import { setupMessageHandler } from '../sw/service/swAdapter.ts'
export { DEFAULT_TREE_ID, DEFAULT_POINTS } from '../sw/domain/skillTypes.ts'
export {
  sanitizeTreeId,
  normalizeNodes,
  normalizeConnections,
  normalizeSkillTreePayload,
  normalizeStatusPayload,
  mergeByUpdatedAt,
} from '../sw/domain/skillNormalizer.ts'

const swScope: ServiceWorkerGlobalScope | null = typeof self !== 'undefined' ? (self as unknown as ServiceWorkerGlobalScope) : null

if (swScope) {
  setupLifecycle(swScope)
  setupMessageHandler(swScope)
}