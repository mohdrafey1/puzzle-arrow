import AsyncStorage from "@react-native-async-storage/async-storage";
import { Direction, Point } from "./movement";

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

export interface CompletionRecord {
    levelId: number;
    time: number;
    heartsUsed: number;
    stars: number;
}

export async function getUnlockedLevel(): Promise<number> {
    try {
        const val = await AsyncStorage.getItem(UNLOCKED_LEVEL_KEY);
        return val ? parseInt(val, 10) : 1;
    } catch (e) {
        return 1;
    }
}

export async function setUnlockedLevel(level: number): Promise<void> {
    try {
        await AsyncStorage.setItem(UNLOCKED_LEVEL_KEY, level.toString());
    } catch (e) {
        // skip
    }
}

export async function getThemePreference(): Promise<ThemeType> {
    try {
        const val = await AsyncStorage.getItem(THEME_KEY);
        return (val as ThemeType) || "system";
    } catch (e) {
        return "system";
    }
}

export async function setThemePreference(theme: ThemeType): Promise<void> {
    try {
        await AsyncStorage.setItem(THEME_KEY, theme);
    } catch (e) {
        // skip
    }
}

export async function resetProgress(): Promise<void> {
    try {
        // Clear ALL player progress so "lose all your progress" is truthful.
        // Intentionally preserves device preferences (theme, haptics, sfx).
        await AsyncStorage.multiRemove([
            UNLOCKED_LEVEL_KEY,
            COMPLETED_LEVELS_KEY,
            STATS_KEY,
            UNLOCKED_ACHIEVEMENTS_KEY,
            ARROWS_BALANCE_KEY,
            ACTIVE_CUSTOMIZATION_KEY,
            UNLOCKED_ITEMS_KEY,
            LEVEL_DRAFT_KEY,
        ]);
    } catch (e) {
        // skip
    }
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

export async function getCompletedLevels(): Promise<CompletionRecord[]> {
    try {
        const val = await AsyncStorage.getItem(COMPLETED_LEVELS_KEY);
        return val ? JSON.parse(val) : [];
    } catch {
        return [];
    }
}

export async function saveCompletedLevel(
    record: CompletionRecord,
): Promise<void> {
    try {
        const existing = await getCompletedLevels();
        const idx = existing.findIndex((r) => r.levelId === record.levelId);
        if (idx >= 0) {
            // Keep the best run (shortest time)
            if (record.time < existing[idx].time) {
                existing[idx] = record;
            }
        } else {
            existing.push(record);
        }
        existing.sort((a, b) => a.levelId - b.levelId);
        await AsyncStorage.setItem(
            COMPLETED_LEVELS_KEY,
            JSON.stringify(existing),
        );
    } catch {
        // skip
    }
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

export async function clearLeaderboardUsername(): Promise<void> {
    try {
        await AsyncStorage.removeItem(LEADERBOARD_USERNAME_KEY);
    } catch {
        // skip
    }
}

const LEVEL_DRAFT_KEY = "@level_draft";

export interface DraftArrow {
    path: Point[];
    direction: Direction;
}

export interface LevelDraft {
    gridCols: number;
    gridRows: number;
    arrows: DraftArrow[];
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

export interface UserStats {
    levelsCompleted: number;
    communityLevelsBeaten: number;
    levelsCreated: number;
    completedCommunityLevelIds: string[];
}

const DEFAULT_STATS: UserStats = {
    levelsCompleted: 0,
    communityLevelsBeaten: 0,
    levelsCreated: 0,
    completedCommunityLevelIds: [],
};

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

export async function getUserStats(): Promise<UserStats> {
    try {
        const val = await AsyncStorage.getItem(STATS_KEY);
        return val ? JSON.parse(val) : DEFAULT_STATS;
    } catch {
        return DEFAULT_STATS;
    }
}

export async function updateUserStats(
    updates: Partial<UserStats>,
): Promise<UserStats> {
    try {
        const current = await getUserStats();
        const next = { ...current, ...updates };
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(next));
        return next;
    } catch {
        return DEFAULT_STATS;
    }
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

/**
 * Atomically debit arrows and unlock an item. Persists the new inventory
 * BEFORE debiting the balance, and only debits if the item was actually
 * added, so a mid-operation kill can never charge without granting the item.
 * Returns the new balance, or null if the purchase could not be completed.
 */
export async function purchaseItem(
    itemId: string,
    price: number,
): Promise<number | null> {
    try {
        const [balanceRaw, unlocked] = await Promise.all([
            getArrowsBalance(),
            getUnlockedItems(),
        ]);

        if (unlocked.includes(itemId)) return balanceRaw; // already owned
        if (balanceRaw < price) return null; // insufficient funds

        // Grant the item first…
        const nextUnlocked = [...unlocked, itemId];
        await AsyncStorage.setItem(
            UNLOCKED_ITEMS_KEY,
            JSON.stringify(nextUnlocked),
        );
        // …then debit. Worst case on crash: item granted, arrows not debited
        // (favours the player) rather than the reverse.
        const newBalance = Math.max(0, balanceRaw - price);
        await AsyncStorage.setItem(ARROWS_BALANCE_KEY, newBalance.toString());
        return newBalance;
    } catch {
        return null;
    }
}
