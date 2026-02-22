import { Point, TileData } from "../utils/movement";

export interface LevelData {
    id: number;
    size: number;
    difficulty: "easy" | "normal" | "hard";
    tiles: Omit<TileData, "id">[];
}

export function generateLevel(id: number): LevelData {
    const size = Math.min(6 + Math.floor((id - 1) / 2), 50);

    let difficulty: "easy" | "normal" | "hard" = "normal";
    if (id <= 5) difficulty = "easy";
    const isHard = id % 5 === 0 && id > 5;
    if (isHard) difficulty = "hard";

    const occupied = Array(size)
        .fill(0)
        .map(() => Array(size).fill(false));
    const tiles: Omit<TileData, "id">[] = [];
    const DIRS = ["up", "down", "left", "right"] as const;

    const getEmptyCells = (): Point[] => {
        const empty: Point[] = [];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (!occupied[y][x]) empty.push({ x, y });
            }
        }
        return empty;
    };

    // Reverse generation to guarantee exactly 1 solvable state
    for (let attempt = 0; attempt < 2000; attempt++) {
        const emptyCells = getEmptyCells();
        if (emptyCells.length === 0) break;

        const head = emptyCells[Math.floor(Math.random() * emptyCells.length)];

        const validDirs = DIRS.filter((dir) => {
            let cx = head.x,
                cy = head.y;
            while (cx >= 0 && cx < size && cy >= 0 && cy < size) {
                if (occupied[cy][cx]) return false; // Hit a previously placed path
                // Advance ray
                if (dir === "up") cy--;
                else if (dir === "down") cy++;
                else if (dir === "left") cx--;
                else if (dir === "right") cx++;
            }
            return true;
        });

        if (validDirs.length === 0) continue;

        const dir = validDirs[Math.floor(Math.random() * validDirs.length)];

        // Block the escape ray for body generation to prevent self-intersection of ray
        const ray: Point[] = [];
        let cx = head.x,
            cy = head.y;
        while (cx >= 0 && cx < size && cy >= 0 && cy < size) {
            if (cx !== head.x || cy !== head.y) ray.push({ x: cx, y: cy });
            if (dir === "up") cy--;
            else if (dir === "down") cy++;
            else if (dir === "left") cx--;
            else if (dir === "right") cx++;
        }

        const path: Point[] = [head];
        let curr = head;
        const targetLen = Math.floor(Math.random() * 6) + 2; // 2 to 7 length paths

        for (let i = 1; i < targetLen; i++) {
            let possibleMoves = [
                { x: curr.x, y: curr.y - 1, d: "up" },
                { x: curr.x, y: curr.y + 1, d: "down" },
                { x: curr.x - 1, y: curr.y, d: "left" },
                { x: curr.x + 1, y: curr.y, d: "right" },
            ];

            if (i === 1) {
                // Must align tail straight behind head for at least 1 cell to look right
                const opposite = {
                    up: "down",
                    down: "up",
                    left: "right",
                    right: "left",
                }[dir];
                possibleMoves = possibleMoves.filter((m) => m.d === opposite);
            }

            const neighbors = possibleMoves.filter(
                (n) =>
                    n.x >= 0 &&
                    n.x < size &&
                    n.y >= 0 &&
                    n.y < size &&
                    !occupied[n.y][n.x] &&
                    !path.some((p) => p.x === n.x && p.y === n.y) &&
                    !ray.some((r) => r.x === n.x && r.y === n.y),
            );

            if (neighbors.length === 0) break;
            const next =
                neighbors[Math.floor(Math.random() * neighbors.length)];
            curr = { x: next.x, y: next.y };
            path.push(curr);
        }

        // path array is generated from head to tail. Reversing makes it tail to head.
        path.reverse();
        path.forEach((p) => (occupied[p.y][p.x] = true));

        tiles.push({ path, direction: dir });
    }

    return { id, size, difficulty, tiles };
}
