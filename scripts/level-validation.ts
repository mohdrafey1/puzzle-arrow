import assert from "node:assert/strict";
import type { LevelData } from "../constants/levels";
import { analyzeLevel } from "../constants/levelDifficulty";
import { canMove, TileData } from "../utils/movement";

/** Independent path and gameplay-rule audit, also used on every bundled board. */
export function validateLevel(level: LevelData): void {
  const prefix = `Level ${level.id}`;
  assert(
    Number.isInteger(level.size) && level.size >= 2,
    `${prefix}: invalid size`,
  );
  assert.equal(level.shape.length, level.size, `${prefix}: mask height`);
  const occupied = new Set<string>();
  for (const row of level.shape)
    assert.equal(row.length, level.size, `${prefix}: mask width`);
  assert(level.tiles.length >= 3, `${prefix}: too few arrows`);
  for (const tile of level.tiles) {
    assert(tile.path.length >= 2, `${prefix}: one-cell arrow`);
    assert(
      ["up", "down", "left", "right"].includes(tile.direction),
      `${prefix}: invalid direction`,
    );
    tile.path.forEach(({ x, y }, i) => {
      assert(
        Number.isInteger(x) && Number.isInteger(y),
        `${prefix}: noninteger cell`,
      );
      assert(
        x >= 0 &&
          y >= 0 &&
          x < level.size &&
          y < level.size &&
          level.shape[y][x],
        `${prefix}: off-mask cell`,
      );
      const key = `${x},${y}`;
      assert(
        !occupied.has(key),
        `${prefix}: overlapping or repeated cell ${key}`,
      );
      occupied.add(key);
      if (i) {
        const previous = tile.path[i - 1];
        assert.equal(
          Math.abs(previous.x - x) + Math.abs(previous.y - y),
          1,
          `${prefix}: disconnected body`,
        );
      }
    });
    const head = tile.path[tile.path.length - 1];
    const neck = tile.path[tile.path.length - 2];
    const expected =
      head.x > neck.x
        ? "right"
        : head.x < neck.x
          ? "left"
          : head.y > neck.y
            ? "down"
            : "up";
    assert.equal(
      tile.direction,
      expected,
      `${prefix}: head does not follow its body`,
    );
  }
  const board: TileData[] = level.tiles.map((tile, index) => ({
    ...tile,
    id: String(index),
    removed: false,
  }));
  let layers = 0,
    remaining = board.length;
  let firstAvailable = 0;
  while (remaining) {
    const available = board.filter(
      (tile) => !tile.removed && canMove(tile, board, level.size, level.shape),
    );
    assert(
      available.length,
      `${prefix}: unsolvable with ${remaining} arrows left`,
    );
    if (!layers) firstAvailable = available.length;
    for (const tile of available) tile.removed = true;
    remaining -= available.length;
    layers++;
  }
  const metrics = analyzeLevel(level);
  assert(
    metrics.solvable,
    `${prefix}: graph solver disagrees with movement rules`,
  );
  assert.equal(metrics.dependencyDepth, layers, `${prefix}: dependency depth`);
  assert.equal(
    metrics.startingMoves,
    firstAvailable,
    `${prefix}: initial legal moves`,
  );
  if (level.difficulty)
    assert.deepEqual(
      level.difficulty.metrics,
      metrics,
      `${prefix}: stale difficulty metadata`,
    );

  // Exercise a different, reproducible sequence of single legal removals as well.
  board.forEach((tile) => {
    tile.removed = false;
  });
  let state = level.id;
  for (let count = board.length; count > 0; count--) {
    const legal = board.filter(
      (tile) => !tile.removed && canMove(tile, board, level.size, level.shape),
    );
    assert(legal.length, `${prefix}: dead end after alternate legal removals`);
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    legal[state % legal.length].removed = true;
  }
}
