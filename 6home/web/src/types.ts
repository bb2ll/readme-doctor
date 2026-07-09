export type Card = { id: string; suit: 'S' | 'H' | 'C' | 'D' | 'J'; rank: string }
export type Player = {
  name: string; seat: number; team: 'A' | 'B'; ready: boolean; connected: boolean
  finished: boolean; auto: boolean; isHost: boolean; isBigGong: boolean; bot: boolean
}
export type Play = { seat: number; cards: Card[]; target: string; count: number; value: number }
export type GameResult = { kind: 'win' | 'draw'; winningTeam?: 'A' | 'B'; bigGongTeam: 'A' | 'B'; title: string }
export type Chat = { seat: number; name: string; text: string; at: string }
export type ActionLogEntry = { kind: 'play' | 'pass'; seat: number; cards?: Card[]; at: string }
export type Room = {
  code: string; phase: 'waiting' | 'playing' | 'finished'; players: Player[]; current: number
  lastPlay: Play | null; displayPlay: Play | null; bigGongSeat: number; round: number; result: GameResult | null
  turnDeadline: string; turnSeconds: number; chats: Chat[] | null; actionLog: ActionLogEntry[] | null
}
export type Self = { seat: number; team: 'A' | 'B'; hand: Card[]; ready: boolean; auto: boolean; isHost: boolean }
export type ServerMessage =
  | { type: 'connected' }
  | { type: 'session'; roomCode: string; token: string; seat: number }
  | { type: 'state'; room: Room; self: Self }
  | { type: 'error'; message: string }
