import { canMove, TileData } from "./movement";

/** Accumulates only active play; pauses never erase time already spent. */
export class ActivePlayClock {
  private accumulatedMs = 0;
  private startedAt: number | null = null;

  start(now: number): void {
    if (this.startedAt === null) this.startedAt = now;
  }

  pause(now: number): void {
    if (this.startedAt === null) return;
    this.accumulatedMs += Math.max(0, now - this.startedAt);
    this.startedAt = null;
  }

  reset(): void {
    this.accumulatedMs = 0;
    this.startedAt = null;
  }

  seconds(now: number): number {
    return Math.floor(
      (this.accumulatedMs +
        (this.startedAt === null ? 0 : Math.max(0, now - this.startedAt))) /
        1000,
    );
  }
}

type TimerHandle = ReturnType<typeof setTimeout>;

/** Reset/navigation invalidates even callbacks already queued by the platform. */
export class AttemptScheduler {
  private revision = 0;
  private timers = new Set<TimerHandle>();

  constructor(
    private readonly schedule: (
      callback: () => void,
      delay: number,
    ) => TimerHandle = (callback, delay) =>
      globalThis.setTimeout(callback, delay),
    private readonly cancel: (handle: TimerHandle) => void = (handle) =>
      globalThis.clearTimeout(handle),
  ) {}

  after(delay: number, callback: () => void): TimerHandle {
    const revision = this.revision;
    const handle = this.schedule(() => {
      this.timers.delete(handle);
      if (revision === this.revision) callback();
    }, delay);
    this.timers.add(handle);
    return handle;
  }

  cancelAll(): void {
    this.revision += 1;
    for (const timer of this.timers) this.cancel(timer);
    this.timers.clear();
  }
}

export function getAttemptStars(
  mistakes: number,
  hintsUsed = 0,
  revivesUsed = 0,
): number {
  const earned = Math.max(1, 3 - mistakes);
  return Math.min(earned, hintsUsed > 0 ? 2 : 3, revivesUsed > 0 ? 1 : 3);
}

/** A hint reveals a legal move, preferring one that frees the most other arrows. */
export function findHintTile(
  board: TileData[],
  boardSize: number,
  shape?: boolean[][],
): TileData | null {
  const active = board.filter((tile) => !tile.removed);
  const available = active.filter((tile) =>
    canMove(tile, active, boardSize, shape),
  );
  const availableIds = new Set(available.map((tile) => tile.id));
  let best: TileData | null = null;
  let bestUnlocks = -1;
  for (const candidate of available) {
    const remaining = active.filter((tile) => tile.id !== candidate.id);
    let unlocks = 0;
    for (const tile of remaining) {
      if (
        !availableIds.has(tile.id) &&
        canMove(tile, remaining, boardSize, shape)
      ) {
        unlocks += 1;
      }
    }
    if (unlocks > bestUnlocks) {
      best = candidate;
      bestUnlocks = unlocks;
    }
  }
  return best;
}
