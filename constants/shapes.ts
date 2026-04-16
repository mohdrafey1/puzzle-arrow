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
    | "arrow"
    | "hourglass"
    | "ring"
    | "zigzag"
    | "plus_offset";
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
    "hourglass",
    "ring",
    "zigzag",
    "plus_offset",
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
        case "hourglass": {
            // Two triangles meeting at the center — wide at top/bottom, narrow in middle
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
            // Donut shape — circle with a hole in the center
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
            // S-shaped / zigzag band that winds across the board
            const bandWidth = Math.max(2, Math.floor(size * 0.35));
            for (let y = 0; y < size; y++) {
                // 3 horizontal sections, shifting left-right-left
                const section = Math.floor((y / size) * 3);
                let startX: number, endX: number;
                if (section === 0) {
                    // Top: left-aligned
                    startX = 0;
                    endX = bandWidth + Math.floor(size * 0.2);
                } else if (section === 1) {
                    // Middle: right-aligned
                    startX = size - bandWidth - Math.floor(size * 0.2);
                    endX = size;
                } else {
                    // Bottom: left-aligned
                    startX = 0;
                    endX = bandWidth + Math.floor(size * 0.2);
                }
                // Bridge rows between sections
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
            // Plus/cross but offset — two overlapping rectangles, shifted
            const armW = Math.max(2, Math.floor(size * 0.35));
            const offset = Math.floor(size * 0.15);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Vertical bar (shifted right)
                    const inVertical =
                        x >= Math.floor(cx) - Math.floor(armW / 2) + offset &&
                        x < Math.floor(cx) + Math.ceil(armW / 2) + offset;
                    // Horizontal bar (shifted up)
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
