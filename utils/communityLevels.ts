import { get, push, ref, set, update } from "firebase/database";
import { db } from "./firebase";

export interface CommunityLevel {
    id: string;
    creator: string;
    size: number;
    tiles: {
        path: { x: number; y: number }[];
        direction: "up" | "down" | "left" | "right";
    }[];
    thumbsUp: number;
    thumbsDown: number;
    votes: Record<string, "up" | "down">;
    createdAt: number;
}

/**
 * Submit a new community level.
 */
export async function submitCommunityLevel(
    creator: string,
    size: number,
    tiles: CommunityLevel["tiles"],
): Promise<string> {
    const levelsRef = ref(db, "community_levels");
    const newRef = push(levelsRef);
    const id = newRef.key!;

    const level: CommunityLevel = {
        id,
        creator,
        size,
        tiles,
        thumbsUp: 0,
        thumbsDown: 0,
        votes: {},
        createdAt: Date.now(),
    };

    await set(newRef, level);
    return id;
}

/**
 * Fetch all community levels, sorted by net score (thumbsUp - thumbsDown) desc.
 */
export async function fetchCommunityLevels(): Promise<CommunityLevel[]> {
    const snapshot = await get(ref(db, "community_levels"));
    if (!snapshot.exists()) return [];

    const levels: CommunityLevel[] = [];
    snapshot.forEach((child) => {
        const val = child.val();
        levels.push({
            ...val,
            id: child.key,
            votes: val.votes || {},
        } as CommunityLevel);
    });

    // Sort by net score descending, then by most recent
    return levels.sort((a, b) => {
        const scoreA = a.thumbsUp - a.thumbsDown;
        const scoreB = b.thumbsUp - b.thumbsDown;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.createdAt - a.createdAt;
    });
}

/**
 * Vote on a community level. Toggle off if same vote, switch if different.
 */
export async function voteCommunityLevel(
    levelId: string,
    username: string,
    vote: "up" | "down",
): Promise<void> {
    const levelRef = ref(db, `community_levels/${levelId}`);
    const snapshot = await get(levelRef);
    if (!snapshot.exists()) return;

    const level = snapshot.val() as CommunityLevel;
    const currentVote = level.votes?.[username];

    const updates: Record<string, any> = {};

    if (currentVote === vote) {
        // Remove vote (toggle off)
        updates[`votes/${username}`] = null;
        if (vote === "up") {
            updates["thumbsUp"] = Math.max(0, level.thumbsUp - 1);
        } else {
            updates["thumbsDown"] = Math.max(0, level.thumbsDown - 1);
        }
    } else if (currentVote) {
        // Switch vote
        updates[`votes/${username}`] = vote;
        if (vote === "up") {
            updates["thumbsUp"] = level.thumbsUp + 1;
            updates["thumbsDown"] = Math.max(0, level.thumbsDown - 1);
        } else {
            updates["thumbsDown"] = level.thumbsDown + 1;
            updates["thumbsUp"] = Math.max(0, level.thumbsUp - 1);
        }
    } else {
        // New vote
        updates[`votes/${username}`] = vote;
        if (vote === "up") {
            updates["thumbsUp"] = level.thumbsUp + 1;
        } else {
            updates["thumbsDown"] = level.thumbsDown + 1;
        }
    }

    await update(levelRef, updates);
}
