import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearDailyProgress } from "./dailyChallenge";
import {
    applyLevelCompletion,
    CompletionRecord,
    LevelCompletionIdentity,
    mergeCompletionRecords,
    normalizeUserStats,
    UserStats,
} from "./progress";

export type {
    CompletionRecord,
    LevelCompletionIdentity,
    UserStats,
} from "./progress";

// Keep read/modify/write operations ordered so rapid completions cannot lose data.
let progressWrites: Promise<unknown> = Promise.resolve();
function serializeProgressWrite<T>(write: () => Promise<T>): Promise<T> {
    const result = progressWrites.then(write, write);
    progressWrites = result.catch(() => undefined);
    return result;
}

const UNLOCKED_LEVEL_KEY = "@unlocked_level";
const THEME_KEY = "@app_theme";
const HAPTICS_KEY = "@haptics_enabled";
const SFX_ENABLED_KEY = "@sfx_enabled";
const SFX_SELECTION_KEY = "@sfx_selection";
const SFX_VOLUME_KEY = "@sfx_volume";
const LEVEL_CACHE_PREFIX = "@level_cache_";
const COMPLETED_LEVELS_KEY = "@completed_levels";
const LEADERBOARD_USERNAME_KEY = "@leaderboard_username";
const ARROWS_BALANCE_KEY = "@arrows_balance";
const STATS_KEY = "@user_stats";
const UNLOCKED_ACHIEVEMENTS_KEY = "@unlocked_achievements";
const ACTIVE_CUSTOMIZATION_KEY = "@active_customization";
const UNLOCKED_ITEMS_KEY = "@unlocked_items";

export type ThemeType = "light" | "dark" | "system";

export interface SfxSelection {
    arrowout: string;
    gameover: string;
    gamewin: string;
}

export const DEFAULT_SFX_SELECTION: SfxSelection = {
    arrowout: "pop.mp3",
    gameover: "default_boo.mp3",
    gamewin: "clapping_default.m4a",
};

async function readUnlockedLevel(): Promise<number> {
    const val = await AsyncStorage.getItem(UNLOCKED_LEVEL_KEY);
    const parsed = val ? Number.parseInt(val, 10) : 1;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function getUnlockedLevel(): Promise<number> {
    try {
        return await readUnlockedLevel();
    } catch {
        return 1;
    }
}

export async function setUnlockedLevel(level: number): Promise<void> {
    return serializeProgressWrite(async () => {
        if (!Number.isInteger(level) || level < 1)
            throw new RangeError("Invalid unlocked level");
        const current = await readUnlockedLevel();
        await AsyncStorage.setItem(
            UNLOCKED_LEVEL_KEY,
            Math.max(current, level).toString(),
        );
    });
}

export async function getThemePreference(): Promise<ThemeType> {
    try {
        const val = await AsyncStorage.getItem(THEME_KEY);
        return (val as ThemeType) || "system";
    } catch {
        return "system";
    }
}

export async function setThemePreference(theme: ThemeType): Promise<void> {
    try {
        await AsyncStorage.setItem(THEME_KEY, theme);
    } catch {
        // skip
    }
}

/** Reset campaign/daily results while retaining owned items and community history. */
export async function resetProgress(): Promise<void> {
    return serializeProgressWrite(async () => {
        const stats = await readUserStats();
        await clearDailyProgress();
        await AsyncStorage.multiRemove([
            UNLOCKED_LEVEL_KEY,
            COMPLETED_LEVELS_KEY,
        ]);
        await AsyncStorage.setItem(
            STATS_KEY,
            JSON.stringify({
                ...stats,
                levelsCompleted: 0,
                completedCampaignLevelIds: [],
            }),
        );
    });
}

export async function getHapticsEnabled(): Promise<boolean> {
    try {
        const val = await AsyncStorage.getItem(HAPTICS_KEY);
        return val === null ? true : val === "true"; // default on
    } catch {
        return true;
    }
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
    try {
        await AsyncStorage.setItem(HAPTICS_KEY, String(enabled));
    } catch {
        // skip
    }
}

export async function getSfxEnabled(): Promise<boolean> {
    try {
        const val = await AsyncStorage.getItem(SFX_ENABLED_KEY);
        return val === null ? true : val === "true"; // default on
    } catch {
        return true;
    }
}

export async function setSfxEnabled(enabled: boolean): Promise<void> {
    try {
        await AsyncStorage.setItem(SFX_ENABLED_KEY, String(enabled));
    } catch {
        // skip
    }
}

export async function getSfxSelection(): Promise<SfxSelection> {
    try {
        const val = await AsyncStorage.getItem(SFX_SELECTION_KEY);
        return val ? JSON.parse(val) : DEFAULT_SFX_SELECTION;
    } catch {
        return DEFAULT_SFX_SELECTION;
    }
}

export async function setSfxSelection(selection: SfxSelection): Promise<void> {
    try {
        await AsyncStorage.setItem(
            SFX_SELECTION_KEY,
            JSON.stringify(selection),
        );
    } catch {
        // skip
    }
}

export async function getSfxVolume(): Promise<number> {
    try {
        const val = await AsyncStorage.getItem(SFX_VOLUME_KEY);
        return val === null ? 0.5 : parseFloat(val); // default 50%
    } catch {
        return 0.5;
    }
}

export async function setSfxVolume(volume: number): Promise<void> {
    try {
        await AsyncStorage.setItem(SFX_VOLUME_KEY, String(volume));
    } catch {
        // skip
    }
}

export async function getCachedLevel(
    id: number,
    version: number,
): Promise<object | null> {
    try {
        const val = await AsyncStorage.getItem(
            `${LEVEL_CACHE_PREFIX}v${version}_${id}`,
        );
        return val ? JSON.parse(val) : null;
    } catch {
        return null;
    }
}

export async function setCachedLevel(
    id: number,
    version: number,
    data: object,
): Promise<void> {
    try {
        await AsyncStorage.setItem(
            `${LEVEL_CACHE_PREFIX}v${version}_${id}`,
            JSON.stringify(data),
        );
    } catch {
        // skip
    }
}

async function readCompletedLevels(): Promise<CompletionRecord[]> {
    const val = await AsyncStorage.getItem(COMPLETED_LEVELS_KEY);
    const records = val ? JSON.parse(val) : [];
    if (!Array.isArray(records))
        throw new Error("Saved completion records are invalid");
    return records;
}

export async function getCompletedLevels(): Promise<CompletionRecord[]> {
    try {
        return await readCompletedLevels();
    } catch {
        return [];
    }
}

export async function saveCompletedLevel(
    record: CompletionRecord,
): Promise<void> {
    return serializeProgressWrite(async () => {
        // Freeze legacy identity migration before inserting the current win;
        // otherwise its later achievement callback can mistake it for a replay.
        const rawStats = await AsyncStorage.getItem(STATS_KEY);
        const storedStats = rawStats ? JSON.parse(rawStats) : null;
        if (!Array.isArray(storedStats?.completedCampaignLevelIds)) {
            await AsyncStorage.setItem(
                STATS_KEY,
                JSON.stringify(await readUserStats()),
            );
        }
        // Mutations use strict readers: a transient read failure must never erase
        // existing history by turning it into an empty result.
        const existing = await readCompletedLevels();
        await AsyncStorage.setItem(
            COMPLETED_LEVELS_KEY,
            JSON.stringify(mergeCompletionRecords(existing, record)),
        );
    });
}

export async function getLeaderboardUsername(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(LEADERBOARD_USERNAME_KEY);
    } catch {
        return null;
    }
}

export async function setLeaderboardUsername(username: string): Promise<void> {
    try {
        await AsyncStorage.setItem(LEADERBOARD_USERNAME_KEY, username);
    } catch {
        // skip
    }
}

const LEVEL_DRAFT_KEY = "@level_draft";

export interface LevelDraft {
    gridCols: number;
    gridRows: number;
    arrows: any[];
}

export async function getLevelDraft(): Promise<LevelDraft | null> {
    try {
        const val = await AsyncStorage.getItem(LEVEL_DRAFT_KEY);
        return val ? JSON.parse(val) : null;
    } catch {
        return null;
    }
}

export async function saveLevelDraft(draft: LevelDraft | null): Promise<void> {
    try {
        if (draft) {
            await AsyncStorage.setItem(LEVEL_DRAFT_KEY, JSON.stringify(draft));
        } else {
            await AsyncStorage.removeItem(LEVEL_DRAFT_KEY);
        }
    } catch {
        // skip
    }
}

// --- Progression & Currency ---

export async function getArrowsBalance(): Promise<number> {
    try {
        const val = await AsyncStorage.getItem(ARROWS_BALANCE_KEY);
        return val ? parseInt(val, 10) : 0;
    } catch {
        return 0;
    }
}

export async function addArrows(amount: number): Promise<number> {
    try {
        const current = await getArrowsBalance();
        const newBalance = Math.max(0, current + amount);
        await AsyncStorage.setItem(ARROWS_BALANCE_KEY, newBalance.toString());
        return newBalance;
    } catch {
        return 0;
    }
}

async function readUserStats(): Promise<UserStats> {
    const val = await AsyncStorage.getItem(STATS_KEY);
    const stored = val ? JSON.parse(val) : null;
    if (
        stored !== null &&
        (typeof stored !== "object" || Array.isArray(stored))
    ) {
        throw new Error("Saved progression is invalid");
    }
    // Once IDs are tracked, do not infer new wins from results written before
    // the completion callback. This keeps first-completion detection reliable.
    if (stored?.completedCampaignLevelIds) return normalizeUserStats(stored);
    const [completions, unlocked] = await Promise.all([
        readCompletedLevels(),
        readUnlockedLevel(),
    ]);
    return normalizeUserStats(stored, completions, unlocked);
}

export async function getUserStats(): Promise<UserStats> {
    try {
        return await readUserStats();
    } catch {
        return normalizeUserStats(null);
    }
}

export async function updateUserStats(
    updates: Partial<UserStats>,
): Promise<UserStats> {
    return serializeProgressWrite(async () => {
        try {
            const current = await getUserStats();
            const next = { ...current, ...updates };
            await AsyncStorage.setItem(STATS_KEY, JSON.stringify(next));
            return next;
        } catch {
            return normalizeUserStats(null);
        }
    });
}

/** Uses the server document ID for community levels, never the preview route's 0. */
export async function recordLevelCompletion(
    identity: LevelCompletionIdentity,
): Promise<{ stats: UserStats; isFirstCompletion: boolean }> {
    return serializeProgressWrite(async () => {
        const current = await readUserStats();
        const result = applyLevelCompletion(current, identity);
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(result.stats));
        return result;
    });
}

export async function getUnlockedAchievements(): Promise<string[]> {
    try {
        const val = await AsyncStorage.getItem(UNLOCKED_ACHIEVEMENTS_KEY);
        return val ? JSON.parse(val) : [];
    } catch {
        return [];
    }
}

export async function unlockAchievement(achievementId: string): Promise<void> {
    try {
        const current = await getUnlockedAchievements();
        if (!current.includes(achievementId)) {
            current.push(achievementId);
            await AsyncStorage.setItem(
                UNLOCKED_ACHIEVEMENTS_KEY,
                JSON.stringify(current),
            );
        }
    } catch {
        // skip
    }
}

// --- Customizations ---

export interface ActiveCustomization {
    arrowStyleId: string | null;
    boardThemeId: string | null;
    confettiId: string | null;
}

const DEFAULT_CUSTOMIZATION: ActiveCustomization = {
    arrowStyleId: null,
    boardThemeId: null,
    confettiId: null,
};

export async function getActiveCustomization(): Promise<ActiveCustomization> {
    try {
        const val = await AsyncStorage.getItem(ACTIVE_CUSTOMIZATION_KEY);
        return val ? JSON.parse(val) : DEFAULT_CUSTOMIZATION;
    } catch {
        return DEFAULT_CUSTOMIZATION;
    }
}

export async function setActiveCustomization(
    updates: Partial<ActiveCustomization>,
): Promise<void> {
    try {
        const current = await getActiveCustomization();
        const next = { ...current, ...updates };
        await AsyncStorage.setItem(
            ACTIVE_CUSTOMIZATION_KEY,
            JSON.stringify(next),
        );
    } catch {
        // skip
    }
}

export async function getUnlockedItems(): Promise<string[]> {
    try {
        const val = await AsyncStorage.getItem(UNLOCKED_ITEMS_KEY);
        return val ? JSON.parse(val) : [];
    } catch {
        return [];
    }
}

export async function unlockItem(itemId: string): Promise<void> {
    try {
        const current = await getUnlockedItems();
        if (!current.includes(itemId)) {
            current.push(itemId);
            await AsyncStorage.setItem(
                UNLOCKED_ITEMS_KEY,
                JSON.stringify(current),
            );
        }
    } catch {
        // skip
    }
}
