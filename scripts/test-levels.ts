import assert from "node:assert/strict";
import { generateLevel } from "../constants/levels";
import {
  analyzeLevel,
  CAMPAIGN_VERSION,
  getDifficultyProfile,
} from "../constants/levelDifficulty";
import { canMove, TileData } from "../utils/movement";
import { validateLevel } from "./level-validation";

// A converging graph: the horizontal arrow needs BOTH upright arrows removed.
const board: TileData[] = [
  {
    id: "a",
    path: [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
    direction: "right",
  },
  {
    id: "b",
    path: [
      { x: 2, y: 3 },
      { x: 2, y: 2 },
    ],
    direction: "up",
  },
  {
    id: "c",
    path: [
      { x: 4, y: 3 },
      { x: 4, y: 2 },
    ],
    direction: "up",
  },
];
const graph = analyzeLevel({ size: 5, tiles: board });
assert.equal(graph.startingMoves, 2);
assert.equal(graph.dependencyDepth, 2);
assert.equal(graph.dependencyEdges, 2);
assert.equal(graph.multiBlockerTiles, 1);
assert.equal(graph.independentTiles, 0);
assert.equal(canMove(board[0], board, 5), false);
assert.equal(
  canMove(
    board[0],
    board.map((tile) => ({ ...tile, removed: tile.id === "b" })),
    5,
  ),
  false,
);
assert.equal(
  canMove(
    board[0],
    board.map((tile) => ({ ...tile, removed: tile.id !== "a" })),
    5,
  ),
  true,
);

// An inactive mask cell is an exit, even if another body lies farther along its ray.
const mask = Array.from({ length: 5 }, () => Array<boolean>(5).fill(true));
mask[2][2] = false;
assert.equal(canMove(board[0], board, 5, mask), true);
assert.equal(
  analyzeLevel({ size: 5, tiles: board, shape: mask }).startingMoves,
  3,
);

const cyclic: TileData[] = [
  {
    id: "a",
    path: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    direction: "right",
  },
  {
    id: "b",
    path: [
      { x: 4, y: 1 },
      { x: 3, y: 1 },
    ],
    direction: "left",
  },
];
assert.equal(analyzeLevel({ size: 5, tiles: cyclic }).solvable, false);
const selfBlocked: TileData = {
  id: "loop",
  direction: "right",
  path: [
    { x: 3, y: 1 },
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
};
assert.equal(canMove(selfBlocked, [selfBlocked], 5), false);
assert.equal(analyzeLevel({ size: 5, tiles: [selfBlocked] }).solvable, false);

for (const id of [1, 2, 6, 10, 11, 20, 30, 40, 80, 161, 500, 1000, 1500]) {
  const level = generateLevel(id);
  validateLevel(level);
  assert.equal(level.version, CAMPAIGN_VERSION);
  assert.deepEqual(
    generateLevel(id),
    level,
    `Level ${id} generation must be deterministic`,
  );
  // Removing legal arrows in a different order must not create a dead end.
  const active: TileData[] = level.tiles.map((tile, index) => ({
    ...tile,
    id: String(index),
  }));
  for (let remaining = active.length; remaining > 0; remaining--) {
    const legal = active.filter(
      (tile) => !tile.removed && canMove(tile, active, level.size, level.shape),
    );
    assert(legal.length > 0, `Level ${id} failed alternate removal order`);
    legal[legal.length - 1].removed = true;
  }
}
assert.equal(getDifficultyProfile(10).kind, "challenge");
assert.equal(getDifficultyProfile(11).kind, "breather");
assert(
  getDifficultyProfile(10).targetDepth > getDifficultyProfile(11).targetDepth,
);
assert(
  getDifficultyProfile(1500).targetDepth >
    getDifficultyProfile(100).targetDepth,
);
for (const id of [0, -1, 1.5, NaN]) assert.throws(() => generateLevel(id));
console.log(
  "PASS: dependency graphs, multi-blocker behavior, shape exits, cycles, self-collisions, deterministic generation, pacing and alternate legal removal order.",
);
