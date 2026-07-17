import {
    get,
    limitToLast,
    orderByChild,
    push,
    query,
    ref,
    runTransaction,
    set,
} from "firebase/database";
import { db } from "./firebase";

export interface CommunityLevel {
    id: string;
    creator: string;
    size: number;
    // Real authored dimensions. Older levels only stored `size` (square), so
    // these are optional and fall back to `size` when absent.
    rows?: number;
    cols?: number;
    tiles: {
        path: { x: number; y: number }[];
        direction: "up" | "down" | "left" | "right";
    }[];
    thumbsUp: number;
    thumbsDown: number;
    // Denormalized net score (thumbsUp - thumbsDown) so the DB can index/sort
    // and we can paginate with limitToLast instead of downloading everything.
    score: number;
    votes: Record<string, "up" | "down">;
    createdAt: number;
    tags?: string[];
}

const VALID_DIRECTIONS = new Set(["up", "down", "left", "right"]);

/**
 * Validate a community level coming from an untrusted source (Firebase).
 * Rejects malformed payloads before they can crash the game engine.
 */
export function isValidCommunityLevel(level: any): level is CommunityLevel {
    if (!level || typeof level !== "object") return false;
    if (typeof level.size !== "number" || level.size < 1 || level.size > 50)
        return false;
    if (!Array.isArray(level.tiles) || level.tiles.length === 0) return false;

    const cols = typeof level.cols === "number" ? level.cols : level.size;
    const rows = typeof level.rows === "number" ? level.rows : level.size;
    if (cols < 1 || cols > 50 || rows < 1 || rows > 50) return false;

    for (const tile of level.tiles) {
        if (!tile || !VALID_DIRECTIONS.has(tile.direction)) return false;
        if (!Array.isArray(tile.path) || tile.path.length === 0) return false;
        for (const p of tile.path) {
            if (
                !p ||
                typeof p.x !== "number" ||
                typeof p.y !== "number" ||
                p.x < 0 ||
                p.y < 0 ||
                p.x >= cols ||
                p.y >= rows
            ) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Submit a new community level.
 */
export async function submitCommunityLevel(
    creator: string,
    size: number,
    tiles: CommunityLevel["tiles"],
    tags: string[] = [],
    dimensions?: { rows: number; cols: number },
): Promise<string> {
    const levelsRef = ref(db, "community_levels");
    const newRef = push(levelsRef);
    const id = newRef.key!;

    const cols = dimensions?.cols ?? size;
    const rows = dimensions?.rows ?? size;

    const level: CommunityLevel = {
        id,
        creator,
        size,
        rows,
        cols,
        tiles,
        thumbsUp: 0,
        thumbsDown: 0,
        score: 0,
        votes: {},
        createdAt: Date.now(),
        tags,
    };

    await set(newRef, level);
    return id;
}

/**
 * Fetch community levels. Uses the denormalized `score` index and limitToLast
 * so we page the top-N instead of downloading the entire collection.
 */
export async function fetchCommunityLevels(
    max = 200,
): Promise<CommunityLevel[]> {
    let snapshot;
    try {
        // Preferred: server-side ordering by score (requires a .indexOn rule).
        snapshot = await get(
            query(ref(db, "community_levels"), orderByChild("score"), limitToLast(max)),
        );
    } catch {
        // Fallback for databases without the index configured yet.
        snapshot = await get(ref(db, "community_levels"));
    }
    if (!snapshot.exists()) return [];

    const levels: CommunityLevel[] = [];
    snapshot.forEach((child) => {
        const val = child.val();
        const normalized = {
            ...val,
            id: child.key,
            votes: val.votes || {},
            score:
                typeof val.score === "number"
                    ? val.score
                    : (val.thumbsUp || 0) - (val.thumbsDown || 0),
        } as CommunityLevel;
        // Skip corrupt/malicious entries so one bad level can't break the feed.
        if (isValidCommunityLevel(normalized)) {
            levels.push(normalized);
        }
    });

    // Sort by net score descending, then by most recent.
    return levels.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.createdAt - a.createdAt;
    });
}

/**
 * Pure, client-side vote application — mirrors the server transaction so the UI
 * can update optimistically without re-downloading the whole list.
 */
export function applyVote(
    level: CommunityLevel,
    username: string,
    vote: "up" | "down",
): CommunityLevel {
    const votes = { ...(level.votes || {}) };
    let thumbsUp = level.thumbsUp || 0;
    let thumbsDown = level.thumbsDown || 0;
    const currentVote = votes[username];

    if (currentVote === vote) {
        delete votes[username];
        if (vote === "up") thumbsUp = Math.max(0, thumbsUp - 1);
        else thumbsDown = Math.max(0, thumbsDown - 1);
    } else if (currentVote) {
        votes[username] = vote;
        if (vote === "up") {
            thumbsUp += 1;
            thumbsDown = Math.max(0, thumbsDown - 1);
        } else {
            thumbsDown += 1;
            thumbsUp = Math.max(0, thumbsUp - 1);
        }
    } else {
        votes[username] = vote;
        if (vote === "up") thumbsUp += 1;
        else thumbsDown += 1;
    }

    return { ...level, votes, thumbsUp, thumbsDown, score: thumbsUp - thumbsDown };
}

/**
 * Vote on a community level. Toggle off if same vote, switch if different.
 * Uses a Firebase transaction so concurrent voters can't corrupt counts.
 */
export async function voteCommunityLevel(
    levelId: string,
    username: string,
    vote: "up" | "down",
): Promise<void> {
    const levelRef = ref(db, `community_levels/${levelId}`);
    await runTransaction(levelRef, (level: CommunityLevel | null) => {
        if (!level) return level;

        level.votes = level.votes || {};
        level.thumbsUp = level.thumbsUp || 0;
        level.thumbsDown = level.thumbsDown || 0;

        const currentVote = level.votes[username];

        if (currentVote === vote) {
            // Toggle off
            delete level.votes[username];
            if (vote === "up") level.thumbsUp = Math.max(0, level.thumbsUp - 1);
            else level.thumbsDown = Math.max(0, level.thumbsDown - 1);
        } else if (currentVote) {
            // Switch
            level.votes[username] = vote;
            if (vote === "up") {
                level.thumbsUp += 1;
                level.thumbsDown = Math.max(0, level.thumbsDown - 1);
            } else {
                level.thumbsDown += 1;
                level.thumbsUp = Math.max(0, level.thumbsUp - 1);
            }
        } else {
            // New vote
            level.votes[username] = vote;
            if (vote === "up") level.thumbsUp += 1;
            else level.thumbsDown += 1;
        }

        level.score = level.thumbsUp - level.thumbsDown;
        return level;
    });
}
