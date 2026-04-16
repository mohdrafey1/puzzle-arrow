export type Direction = "up" | "down" | "left" | "right";

export interface Point {
    x: number;
    y: number;
}

export interface TileData {
    id: string;
    path: Point[]; // Sequence from tail to head
    direction: Direction;
    removed?: boolean;
}

/**
 * Build a 2D occupied grid from the current board state.
 * Only includes non-removed tiles. Useful for caching between taps.
 */
export function buildOccupiedGrid(
    board: TileData[],
    boardSize: number,
): boolean[][] {
    const grid = Array(boardSize)
        .fill(0)
        .map(() => Array(boardSize).fill(false));
    for (const tile of board) {
        if (tile.removed) continue;
        for (const p of tile.path) {
            grid[p.y][p.x] = true;
        }
    }
    return grid;
}

/**
 * Remove a tile's cells from an existing occupied grid (in-place mutation).
 */
export function clearTileFromGrid(
    grid: boolean[][],
    tile: TileData,
): void {
    for (const p of tile.path) {
        grid[p.y][p.x] = false;
    }
}

/**
 * Checks if a tile can completely slide out of the board without its head ray hitting any other cells.
 * Cells outside the shape mask (if provided) are treated as exits.
 *
 * If `occupiedGrid` is provided, uses it directly instead of rebuilding from scratch.
 * The grid should include ALL tiles including the current one — this function
 * temporarily ignores the tile's own head cell.
 */
export function canMove(
    tile: TileData,
    board: TileData[],
    boardSize: number,
    shape?: boolean[][],
    occupiedGrid?: boolean[][],
): boolean {
    // Use provided grid or build one on the fly (backward compat)
    let occupied: boolean[][];
    if (occupiedGrid) {
        occupied = occupiedGrid;
    } else {
        occupied = Array(boardSize)
            .fill(0)
            .map(() => Array(boardSize).fill(false));
        for (const other of board) {
            if (other.id === tile.id || other.removed) continue;
            for (const p of other.path) {
                occupied[p.y][p.x] = true;
            }
        }
        // Mark own body (excluding head) so the arrow can't exit through itself
        for (let i = 0; i < tile.path.length - 1; i++) {
            const p = tile.path[i];
            occupied[p.y][p.x] = true;
        }
    }

    const head = tile.path[tile.path.length - 1];
    // The head cell is occupied in the cached grid — skip it by starting one step ahead
    const dirX =
        tile.direction === "right" ? 1 : tile.direction === "left" ? -1 : 0;
    const dirY =
        tile.direction === "down" ? 1 : tile.direction === "up" ? -1 : 0;

    let cx = head.x + dirX;
    let cy = head.y + dirY;

    while (true) {
        // Out of bounds — clear path
        if (cx < 0 || cx >= boardSize || cy < 0 || cy >= boardSize) {
            break;
        }

        // Outside shape mask — also counts as exit
        if (shape && !shape[cy]?.[cx]) {
            break;
        }

        if (occupied[cy][cx]) {
            return false;
        }

        cx += dirX;
        cy += dirY;
    }

    return true;
}
