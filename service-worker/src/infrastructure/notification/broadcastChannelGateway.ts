/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import type { NotificationGateway, SkillEvent } from '../../application/eventPublisher.ts'

const CHANNEL_NAME = 'skillmap-sync'
const broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null

export class BroadcastChannelGateway implements NotificationGateway {
  publish(event: SkillEvent): void {
    if (broadcastChannel) {
      broadcastChannel.postMessage(event)
    }
  }
}
