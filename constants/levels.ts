import { Direction, Point, TileData } from "../utils/movement";
import {
    countActiveCells,
    generateShapeMask,
    getShapeForLevel,
} from "./shapes";

export interface LevelData {
    id: number;
    size: number;
    tiles: Omit<TileData, "id">[];
    shape: boolean[][]; // which cells are active
}

import seedrandom from "seedrandom";

// ── Backward Level Generation ──────────────────────────────────────────
// We generate the board BACKWARDS from a solved state.
// We place snakes on the board one by one. Each snake must have a clear
// "exit path" to the board edge AT THE MOMENT we place it.
// Because it's placed later in reverse-time, it means in forward-gameplay
// it will be removed EARLIER. Therefore, its exit path must be clear of
// currently-placed snakes, but its BODY can safely block currently-placed snakes!
// This mathematically guarantees 100% solvability no matter how tangled they get.
function tryGenerateBackward(
    rng: () => number,
    size: number,
    shape: boolean[][],
    activeCellCount: number,
    minLen: number,
    maxLen: number,
): { tiles: Omit<TileData, "id">[]; filled: number } {
    const occupied = Array(size)
        .fill(0)
        .map(() => Array(size).fill(false));

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (!shape[y][x]) occupied[y][x] = true;
        }
    }

    const DIRS: Direction[] = ["up", "down", "left", "right"];
    const tiles: { path: Point[]; direction: Direction }[] = [];

    let attemptsWithoutPlacement = 0;
    const maxAttempts = 100 + activeCellCount * 2;

    while (attemptsWithoutPlacement < maxAttempts) {
        const emptyCells: Point[] = [];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (!occupied[y][x]) emptyCells.push({ x, y });
            }
        }
        if (emptyCells.length === 0) break;

        const head = emptyCells[Math.floor(rng() * emptyCells.length)];

        // Valid exit ray: ray must reach shape boundary WITHOUT hitting any occupied cell.
        const validDirs = DIRS.filter((dir) => {
            const dirX = dir === "right" ? 1 : dir === "left" ? -1 : 0;
            const dirY = dir === "down" ? 1 : dir === "up" ? -1 : 0;
            let cx = head.x + dirX;
            let cy = head.y + dirY;
            while (
                cx >= 0 &&
                cx < size &&
                cy >= 0 &&
                cy < size &&
                shape[cy][cx]
            ) {
                if (occupied[cy][cx]) return false;
                cx += dirX;
                cy += dirY;
            }
            return true;
        });

        if (validDirs.length === 0) {
            attemptsWithoutPlacement++;
            continue;
        }

        const dir = validDirs[Math.floor(rng() * validDirs.length)];

        // Temporarily reserve the exit ray so the snake's body doesn't cross its own escape path
        const rayCells: Point[] = [];
        const dirX = dir === "right" ? 1 : dir === "left" ? -1 : 0;
        const dirY = dir === "down" ? 1 : dir === "up" ? -1 : 0;
        let rx = head.x + dirX;
        let ry = head.y + dirY;
        while (rx >= 0 && rx < size && ry >= 0 && ry < size) {
            // We mark all cells in the ray as occupied to act as a wall
            if (!occupied[ry][rx]) {
                occupied[ry][rx] = true;
                rayCells.push({ x: rx, y: ry });
            }
            rx += dirX;
            ry += dirY;
        }

        // Build snake body, walking into available empty cells
        const targetLen = Math.floor(rng() * (maxLen - minLen + 1)) + minLen;
        const path: Point[] = [head];
        let curr = head;

        const opposite: Record<Direction, Direction> = {
            up: "down",
            down: "up",
            left: "right",
            right: "left",
        };

        for (let i = 1; i < targetLen; i++) {
            let possible = [
                { x: curr.x, y: curr.y - 1, d: "up" as Direction },
                { x: curr.x, y: curr.y + 1, d: "down" as Direction },
                { x: curr.x - 1, y: curr.y, d: "left" as Direction },
                { x: curr.x + 1, y: curr.y, d: "right" as Direction },
            ];

            if (i === 1) {
                // First body segment MUST grow away from the exit direction.
                const opp = opposite[dir];
                const oppMoves = possible.filter((m) => m.d === opp);
                if (oppMoves.length > 0) {
                    possible = oppMoves;
                } else {
                    possible = possible.filter((m) => m.d !== dir);
                }
            }

            const neighbors = possible.filter(
                (n) =>
                    n.x >= 0 &&
                    n.x < size &&
                    n.y >= 0 &&
                    n.y < size &&
                    !occupied[n.y][n.x] &&
                    shape[n.y][n.x] &&
                    !path.some((p) => p.x === n.x && p.y === n.y),
            );

            if (neighbors.length === 0) break;
            const next = neighbors[Math.floor(rng() * neighbors.length)];
            curr = { x: next.x, y: next.y };
            path.push(curr);
        }

        // Unreserve the exit ray
        rayCells.forEach((p) => {
            occupied[p.y][p.x] = false;
        });

        // Strictly enforce minimum lengths to avoid 1-length arrow flooding!
        // Only accept short paths if we are truly desperate and the board is largely empty
        // Wait, NO! If we want to guarantee NO short arrows, we strictly enforce it.
        // During the last few attempts, we can allow slightly shorter arrows (e.g. minLen/2)
        // just to fill tiny gaps, but NEVER 1-length.
        const allowedMinLen =
            attemptsWithoutPlacement > maxAttempts * 0.8
                ? Math.max(2, Math.floor(minLen / 2))
                : minLen;

        if (path.length >= allowedMinLen || path.length === targetLen) {
            // Found a valid snake
            path.reverse(); // so tail is at start of array, head at end
            path.forEach((p) => (occupied[p.y][p.x] = true));
            tiles.push({ path, direction: dir });
            attemptsWithoutPlacement = 0; // reset
        } else {
            attemptsWithoutPlacement++;
        }
    }

    const filledCount = tiles.reduce((sum, t) => sum + t.path.length, 0);
    return {
        tiles: tiles.reverse(), // reverse so first generated (removed last) is placed early in array
        filled: filledCount / activeCellCount,
    };
}

export function generateLevel(id: number): LevelData {
    // 40 levels per round (8 shapes * 5 levels each)
    const round = Math.floor((id - 1) / 40);
    const levelInShape = (id - 1) % 5;

    // First round base is 6. Second round base is 11, etc.
    const baseSize = 6 + round * 5;
    // Grid size increases by 1 each level inside the 5-level shape block
    const calculatedSize = baseSize + levelInShape;
    // Cap at 25 to prevent unplayable density (tiles become too small)
    const size = Math.min(calculatedSize, 25);

    const shapeName = getShapeForLevel(id);
    const shape = generateShapeMask(shapeName, size);
    const activeCellCount = countActiveCells(shape);

    // Mixture of all lengths: allows short (2) up to some long arrows.
    const minLen = 2;
    // To get 80+ arrows in a smaller grid, average length must be smaller.
    // For size 16 (level 101), maxLen = 6 -> avg length 4 -> ~64 arrows.
    // For size 25 (max level), maxLen = 10 -> avg length 6 -> ~100 arrows.
    const maxLen = Math.min(Math.floor(size / 3) + 3, 10);

    let bestResult: Omit<TileData, "id">[] = [];
    let bestFill = 0;

    // Backward generation is instant, so we can try generating 30 times
    // and just pick the instance that packed the board the tightest!
    for (let seedOffset = 0; seedOffset < 30; seedOffset++) {
        const rng = seedrandom(`${id}_backward_v8_${seedOffset}`);
        const result = tryGenerateBackward(
            rng,
            size,
            shape,
            activeCellCount,
            minLen,
            maxLen,
        );

        if (result.filled > bestFill) {
            bestFill = result.filled;
            bestResult = result.tiles;
        }

        // If we filled 90% of the board with long snakes, that's incredibly good, just ship it!
        if (bestFill >= 0.9) break;
    }

    // Fallback: simpler generation for extreme edge cases like Level 1 where size is 6 and minLen is 2
    if (bestResult.length === 0) {
        const rng = seedrandom(`${id}_fallback`);
        const fallback = generateSimpleFallback(rng, size, shape);
        return { id, size, tiles: fallback, shape };
    }

    return { id, size, tiles: bestResult, shape };
}

// Very simple 1-length fallback for level 1 edge cases if everything fails
function generateSimpleFallback(
    rng: () => number,
    size: number,
    shape: boolean[][],
): Omit<TileData, "id">[] {
    const tiles: Omit<TileData, "id">[] = [];
    const DIRS: Direction[] = ["up", "down", "left", "right"];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (shape[y][x]) {
                const dir = DIRS[Math.floor(rng() * DIRS.length)];
                tiles.push({ path: [{ x, y }], direction: dir });
            }
        }
    }
    return tiles;
}

export function restoreShape(levelId: number, size: number): boolean[][] {
    return generateShapeMask(getShapeForLevel(levelId), size);
}
