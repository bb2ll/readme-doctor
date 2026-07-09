import type { ActionLogEntry, Player } from './types'

export type PlayerMotionKind = 'idle' | 'play' | 'pass' | 'finished'

export type PlayerMotion = {
  kind: PlayerMotionKind
  eventKey: string
  seat: number
}

export function resolvePlayerMotion(player: Player, latestAction?: ActionLogEntry): PlayerMotion {
  if (player.finished) {
    return { kind: 'finished', eventKey: `finished-${player.seat}`, seat: player.seat }
  }
  if (latestAction?.seat === player.seat) {
    return {
      kind: latestAction.kind,
      eventKey: `${latestAction.at}-${latestAction.seat}-${latestAction.kind}`,
      seat: player.seat,
    }
  }
  return { kind: 'idle', eventKey: `idle-${player.seat}`, seat: player.seat }
}
