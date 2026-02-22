import AsyncStorage from "@react-native-async-storage/async-storage";

const UNLOCKED_LEVEL_KEY = "@unlocked_level";
const THEME_KEY = "@app_theme";
const HAPTICS_KEY = "@haptics_enabled";
const LEVEL_CACHE_PREFIX = "@level_cache_";
const COMPLETED_LEVELS_KEY = "@completed_levels";

export type ThemeType = "light" | "dark" | "system";

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
