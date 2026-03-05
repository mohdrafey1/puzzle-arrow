import {
    get,
    limitToLast,
    onValue,
    orderByChild,
    query,
    ref,
    set,
} from "firebase/database";
import { db } from "./firebase";

export interface LeaderboardEntry {
    username: string;
    level: number;
    updatedAt: number;
}

/**
 * Check if a username is already taken in the leaderboard.
 */
export async function checkUsernameAvailable(
    username: string,
): Promise<boolean> {
    const snapshot = await get(ref(db, `leaderboard/${username}`));
    return !snapshot.exists();
}

/**
 * Submit (or update) the user's highest reached level.
 * Only updates if the new level is higher than the existing one.
 */
export async function submitScore(
    username: string,
    level: number,
): Promise<void> {
    const entryRef = ref(db, `leaderboard/${username}`);
    const snapshot = await get(entryRef);

    if (snapshot.exists()) {
        const existing = snapshot.val() as LeaderboardEntry;
        if (level <= existing.level) return; // Don't overwrite with a lower level
    }

    await set(entryRef, {
        username,
        level,
        updatedAt: Date.now(),
    } satisfies LeaderboardEntry);
}

/**
 * Fetch the full leaderboard, sorted by level descending.
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    const leaderboardRef = query(
        ref(db, "leaderboard"),
        orderByChild("level"),
        limitToLast(100),
    );
    const snapshot = await get(leaderboardRef);

    if (!snapshot.exists()) return [];

    const entries: LeaderboardEntry[] = [];
    snapshot.forEach((child) => {
        entries.push(child.val() as LeaderboardEntry);
    });

    // We sort the data on the client side so we don't depend on Firebase index rules
    return entries.sort((a, b) => b.level - a.level);
}

/**
 * Subscribe to real-time leaderboard updates.
 * Returns an unsubscribe function.
 */
export function subscribeLeaderboard(
    callback: (entries: LeaderboardEntry[]) => void,
): () => void {
    const leaderboardRef = query(
        ref(db, "leaderboard"),
        orderByChild("level"),
        limitToLast(100),
    );

    const unsubscribe = onValue(leaderboardRef, (snapshot) => {
        if (!snapshot.exists()) {
            callback([]);
            return;
        }

        const entries: LeaderboardEntry[] = [];
        snapshot.forEach((child) => {
            entries.push(child.val() as LeaderboardEntry);
        });

        // We sort the data on the client side
        callback(entries.sort((a, b) => b.level - a.level));
    });

    return unsubscribe;
}

/**
 * Fetch a specific user's leaderboard entry to show their score.
 */
export async function fetchUserEntry(
    username: string,
): Promise<LeaderboardEntry | null> {
    const snapshot = await get(ref(db, `leaderboard/${username}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as LeaderboardEntry;
}
