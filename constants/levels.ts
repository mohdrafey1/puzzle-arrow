import seedrandom from "seedrandom";
import type { Direction, TileData } from "../utils/movement";
import {
    analyzeLevel,
    CAMPAIGN_VERSION,
    DifficultyMetrics,
    DifficultyProfile,
    getDifficultyProfile,
} from "./levelDifficulty";
import {
    countActiveCells,
    generateShapeMask,
    getShapeForLevel,
} from "./shapes";

export interface LevelData {
    id: number;
    size: number;
    tiles: Omit<TileData, "id">[];
    shape: boolean[][];
    version?: number;
    difficulty?: { profile: DifficultyProfile; metrics: DifficultyMetrics };
}

type Arrow = Omit<TileData, "id">;
const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const VECTORS = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
];

interface Placement {
    path: number[];
    direction: number;
    hits: Set<number>;
    depth: number;
    ray: number[];
}

/**
 * Build in reverse removal order. A new arrow always has a clear exit, and its
 * body may block earlier arrows. Every dependency therefore points forward in
 * placement order; cycles and self-blocks are impossible by construction.
 *
 * Candidate bodies are selected for useful blocking relationships, including
 * shared blockers and interleaved chains. Empty decorative gaps are preferable
 * to a board padded with arrows that do not participate in the puzzle.
 */
function generateCandidate(
    id: number,
    seed: number,
    profile: DifficultyProfile,
    shape: boolean[][],
): Arrow[] {
    const rng = seedrandom(`${CAMPAIGN_VERSION}:${id}:${seed}`);
    const { size, targetDepth, targetStartingRatio } = profile;
    const area = size * size;
    const occupied = new Int16Array(area).fill(-1);
    const active: number[] = [];
    const coverage: number[][] = Array.from({ length: area }, () => []);
    for (let cell = 0; cell < area; cell++) {
        if (shape[Math.floor(cell / size)][cell % size]) active.push(cell);
        else occupied[cell] = -2;
    }
    const rays = Array.from({ length: area }, (_, cell) =>
        VECTORS.map(([dx, dy]) => {
            const cells: number[] = [];
            let x = (cell % size) + dx,
                y = Math.floor(cell / size) + dy;
            while (x >= 0 && x < size && y >= 0 && y < size && shape[y][x]) {
                cells.push(y * size + x);
                x += dx;
                y += dy;
            }
            return cells;
        }),
    );
    const tiles: Placement[] = [];
    const blocked: boolean[] = [];
    let roots = 0;
    while (true) {
        const options: [number, number][] = [];
        for (const cell of active) {
            if (occupied[cell] !== -1) continue;
            for (let direction = 0; direction < 4; direction++) {
                const [dx, dy] = VECTORS[direction];
                const neckX = (cell % size) - dx,
                    neckY = Math.floor(cell / size) - dy;
                if (
                    neckX < 0 ||
                    neckX >= size ||
                    neckY < 0 ||
                    neckY >= size ||
                    occupied[neckY * size + neckX] !== -1
                )
                    continue;
                if (rays[cell][direction].every((c) => occupied[c] === -1))
                    options.push([cell, direction]);
            }
        }
        if (!options.length) break;
        let best: Placement | undefined;
        let bestScore = -Infinity;
        const rootWeight =
            9 + (roots / Math.max(1, tiles.length) - targetStartingRatio) * 12;
        for (let sample = 0; sample < 100; sample++) {
            const [head, direction] =
                options[Math.floor(rng() * options.length)];
            const ray = rays[head][direction];
            const reserved = new Set(ray);
            const seen = new Set([head]);
            const path = [head];
            const maxLength = Math.min(11, 5 + Math.floor(size / 3));
            const targetLength = 3 + Math.floor(rng() * (maxLength - 2));
            let current = head;
            let previousDirection = direction ^ 1;
            for (let step = 1; step < targetLength; step++) {
                const neighbors: { cell: number; direction: number }[] = [];
                for (let d = 0; d < 4; d++) {
                    if (step === 1 && d !== (direction ^ 1)) continue;
                    const [dx, dy] = VECTORS[d];
                    const x = (current % size) + dx,
                        y = Math.floor(current / size) + dy;
                    const cell = y * size + x;
                    if (
                        x >= 0 &&
                        x < size &&
                        y >= 0 &&
                        y < size &&
                        occupied[cell] === -1 &&
                        !seen.has(cell) &&
                        !reserved.has(cell)
                    ) {
                        neighbors.push({ cell, direction: d });
                    }
                }
                if (!neighbors.length) break;
                const straight = neighbors.find(
                    (n) => n.direction === previousDirection,
                );
                const next =
                    straight && rng() < 0.35
                        ? straight
                        : neighbors[Math.floor(rng() * neighbors.length)];
                current = next.cell;
                previousDirection = next.direction;
                path.push(current);
                seen.add(current);
            }
            if (path.length < 2) continue;
            const hits = new Set<number>();
            path.forEach((cell) =>
                coverage[cell].forEach((tile) => hits.add(tile)),
            );
            let rootHits = 0,
                depth = 1;
            hits.forEach((tile) => {
                if (!blocked[tile]) rootHits++;
                depth = Math.max(depth, tiles[tile].depth + 1);
            });
            // Prevent difficulty spikes from a much longer chain than the profile requested.
            if (depth > targetDepth + (profile.kind === "learn" ? 0 : 1))
                continue;
            const score =
                rootHits * rootWeight +
                hits.size * 1.5 +
                Math.min(depth, targetDepth) * 2 +
                ray.length * 0.65 +
                path.length * 0.18 +
                rng() * 3 -
                (depth > targetDepth ? 8 : 0) -
                (hits.size === 0 && tiles.length > 0 ? 18 : 0);
            if (score > bestScore) {
                bestScore = score;
                best = { path, direction, hits, depth, ray };
            }
        }
        if (!best || (best.hits.size === 0 && tiles.length > 3)) break;
        const index = tiles.length;
        tiles.push(best);
        blocked.push(false);
        roots++;
        best.hits.forEach((tile) => {
            if (!blocked[tile]) roots--;
            blocked[tile] = true;
        });
        best.path.forEach((cell) => {
            occupied[cell] = index;
        });
        best.ray.forEach((cell) => coverage[cell].push(index));
    }
    const arrows = tiles
        .filter(
            (tile, index) =>
                profile.kind === "learn" ||
                blocked[index] ||
                tile.hits.size > 0,
        )
        .map((tile) => ({
            path: tile.path
                .slice()
                .reverse()
                .map((cell) => ({
                    x: cell % size,
                    y: Math.floor(cell / size),
                })),
            direction: DIRECTIONS[tile.direction],
        }));
    // Do not expose construction/solution order through render order or hint selection.
    for (let i = arrows.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arrows[i], arrows[j]] = [arrows[j], arrows[i]];
    }
    return arrows;
}

function candidateScore(
    metrics: DifficultyMetrics,
    profile: DifficultyProfile,
): number {
    if (!metrics.solvable || metrics.tileCount < 3) return -Infinity;
    const depthDistance = Math.abs(
        metrics.dependencyDepth - profile.targetDepth,
    );
    const ratioDistance = Math.abs(
        metrics.startingMoveRatio - profile.targetStartingRatio,
    );
    const branching = metrics.multiBlockerTiles / metrics.tileCount;
    return (
        -depthDistance * 10 -
        ratioDistance * 35 +
        Math.min(0.35, branching) * 12 -
        metrics.independentTiles * 2 +
        Math.min(0.8, metrics.fillRatio) * 5
    );
}

const FIRST_LESSON: Arrow[] = [
    {
        path: [
            { x: 1, y: 3 },
            { x: 1, y: 2 },
            { x: 1, y: 1 },
        ],
        direction: "up",
    },
    {
        path: [
            { x: 3, y: 3 },
            { x: 3, y: 2 },
            { x: 3, y: 1 },
            { x: 2, y: 1 },
        ],
        direction: "left",
    },
    {
        path: [
            { x: 1, y: 4 },
            { x: 2, y: 4 },
            { x: 3, y: 4 },
            { x: 4, y: 4 },
            { x: 4, y: 3 },
        ],
        direction: "up",
    },
];

const SECOND_LESSON: Arrow[] = [
    {
        path: [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
        ],
        direction: "right",
    },
    {
        path: [
            { x: 4, y: 3 },
            { x: 4, y: 2 },
            { x: 4, y: 1 },
        ],
        direction: "up",
    },
    {
        path: [
            { x: 3, y: 0 },
            { x: 4, y: 0 },
            { x: 5, y: 0 },
        ],
        direction: "right",
    },
    {
        path: [
            { x: 1, y: 4 },
            { x: 1, y: 5 },
            { x: 2, y: 5 },
            { x: 3, y: 5 },
        ],
        direction: "right",
    },
];

export function generateLevel(id: number): LevelData {
    const profile = getDifficultyProfile(id);
    const { size } = profile;
    const shape = restoreShape(id, size);
    let tiles: Arrow[] = [];
    let metrics: DifficultyMetrics | undefined;
    let bestScore = -Infinity;
    if (id <= 2) {
        const lesson = id === 1 ? FIRST_LESSON : SECOND_LESSON;
        tiles = lesson.map((tile) => ({
            ...tile,
            path: tile.path.map((point) => ({ ...point })),
        }));
        metrics = analyzeLevel({ size, shape, tiles });
    } else {
        const candidates = profile.kind === "challenge" ? 36 : 12;
        for (let seed = 0; seed < candidates; seed++) {
            const candidate = generateCandidate(id, seed, profile, shape);
            const analyzed = analyzeLevel({ size, shape, tiles: candidate });
            const score = candidateScore(analyzed, profile);
            if (score > bestScore) {
                tiles = candidate;
                metrics = analyzed;
                bestScore = score;
            }
            if (
                analyzed.solvable &&
                analyzed.dependencyDepth === profile.targetDepth &&
                Math.abs(
                    analyzed.startingMoveRatio - profile.targetStartingRatio,
                ) < 0.045 &&
                analyzed.fillRatio >= 0.65 &&
                analyzed.independentTiles === 0
            )
                break;
        }
    }
    // Never replace a failed puzzle with unvalidated random directions.
    if (!metrics?.solvable || tiles.length < 3 || countActiveCells(shape) < 1) {
        throw new Error(`Could not construct a valid puzzle for level ${id}.`);
    }
    return {
        id,
        size,
        tiles,
        shape,
        version: CAMPAIGN_VERSION,
        difficulty: { profile, metrics },
    };
}

export function restoreShape(levelId: number, size: number): boolean[][] {
    return generateShapeMask(getShapeForLevel(levelId), size);
}
