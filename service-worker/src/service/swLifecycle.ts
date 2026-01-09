/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import { SkillTreeRepositoryImpl } from '../infrastructure/skillTreeRepositoryImpl'
import { DEFAULT_TREE_ID } from '../domain/skillTypes'

export const setupLifecycle = (swScope: ServiceWorkerGlobalScope): void => {
  swScope.addEventListener('install', (event) => {
    event.waitUntil(swScope.skipWaiting())
  })

  swScope.addEventListener('activate', (event) => {
    const repo = new SkillTreeRepositoryImpl()
    event.waitUntil(
      Promise.resolve()
        .then(() => repo.getTree(DEFAULT_TREE_ID))
        .then(() => swScope.clients.claim()),
    )
  })
}
