export type SeatNumber = 1 | 2 | 3 | 4 | 5 | 6
export type TablePosition = SeatNumber

const SEAT_COUNT = 6
const SELF_POSITION: TablePosition = 4

function assertSeat(value: number, label: string): asserts value is SeatNumber {
  if (!Number.isInteger(value) || value < 1 || value > SEAT_COUNT) {
    throw new RangeError(`${label} must be an integer from 1 to 6`)
  }
}

/**
 * Converts a real seat number to its position on the current player's table.
 * Position 4 is the bottom of the table and increasing positions move clockwise.
 */
export function toTablePosition(seat: number, selfSeat: number): TablePosition {
  assertSeat(seat, 'seat')
  assertSeat(selfSeat, 'selfSeat')

  const clockwiseOffset = (seat - selfSeat + SEAT_COUNT) % SEAT_COUNT
  return ((SELF_POSITION - 1 + clockwiseOffset) % SEAT_COUNT + 1) as TablePosition
}

/**
 * Returns every real seat in clockwise order with its visual table position.
 */
export function createSeatPerspective(selfSeat: number) {
  assertSeat(selfSeat, 'selfSeat')

  return Array.from({ length: SEAT_COUNT }, (_, offset) => {
    const seat = ((selfSeat - 1 + offset) % SEAT_COUNT + 1) as SeatNumber
    return { seat, position: toTablePosition(seat, selfSeat) }
  })
}
