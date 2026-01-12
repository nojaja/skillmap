/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns, no-unused-vars */
import { sanitizeTreeId } from '../domain/skillNormalizer'
import type { SkillTreeRepository } from '../application/skillTreeRepository'
import { SkillTreeRepositoryImpl } from '../infrastructure/skillTreeRepositoryImpl'
import { BroadcastChannelGateway } from '../infrastructure/notification/broadcastChannelGateway'
import { SkillTreeService } from '../application/skillTreeService'
import { SkillStatusService } from '../application/skillStatusService'

export type SkillmapCommand =
  | 'get-status'
  | 'save-status'
  | 'get-skill-tree'
  | 'save-skill-tree'
  | 'export'
  | 'import'
  | 'delete-skill-tree'
  | 'list-skill-trees'

export type SkillmapRequestPayload = {
  fallback?: unknown
  tree?: unknown
  status?: unknown
}

export const setupMessageHandler = (swScope: ServiceWorkerGlobalScope): void => {
  const repo: SkillTreeRepository = new SkillTreeRepositoryImpl()
  const gateway = new BroadcastChannelGateway()
  const treeService = new SkillTreeService(repo, gateway)
  const statusService = new SkillStatusService(repo, gateway)

  const handlers: Record<SkillmapCommand, (_treeId: string, _payload: SkillmapRequestPayload) => Promise<unknown>> = {
    'get-status': (treeId, payload) => statusService.get(treeId, payload?.fallback as object),
    'save-status': (treeId, payload) => statusService.save(treeId, payload?.status as object),
    'get-skill-tree': (treeId, payload) => treeService.get(treeId, payload?.fallback as object),
    'save-skill-tree': (treeId, payload) => treeService.save(treeId, payload?.tree as object),
    export: (treeId, payload) => treeService.export(treeId, payload?.fallback as object),
    import: (treeId, payload) => treeService.import(treeId, payload?.tree as object),
    'delete-skill-tree': (treeId) => treeService.delete(treeId),
    'list-skill-trees': () => treeService.list(),
  }

  const processRequest = (
    request: { type?: string; treeId?: unknown; payload?: SkillmapRequestPayload; requestId?: unknown },
    reply: (message: unknown) => void,
  ): void => {
    const type = request.type as SkillmapCommand | undefined
    const treeId = sanitizeTreeId(
      request.treeId ??
        (request.payload?.tree as { id?: unknown } | undefined)?.id ??
        (request.payload?.fallback as { id?: unknown } | undefined)?.id,
    )
    const payload = request.payload ?? {}
    const requestId = typeof request.requestId === 'string' ? request.requestId : undefined
    const handler = type ? handlers[type] : undefined

    if (!handler || !requestId) {
      reply({ ok: false, error: '不正なリクエストです', requestId: requestId ?? 'unknown' })
      return
    }

    Promise.resolve()
      .then(() => handler(treeId, payload))
      .then((data) => reply({ ok: true, data, requestId }))
      .catch((error: unknown) => {
        console.error('Service Worker 内でエラーが発生しました', error)
        const errorMessage = (error as Record<string, unknown>).message ?? '処理に失敗しました'
        reply({ ok: false, error: errorMessage, requestId })
      })
  }

  swScope.addEventListener('message', (event: ExtendableMessageEvent): void => {
    const { type, treeId, payload, requestId } = (event.data ?? {}) as {
      type?: string
      treeId?: unknown
      payload?: SkillmapRequestPayload
      requestId?: unknown
    }
    const responder = event.ports?.[0] ?? event.source

    const reply = (message: unknown): void => {
      if ((responder as MessagePort | ServiceWorker | Client | null | undefined)?.postMessage) {
        (responder as MessagePort | ServiceWorker | Client).postMessage(message)
      }
    }

    event.waitUntil(
      Promise.resolve().then(() => {
        processRequest({ type, treeId, payload, requestId }, reply)
      }),
    )
  })
}
