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
 * Checks if a tile can completely slide out of the board without its head ray hitting any other cells.
 * Cells outside the shape mask (if provided) are treated as exits.
 */
export function canMove(
    tile: TileData,
    board: TileData[],
    boardSize: number,
    shape?: boolean[][],
): boolean {
    // Build a 2D boolean array of occupied cells from all other active tiles
    const occupied = Array(boardSize)
        .fill(0)
        .map(() => Array(boardSize).fill(false));
    for (const other of board) {
        if (other.id === tile.id || other.removed) continue;
        for (const p of other.path) {
            occupied[p.y][p.x] = true;
        }
    }

    const head = tile.path[tile.path.length - 1];
    let cx = head.x;
    let cy = head.y;

    const dirX =
        tile.direction === "right" ? 1 : tile.direction === "left" ? -1 : 0;
    const dirY =
        tile.direction === "down" ? 1 : tile.direction === "up" ? -1 : 0;

    while (true) {
        cx += dirX;
        cy += dirY;

        // Out of bounds — clear path
        if (cx < 0 || cx >= boardSize || cy < 0 || cy >= boardSize) {
            break;
        }

        // Outside shape mask — also counts as exit
        if (shape && !shape[cy]?.[cx]) {
            break;
        }

        if (occupied[cy]?.[cx]) {
            return false;
        }
    }

    return true;
}
