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
    // AND self-body cells (excluding the head) to detect self-collision
    const occupied = Array(boardSize)
        .fill(0)
        .map(() => Array(boardSize).fill(false));
    const inBounds = (p: Point) =>
        p.x >= 0 && p.x < boardSize && p.y >= 0 && p.y < boardSize;

    for (const other of board) {
        if (other.id === tile.id || other.removed) continue;
        for (const p of other.path) {
            if (inBounds(p)) occupied[p.y][p.x] = true;
        }
    }
    // Mark own body (excluding head) so the arrow can't exit through itself
    for (let i = 0; i < tile.path.length - 1; i++) {
        const p = tile.path[i];
        if (inBounds(p)) occupied[p.y][p.x] = true;
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
