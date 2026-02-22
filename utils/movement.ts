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
 */
export function canMove(
    tile: TileData,
    board: TileData[],
    boardSize: number = 20,
): boolean {
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

        // Check if within a massive conceptual outer bounds
        if (cx < -5 || cx > boardSize + 5 || cy < -5 || cy > boardSize + 5) {
            break;
        }

        // Check if any other tile occupies this cell currently
        for (const other of board) {
            if (other.id === tile.id || other.removed) continue;

            // If another tile is at (cx, cy), we are blocked!
            if (other.path.some((p) => p.x === cx && p.y === cy)) {
                return false;
            }
        }
    }

    return true;
}
