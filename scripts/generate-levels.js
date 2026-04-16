/**
 * Generate static level data for levels 101–1000.
 * Uses the v9 algorithm with progressive difficulty brackets.
 *
 * Usage:  node scripts/generate-levels.js
 */

const seedrandom = require("seedrandom");
const fs = require("fs");
const path = require("path");

// ─── Inline shape logic (must match constants/shapes.ts) ────────────

const SHAPE_ORDER = [
    "square",
    "diamond",
    "circle",
    "heart",
    "cross",
    "triangle",
    "lshape",
    "arrow",
    "hourglass",
    "ring",
    "zigzag",
    "plus_offset",
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
        case "hourglass": {
            for (let y = 0; y < size; y++) {
                const distFromCenter = Math.abs(y - cy);
                const halfWidth = Math.max(1, Math.floor((distFromCenter / r) * r) + 1);
                const startX = Math.floor(cx) - halfWidth + 1;
                const endX = Math.ceil(cx) + halfWidth;
                for (let x = Math.max(0, startX); x < Math.min(size, endX); x++) {
                    mask[y][x] = true;
                }
            }
            return mask;
        }
        case "ring": {
            const outerR = 1.05;
            const innerR = 0.45;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const d = dist(x, y, cx, cy, r);
                    mask[y][x] = d <= outerR && d >= innerR;
                }
            }
            return mask;
        }
        case "zigzag": {
            const bandWidth = Math.max(2, Math.floor(size * 0.35));
            for (let y = 0; y < size; y++) {
                const section = Math.floor((y / size) * 3);
                let startX, endX;
                if (section === 0) {
                    startX = 0;
                    endX = bandWidth + Math.floor(size * 0.2);
                } else if (section === 1) {
                    startX = size - bandWidth - Math.floor(size * 0.2);
                    endX = size;
                } else {
                    startX = 0;
                    endX = bandWidth + Math.floor(size * 0.2);
                }
                const rowInSection = y - Math.floor((section * size) / 3);
                if (rowInSection <= 1 && section > 0) {
                    startX = 0;
                    endX = size;
                }
                for (let x = Math.max(0, startX); x < Math.min(size, endX); x++) {
                    mask[y][x] = true;
                }
            }
            return mask;
        }
        case "plus_offset": {
            const armW = Math.max(2, Math.floor(size * 0.35));
            const offset = Math.floor(size * 0.15);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const inVertical =
                        x >= Math.floor(cx) - Math.floor(armW / 2) + offset &&
                        x < Math.floor(cx) + Math.ceil(armW / 2) + offset;
                    const inHorizontal =
                        y >= Math.floor(cy) - Math.floor(armW / 2) - offset &&
                        y < Math.floor(cy) + Math.ceil(armW / 2) - offset;
                    mask[y][x] = (inVertical || inHorizontal) && x < size && y < size && x >= 0 && y >= 0;
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

// ─── Backward level generation (v9 with edgeBias param) ─────────────

function tryGenerateBackward(rng, size, shape, activeCellCount, minLen, maxLen, edgeBias) {
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
        if (edgeCells.length > 0 && rng() < edgeBias) {
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

// ─── v9 generateLevel with progressive difficulty brackets ──────────

function generateLevel(id) {
    // 60 levels per round (12 shapes * 5 levels each)
    const round = Math.floor((id - 1) / 60);
    const levelInShape = (id - 1) % 5;

    // Smoother grid growth: +2 per round instead of +5
    const baseSize = 6 + round * 2;
    const calculatedSize = baseSize + levelInShape;
    const size = Math.min(calculatedSize, 25);

    const shapeName = getShapeForLevel(id);
    const shape = generateShapeMask(shapeName, size);
    const activeCellCount = countActiveCells(shape);

    // Progressive difficulty brackets
    let minLen, maxLen, seedAttempts, fillTarget, edgeBias;

    if (id <= 40) {
        minLen = 2;
        maxLen = Math.min(Math.floor(size / 3) + 3, 8);
        seedAttempts = 30;
        fillTarget = 0.9;
        edgeBias = 0.6;
    } else if (id <= 100) {
        minLen = 2;
        maxLen = Math.min(Math.floor(size / 3) + 3, 10);
        seedAttempts = 25;
        fillTarget = 0.9;
        edgeBias = 0.55;
    } else if (id <= 200) {
        minLen = 3;
        maxLen = Math.min(Math.floor(size / 3) + 4, 10);
        seedAttempts = 20;
        fillTarget = 0.9;
        edgeBias = 0.5;
    } else if (id <= 400) {
        minLen = 3;
        maxLen = Math.min(Math.floor(size / 3) + 4, 11);
        seedAttempts = 15;
        fillTarget = 0.92;
        edgeBias = 0.45;
    } else if (id <= 600) {
        minLen = 4;
        maxLen = Math.min(Math.floor(size / 3) + 5, 12);
        seedAttempts = 12;
        fillTarget = 0.93;
        edgeBias = 0.4;
    } else if (id <= 800) {
        minLen = 4;
        maxLen = Math.min(Math.floor(size / 2) + 2, 13);
        seedAttempts = 10;
        fillTarget = 0.94;
        edgeBias = 0.35;
    } else {
        minLen = 5;
        maxLen = Math.min(Math.floor(size / 2) + 3, 14);
        seedAttempts = 8;
        fillTarget = 0.95;
        edgeBias = 0.3;
    }

    let bestResult = [];
    let bestFill = 0;

    for (let seedOffset = 0; seedOffset < seedAttempts; seedOffset++) {
        const rng = seedrandom(`${id}_backward_v9_${seedOffset}`);
        const result = tryGenerateBackward(
            rng,
            size,
            shape,
            activeCellCount,
            minLen,
            maxLen,
            edgeBias,
        );

        if (result.filled > bestFill) {
            bestFill = result.filled;
            bestResult = result.tiles;
        }

        if (bestFill >= fillTarget) break;
    }

    if (bestResult.length === 0) {
        const rng = seedrandom(`${id}_fallback`);
        const fallback = generateSimpleFallback(rng, size, shape);
        return { id, size, tiles: fallback };
    }

    return { id, size, tiles: bestResult };
}

// ─── Main: generate levels 101–1000 in chunks of 50 ──────────────────

const OUTPUT_DIR = path.join(__dirname, "..", "assets", "levels");
const CHUNK_SIZE = 50;
const START_LEVEL = 101;
const END_LEVEL = 1000;
const START_CHUNK_INDEX = 2; // chunk-2 through chunk-19

const totalLevels = END_LEVEL - START_LEVEL + 1;
const totalChunks = totalLevels / CHUNK_SIZE;

console.log(`\n🎯 Generating levels ${START_LEVEL}–${END_LEVEL} (${totalLevels} levels, ${totalChunks} chunks) with v9 difficulty\n`);

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

        const pct = (((id - START_LEVEL + 1) / totalLevels) * 100).toFixed(1);
        process.stdout.write(`\r  ⏳ Level ${id}/${END_LEVEL} (${pct}%) — chunk-${chunkIndex}`);
    }

    const filePath = path.join(OUTPUT_DIR, `chunk-${chunkIndex}.json`);
    fs.writeFileSync(filePath, JSON.stringify(levels));

    const elapsed = ((Date.now() - chunkStart) / 1000).toFixed(1);
    const avgArrows = (levels.reduce((s, l) => s + l.tiles.length, 0) / levels.length).toFixed(1);
    const avgMinPath = (levels.reduce((s, l) => s + Math.min(...l.tiles.map(t => t.path.length)), 0) / levels.length).toFixed(1);
    console.log(`\n  ✅ chunk-${chunkIndex}.json — levels ${fromLevel}–${toLevel} (${elapsed}s, avg ${avgArrows} arrows, min path ~${avgMinPath})`);
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n🎉 Done! Generated ${totalLevels} levels in ${totalElapsed}s\n`);
