import { normalizeSkillTree, normalizeStatus, defaultSkillTree } from './skillNormalizer'
import { type SkillStatus, type SkillTree } from '../types/skill'

const BASE_PATH = import.meta.env.BASE_URL ?? '/'
const SW_PATH = `${BASE_PATH}sw.js`
const CHANNEL_NAME = 'skillmap-sync'
const MESSAGE_TIMEOUT_MS = 5000

type SkillmapCommand =
  | 'get-status'
  | 'save-status'
  | 'get-skill-tree'
  | 'save-skill-tree'
  | 'export'
  | 'import'

type SkillmapResponse<T> = {
  ok: boolean
  data?: T
  error?: string
  requestId: string
}

type SyncEventPayload = {
  event: 'status-updated' | 'skill-tree-updated'
  treeId: string
  updatedAt: string
}
/* eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars */
type SyncEventHandler = (payload: SyncEventPayload) => void

/**
 * OPFSが利用可能かを判定する。
 * @returns OPFS利用可否
 */
const supportsOPFS = (): boolean =>
  typeof navigator !== 'undefined' &&
  'storage' in navigator &&
  typeof (navigator as Navigator & { storage?: { getDirectory?: () => unknown } }).storage?.getDirectory === 'function'

/**
 * Service Workerがコントロールを取得するまで待機する。
 * @returns コントローラ取得完了時に解決するPromise
 */
const waitForController = async (): Promise<void> => {
  if (navigator.serviceWorker.controller) return

  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      // 取得できなくても処理を継続する（Pages環境では初回ロード時にcontrollerが付かないことがあるため）
      resolve()
    }, MESSAGE_TIMEOUT_MS)
    // eslint-disable-next-line jsdoc/require-jsdoc
    const onChange = () => {
      window.clearTimeout(timer)
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      resolve()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
  })
}

/**
 * SWを登録し、登録情報を返す。未サポート時は例外を送出。
 * @returns 登録済みServiceWorkerRegistration
 */
const ensureServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration> => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker がサポートされていません')
  }
  if (!supportsOPFS()) {
    throw new Error('OPFS がサポートされていません')
  }

  const existing = await navigator.serviceWorker.getRegistration(BASE_PATH)
  if (existing) return existing

  return navigator.serviceWorker.register(SW_PATH, { type: 'module', scope: BASE_PATH })
}

/**
 * 稼働中のSWインスタンスを取得する。起動していない場合は例外。
 * @returns 起動済みServiceWorker
 */
const getActiveServiceWorker = async (): Promise<ServiceWorker> => {
  const registration = await ensureServiceWorkerRegistration()
  const readyRegistration = await navigator.serviceWorker.ready
  const sw = readyRegistration.active ?? readyRegistration.waiting ?? readyRegistration.installing ?? registration.active

  if (!sw) {
    throw new Error('Service Worker が起動していません')
  }
  await waitForController()
  return sw
}

/**
 * SWへメッセージを送り、応答を待つユーティリティ。タイムアウト付き。
 * @param type コマンド種別
 * @param treeId 対象ツリーID
 * @param payload メッセージ本文
 * @returns SWからのレスポンスデータ
 */
const callServiceWorker = async <T>(type: SkillmapCommand, treeId: string, payload?: unknown): Promise<T> => {
  const sw = await getActiveServiceWorker()
  const requestId = crypto.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

  return new Promise<T>((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = window.setTimeout(() => {
      channel.port1.onmessage = null
      reject(new Error('Service Worker 応答がタイムアウトしました'))
    }, MESSAGE_TIMEOUT_MS)

    // eslint-disable-next-line jsdoc/require-jsdoc
    channel.port1.onmessage = (event: MessageEvent<SkillmapResponse<T>>) => {
      const message = event.data
      if (!message || message.requestId !== requestId) return

      channel.port1.onmessage = null
      window.clearTimeout(timer)
      if (message.ok && message.data !== undefined) {
        resolve(message.data)
        return
      }
      reject(new Error(message.error ?? 'Service Worker 応答に失敗しました'))
    }

    sw.postMessage({ type, treeId, payload, requestId }, [channel.port2])
  })
}

/**
 * SWからステータスを取得して正規化する。
 * @param treeId 対象ツリーID
 * @returns 正規化済みステータス
 */
export const getStatusFromSW = async (treeId: string): Promise<SkillStatus> => {
  const response = await callServiceWorker<SkillStatus>('get-status', treeId, {
    fallback: normalizeStatus(treeId),
  })
  return normalizeStatus(treeId, response)
}

/**
 * ステータスをSW経由で保存し、保存結果を返す。
 * @param status 保存対象ステータス
 * @returns 保存後ステータス
 */
export const saveStatusToSW = async (status: SkillStatus): Promise<SkillStatus> => {
  const response = await callServiceWorker<SkillStatus>('save-status', status.treeId, { status })
  return normalizeStatus(status.treeId, response)
}

/**
 * SWからスキルツリーを取得して正規化する。
 * @param treeId 対象ツリーID
 * @returns 正規化済みスキルツリー
 */
export const getSkillTreeFromSW = async (treeId: string): Promise<SkillTree> => {
  const response = await callServiceWorker<SkillTree>('get-skill-tree', treeId, {
    fallback: defaultSkillTree,
  })
  return normalizeSkillTree(response)
}

/**
 * スキルツリーをSWへ保存し、保存後の内容を返す。
 * @param tree 保存対象ツリー
 * @returns 保存後ツリー
 */
export const saveSkillTreeToSW = async (tree: SkillTree): Promise<SkillTree> => {
  const response = await callServiceWorker<SkillTree>('save-skill-tree', tree.id, { tree })
  return normalizeSkillTree(response)
}

/**
 * スキルツリーをエクスポート用に取得する。
 * @param treeId 対象ツリーID
 * @returns 正規化済みツリー
 */
export const exportSkillTreeFromSW = async (treeId: string): Promise<SkillTree> => {
  const response = await callServiceWorker<SkillTree>('export', treeId, { fallback: defaultSkillTree })
  return normalizeSkillTree(response)
}

/**
 * スキルツリーをSWへインポートする。
 * @param tree インポート対象ツリー
 * @returns 保存後ツリー
 */
export const importSkillTreeToSW = async (tree: SkillTree): Promise<SkillTree> => {
  const response = await callServiceWorker<SkillTree>('import', tree.id, { tree })
  return normalizeSkillTree(response)
}

/**
 * BroadcastChannel経由の同期イベントを購読する。
 * @param handler 受信イベントハンドラ
 * @returns 購読解除関数
 */
export const subscribeSyncEvents = (handler: SyncEventHandler): (() => void) => {
  if (typeof BroadcastChannel === 'undefined') {
    console.warn('BroadcastChannel がサポートされていません')
    return () => undefined
  }
  const channel = new BroadcastChannel(CHANNEL_NAME)
  // eslint-disable-next-line jsdoc/require-jsdoc
  const listener = (event: MessageEvent<SyncEventPayload>) => {
    const message = event.data
    if (!message || typeof message.treeId !== 'string' || typeof message.event !== 'string') return
    handler(message)
  }
  channel.addEventListener('message', listener)

  // eslint-disable-next-line jsdoc/require-jsdoc
  return () => {
    channel.removeEventListener('message', listener)
    channel.close()
  }
}

/**
 * SW登録を保証するだけのラッパー。
 * @returns Promise<void>
 */
export const ensureServiceWorker = async (): Promise<void> => {
  await ensureServiceWorkerRegistration()
}
