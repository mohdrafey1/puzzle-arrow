/**
 * Generate static level data for levels 501–1000.
 * Outputs 10 chunk files (chunk-10.json through chunk-19.json), 50 levels each.
 *
 * Usage:  node scripts/generate-levels.js
 */

// We need seedrandom — the same library used in constants/levels.ts
const seedrandom = require("seedrandom");
const fs = require("fs");
const path = require("path");

// ─── Inline the shape + level generation logic (ported from TS) ────────

const SHAPE_ORDER = [
    "square",
    "diamond",
    "circle",
    "heart",
    "cross",
    "triangle",
    "lshape",
    "arrow",
];

function getShapeForLevel(id) {
    const index = Math.floor((id - 1) / 5) % SHAPE_ORDER.length;
    return SHAPE_ORDER[index];
}

function makeGrid(size, fill) {
    return Array.from({ length: size }, () => Array(size).fill(fill));
}

function dist(x, y, cx, cy, r) {
    return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r;
}

function generateShapeMask(shape, size) {
    const mask = makeGrid(size, false);
    const cx = (size - 1) / 2;
    const cy = (size - 1) / 2;
    const r = (size - 1) / 2;
    switch (shape) {
        case "square":
            return makeGrid(size, true);
        case "diamond":
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    mask[y][x] = Math.abs(x - cx) + Math.abs(y - cy) <= r + 0.5;
                }
            }
            return mask;
        case "circle":
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    mask[y][x] = dist(x, y, cx, cy, r) <= 1.05;
                }
            }
            return mask;
        case "heart":
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const nx = (x - cx) / r;
                    const ny = -(y - cy) / r;
                    const val =
                        (nx * nx + ny * ny - 1) ** 3 - nx * nx * ny * ny * ny;
                    mask[y][x] = val <= 0.1;
                }
            }
            return mask;
        case "cross": {
            const arm = Math.max(1, Math.floor(size / 3));
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    mask[y][x] =
                        (y >= arm && y < size - arm) ||
                        (x >= arm && x < size - arm);
                }
            }
            return mask;
        }
        case "triangle":
            for (let y = 0; y < size; y++) {
                const rowWidth = Math.ceil(((y + 1) / size) * size);
                const startX = Math.floor((size - rowWidth) / 2);
                for (let x = startX; x < startX + rowWidth && x < size; x++) {
                    if (x >= 0) mask[y][x] = true;
                }
            }
            return mask;
        case "lshape": {
            const armWidth = Math.max(2, Math.ceil(size * 0.4));
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    mask[y][x] = x < armWidth || y >= size - armWidth;
                }
            }
            return mask;
        }
        case "arrow": {
            const midY = Math.floor(size / 2);
            const shaftWidth = Math.max(1, Math.floor(size / 4));
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const inShaft =
                        Math.abs(y - midY) < shaftWidth && x < size * 0.6;
                    const headStart = Math.floor(size * 0.4);
                    const inHead =
                        x >= headStart && Math.abs(y - midY) <= (size - x) * 0.7;
                    mask[y][x] = inShaft || inHead;
                }
            }
            return mask;
        }
        default:
            return makeGrid(size, true);
    }
}

function countActiveCells(mask) {
    let count = 0;
    for (const row of mask) {
        for (const cell of row) {
            if (cell) count++;
        }
    }
    return count;
}

// ─── Backward level generation (exact port from constants/levels.ts) ───

function tryGenerateBackward(rng, size, shape, activeCellCount, minLen, maxLen) {
    const occupied = Array(size)
        .fill(0)
        .map(() => Array(size).fill(false));

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (!shape[y][x]) occupied[y][x] = true;
        }
    }

    const DIRS = ["up", "down", "left", "right"];
    const tiles = [];

    let attemptsWithoutPlacement = 0;
    const maxAttempts = 300 + activeCellCount * 3;

    while (attemptsWithoutPlacement < maxAttempts) {
        const emptyCells = [];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (!occupied[y][x]) emptyCells.push({ x, y });
            }
        }
        if (emptyCells.length === 0) break;

        emptyCells.sort((a, b) => {
            const aIsEdge =
                a.x === 0 || a.y === 0 || a.x === size - 1 || a.y === size - 1;
            const bIsEdge =
                b.x === 0 || b.y === 0 || b.x === size - 1 || b.y === size - 1;
            if (aIsEdge && !bIsEdge) return -1;
            if (bIsEdge && !aIsEdge) return 1;
            return 0;
        });

        let head = emptyCells[Math.floor(rng() * emptyCells.length)];
        const edgeCells = emptyCells.filter(
            (c) =>
                c.x === 0 || c.y === 0 || c.x === size - 1 || c.y === size - 1,
        );
        if (edgeCells.length > 0 && rng() < 0.6) {
            head = edgeCells[Math.floor(rng() * edgeCells.length)];
        }

        const validDirs = DIRS.filter((dir) => {
            const dirX = dir === "right" ? 1 : dir === "left" ? -1 : 0;
            const dirY = dir === "down" ? 1 : dir === "up" ? -1 : 0;
            let cx = head.x + dirX;
            let cy = head.y + dirY;
            while (cx >= 0 && cx < size && cy >= 0 && cy < size && shape[cy][cx]) {
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

        const rayCells = [];
        const dirX = dir === "right" ? 1 : dir === "left" ? -1 : 0;
        const dirY = dir === "down" ? 1 : dir === "up" ? -1 : 0;
        let rx = head.x + dirX;
        let ry = head.y + dirY;
        while (rx >= 0 && rx < size && ry >= 0 && ry < size) {
            if (!occupied[ry][rx]) {
                occupied[ry][rx] = true;
                rayCells.push({ x: rx, y: ry });
            }
            rx += dirX;
            ry += dirY;
        }

        const isHeadOnEdge =
            head.x === 0 ||
            head.y === 0 ||
            head.x === size - 1 ||
            head.y === size - 1;

        const actualMaxLen = isHeadOnEdge
            ? Math.min(size * 2, maxLen * 2)
            : maxLen;
        const targetLen =
            Math.floor(rng() * (actualMaxLen - minLen + 1)) + minLen;
        const path = [head];
        let curr = head;

        const opposite = { up: "down", down: "up", left: "right", right: "left" };

        for (let i = 1; i < targetLen; i++) {
            let possible = [
                { x: curr.x, y: curr.y - 1, d: "up" },
                { x: curr.x, y: curr.y + 1, d: "down" },
                { x: curr.x - 1, y: curr.y, d: "left" },
                { x: curr.x + 1, y: curr.y, d: "right" },
            ];

            if (i === 1) {
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

        rayCells.forEach((p) => {
            occupied[p.y][p.x] = false;
        });

        const allowedMinLen =
            attemptsWithoutPlacement > maxAttempts * 0.8
                ? Math.max(2, Math.floor(minLen / 2))
                : minLen;

        if (path.length >= allowedMinLen || path.length === targetLen) {
            path.reverse();
            path.forEach((p) => (occupied[p.y][p.x] = true));
            tiles.push({ path, direction: dir });
            attemptsWithoutPlacement = 0;
        } else {
            attemptsWithoutPlacement++;
        }
    }

    const filledCount = tiles.reduce((sum, t) => sum + t.path.length, 0);
    return {
        tiles: tiles.reverse(),
        filled: filledCount / activeCellCount,
    };
}

function generateSimpleFallback(rng, size, shape) {
    const tiles = [];
    const DIRS = ["up", "down", "left", "right"];
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

function generateLevel(id) {
    const round = Math.floor((id - 1) / 40);
    const levelInShape = (id - 1) % 5;

    const baseSize = 6 + round * 5;
    const calculatedSize = baseSize + levelInShape;
    const size = Math.min(calculatedSize, 25);

    const shapeName = getShapeForLevel(id);
    const shape = generateShapeMask(shapeName, size);
    const activeCellCount = countActiveCells(shape);

    const minLen = 2;
    const maxLen = Math.min(Math.floor(size / 3) + 3, 10);

    let bestResult = [];
    let bestFill = 0;

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

        if (bestFill >= 0.9) break;
    }

    if (bestResult.length === 0) {
        const rng = seedrandom(`${id}_fallback`);
        const fallback = generateSimpleFallback(rng, size, shape);
        return { id, size, tiles: fallback };
    }

    return { id, size, tiles: bestResult };
}

// ─── Main: generate levels 501–1000 in chunks of 50 ───────────────────

const OUTPUT_DIR = path.join(__dirname, "..", "assets", "levels");
const CHUNK_SIZE = 50;
const START_LEVEL = 501;
const END_LEVEL = 1000;
const START_CHUNK_INDEX = 10; // chunk-10 through chunk-19

const totalLevels = END_LEVEL - START_LEVEL + 1;
const totalChunks = totalLevels / CHUNK_SIZE;

console.log(`\n🎯 Generating levels ${START_LEVEL}–${END_LEVEL} (${totalLevels} levels, ${totalChunks} chunks)\n`);

const startTime = Date.now();

for (let c = 0; c < totalChunks; c++) {
    const chunkIndex = START_CHUNK_INDEX + c;
    const fromLevel = START_LEVEL + c * CHUNK_SIZE;
    const toLevel = fromLevel + CHUNK_SIZE - 1;
    const chunkStart = Date.now();

    const levels = [];
    for (let id = fromLevel; id <= toLevel; id++) {
        const level = generateLevel(id);
        levels.push(level);

        // Progress indicator
        const pct = (((id - START_LEVEL + 1) / totalLevels) * 100).toFixed(1);
        process.stdout.write(`\r  ⏳ Level ${id}/${END_LEVEL} (${pct}%) — chunk-${chunkIndex}`);
    }

    const filePath = path.join(OUTPUT_DIR, `chunk-${chunkIndex}.json`);
    fs.writeFileSync(filePath, JSON.stringify(levels));

    const elapsed = ((Date.now() - chunkStart) / 1000).toFixed(1);
    console.log(`\n  ✅ chunk-${chunkIndex}.json — levels ${fromLevel}–${toLevel} (${elapsed}s)`);
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n🎉 Done! Generated ${totalLevels} levels in ${totalElapsed}s\n`);
