/**
 * Board shape masks for level variety.
 * Each shape function returns a boolean[][] where true = active cell.
 */
export type ShapeName =
    | "square"
    | "diamond"
    | "circle"
    | "heart"
    | "cross"
    | "triangle"
    | "lshape"
    | "arrow";
/** All shapes in order — levels cycle through them every 5 levels */
export const SHAPE_ORDER: ShapeName[] = [
    "square",
    "diamond",
    "circle",
    "heart",
    "cross",
    "triangle",
    "lshape",
    "arrow",
];
/** Get shape for a given level id */
export function getShapeForLevel(id: number): ShapeName {
    const index = Math.floor((id - 1) / 5) % SHAPE_ORDER.length;
    return SHAPE_ORDER[index];
}
/** Create an N×N grid filled with a value */
function makeGrid(size: number, fill: boolean): boolean[][] {
    return Array.from({ length: size }, () => Array(size).fill(fill));
}
/** Distance from center (normalized 0–1 for half-size radius) */
function dist(x: number, y: number, cx: number, cy: number, r: number) {
    return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r;
}
/** Generate the shape mask for a given shape and grid size */
export function generateShapeMask(shape: ShapeName, size: number): boolean[][] {
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
                    const dx = Math.abs(x - cx);
                    const dy = Math.abs(y - cy);
                    mask[y][x] = dx + dy <= r + 0.5;
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
        case "heart": {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Normalized coords: -1 to 1
                    const nx = (x - cx) / r;
                    const ny = -(y - cy) / r; // flip y so heart points down
                    // Heart equation: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
                    const val =
                        (nx * nx + ny * ny - 1) ** 3 - nx * nx * ny * ny * ny;
                    mask[y][x] = val <= 0.1;
                }
            }
            return mask;
        }
        case "cross": {
            const arm = Math.max(1, Math.floor(size / 3));
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const inHorizontal = y >= arm && y < size - arm;
                    const inVertical = x >= arm && x < size - arm;
                    mask[y][x] = inHorizontal || inVertical;
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
                    // Left column (full height) OR bottom rows
                    const inLeftCol = x < armWidth;
                    const inBottomRow = y >= size - armWidth;
                    mask[y][x] = inLeftCol || inBottomRow;
                }
            }
            return mask;
        }
        case "arrow": {
            const midY = Math.floor(size / 2);
            const shaftWidth = Math.max(1, Math.floor(size / 4));
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Shaft: horizontal band in the middle
                    const inShaft =
                        Math.abs(y - midY) < shaftWidth && x < size * 0.6;
                    // Head: triangle on the right half
                    const headStart = Math.floor(size * 0.4);
                    const inHead =
                        x >= headStart &&
                        Math.abs(y - midY) <= (size - x) * 0.7;
                    mask[y][x] = inShaft || inHead;
                }
            }
            return mask;
        }
        default:
            return makeGrid(size, true);
    }
}
/** Count active cells in a shape mask */
export function countActiveCells(mask: boolean[][]): number {
    let count = 0;
    for (const row of mask) {
        for (const cell of row) {
            if (cell) count++;
        }
    }
    return count;
}
