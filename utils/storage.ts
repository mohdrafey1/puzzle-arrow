import AsyncStorage from "@react-native-async-storage/async-storage";

const UNLOCKED_LEVEL_KEY = "@unlocked_level";
const THEME_KEY = "@app_theme";
const HAPTICS_KEY = "@haptics_enabled";
const SFX_ENABLED_KEY = "@sfx_enabled";
const SFX_SELECTION_KEY = "@sfx_selection";
const SFX_VOLUME_KEY = "@sfx_volume";
const LEVEL_CACHE_PREFIX = "@level_cache_";
const COMPLETED_LEVELS_KEY = "@completed_levels";
const LEADERBOARD_USERNAME_KEY = "@leaderboard_username";

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
        await AsyncStorage.removeItem(UNLOCKED_LEVEL_KEY);
        await AsyncStorage.removeItem(COMPLETED_LEVELS_KEY);
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
