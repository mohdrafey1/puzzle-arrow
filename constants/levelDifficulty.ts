import type { TileData } from "../utils/movement";

/** Bump when campaign boards change, so records from different puzzles stay separate. */
export const CAMPAIGN_VERSION = 2;
export const CAMPAIGN_LEVEL_COUNT = 1500;

export interface DifficultyProfile {
  label: "Easy" | "Medium" | "Hard" | "Expert";
  chapter: number;
  kind: "learn" | "build" | "breather" | "challenge";
  title: string;
  tip: string;
  size: number;
  targetDepth: number;
  targetStartingRatio: number;
}

export interface DifficultyMetrics {
  tileCount: number;
  startingMoves: number;
  startingMoveRatio: number;
  dependencyDepth: number;
  dependencyEdges: number;
  multiBlockerTiles: number;
  independentTiles: number;
  meanAvailableRatio: number;
  fillRatio: number;
  solvable: boolean;
}

const LESSONS = [
  [
    "Find the first exit",
    "An arrow leaves in the direction its head points. Find a clear path to the edge.",
  ],
  [
    "Follow the chain",
    "If an arrow is blocked, follow its path to the arrow you need to clear first.",
  ],
  [
    "Look around bends",
    "Trace the whole arrow. Its body can block another arrow even when its head is far away.",
  ],
  [
    "Open two paths",
    "One arrow can block several others. Clear it to open new exits.",
  ],
  [
    "Work from the outside in",
    "Look for a clear exit, then check which paths it opens.",
  ],
];

/** Tuning hypotheses, not measured human difficulty. Size is kept readable on phones. */
export function getDifficultyProfile(id: number): DifficultyProfile {
  if (!Number.isInteger(id) || id < 1)
    throw new Error("Level id must be a positive integer.");
  const chapter = Math.ceil(id / 40);
  if (id <= LESSONS.length) {
    return {
      label: "Easy",
      chapter,
      kind: "learn",
      title: LESSONS[id - 1][0],
      tip: LESSONS[id - 1][1],
      size: [5, 6, 6, 7, 7][id - 1],
      targetDepth: [2, 3, 3, 4, 4][id - 1],
      targetStartingRatio: [0.67, 0.5, 0.45, 0.4, 0.4][id - 1],
    };
  }
  const position = (id - 1) % 10;
  const kind =
    position === 9 ? "challenge" : position <= 1 ? "breather" : "build";
  const pressure = kind === "challenge" ? 2 : kind === "breather" ? -2 : 0;
  const baseDepth = 4 + Math.floor(Math.log2(1 + id / 10) * 1.3);
  const targetDepth = Math.max(3, Math.min(15, baseDepth + pressure));
  const baseSize =
    id <= 40
      ? 8 + Math.floor((id - 6) / 12)
      : 11 + Math.floor(Math.log2(1 + id / 100) * 1.5);
  // Thin silhouettes need a little more room to carry equivalent dependencies.
  const shapeIndex = Math.floor((id - 1) / 5) % 8;
  const shapeAllowance = [0, 1, 0, 0, 1, 1, 1, 1][shapeIndex];
  const size = Math.max(
    7,
    Math.min(
      20,
      baseSize +
        shapeAllowance +
        (kind === "challenge" ? 2 : Math.sign(pressure)),
    ),
  );
  return {
    label:
      targetDepth <= 4
        ? "Easy"
        : targetDepth <= 7
          ? "Medium"
          : targetDepth <= 11
            ? "Hard"
            : "Expert",
    chapter,
    kind,
    size,
    targetDepth,
    targetStartingRatio:
      kind === "challenge" ? 0.16 : kind === "breather" ? 0.38 : 0.26,
    title:
      kind === "challenge"
        ? "The checkpoint"
        : kind === "breather"
          ? "A little breathing room"
          : "Untangle the paths",
    tip:
      kind === "challenge"
        ? "Take your time. Trace a blocked arrow back to the exits that will free it."
        : kind === "breather"
          ? "Enjoy a lighter puzzle before the next climb."
          : [
              "Look for the arrow that opens more than one path.",
              "Some arrows need several blockers cleared before they can leave.",
              "Trace the head’s exit line all the way to the edge.",
              "Clearing one path can reveal the next part of the chain.",
            ][Math.floor(id / 10) % 4],
  };
}

type AnalyzableLevel = {
  size: number;
  shape?: boolean[][];
  tiles: Omit<TileData, "id">[];
};

/**
 * The exact head-ray rules expressed as a dependency graph. Legal removals only
 * delete blockers, so layer peeling proves solvability for every legal move order.
 * A self-blocking arrow contributes a self-edge and is correctly unsolvable.
 */
export function analyzeLevel(level: AnalyzableLevel): DifficultyMetrics {
  const { size, shape, tiles } = level;
  const owner = new Int32Array(size * size).fill(-1);
  tiles.forEach((tile, index) =>
    tile.path.forEach(({ x, y }) => {
      owner[y * size + x] = index;
    }),
  );
  const dependencies = tiles.map((tile) => {
    const blockers = new Set<number>();
    const head = tile.path[tile.path.length - 1];
    const dx =
      tile.direction === "right" ? 1 : tile.direction === "left" ? -1 : 0;
    const dy = tile.direction === "down" ? 1 : tile.direction === "up" ? -1 : 0;
    let x = head.x + dx,
      y = head.y + dy;
    while (
      x >= 0 &&
      x < size &&
      y >= 0 &&
      y < size &&
      (!shape || shape[y]?.[x])
    ) {
      if (owner[y * size + x] >= 0) blockers.add(owner[y * size + x]);
      x += dx;
      y += dy;
    }
    return blockers;
  });
  const startingMoves = dependencies.filter(
    (blockers) => blockers.size === 0,
  ).length;
  const participates = new Set<number>();
  dependencies.forEach((blockers, index) => {
    if (blockers.size) participates.add(index);
    blockers.forEach((blocker) => participates.add(blocker));
  });
  const remaining = new Set(tiles.map((_, i) => i));
  let dependencyDepth = 0,
    availableRatioSum = 0;
  while (remaining.size) {
    const free = [...remaining].filter((i) =>
      [...dependencies[i]].every((blocker) => !remaining.has(blocker)),
    );
    if (!free.length) break;
    availableRatioSum += free.length / remaining.size;
    free.forEach((i) => remaining.delete(i));
    dependencyDepth++;
  }
  const activeCells = shape
    ? shape.reduce((sum, row) => sum + row.filter(Boolean).length, 0)
    : size * size;
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    tileCount: tiles.length,
    startingMoves,
    startingMoveRatio: round(startingMoves / Math.max(1, tiles.length)),
    dependencyDepth,
    dependencyEdges: dependencies.reduce(
      (sum, blockers) => sum + blockers.size,
      0,
    ),
    multiBlockerTiles: dependencies.filter((blockers) => blockers.size > 1)
      .length,
    independentTiles: tiles.length - participates.size,
    meanAvailableRatio: round(availableRatioSum / Math.max(1, dependencyDepth)),
    fillRatio: round(
      tiles.reduce((sum, tile) => sum + tile.path.length, 0) /
        Math.max(1, activeCells),
    ),
    solvable: tiles.length > 0 && remaining.size === 0,
  };
}
