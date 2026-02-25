import { Audio } from "expo-av";
import { useCallback, useEffect, useRef } from "react";
import {
    DEFAULT_SFX_SELECTION,
    getSfxEnabled,
    getSfxSelection,
    getSfxVolume,
    SfxSelection,
} from "../utils/storage";

type SfxType = "arrowout" | "gameover" | "gamewin";

/* Maps filename → require() so Metro can bundle them */
export const AUDIO_MAP: Record<string, any> = {
    // arrowout
    "default_swoosh.mp3": require("../assets/audios/arrowout/default_swoosh.mp3"),
    "pop.mp3": require("../assets/audios/arrowout/pop.mp3"),
    // gameover
    "default_boo.mp3": require("../assets/audios/gameover/default_boo.mp3"),
    "koshish_karna.m4a": require("../assets/audios/gameover/koshish_karna.m4a"),
    "libas_badlega.m4a": require("../assets/audios/gameover/libas_badlega.m4a"),
    // gamewin
    "clapping_default.m4a": require("../assets/audios/gamewin/clapping_default.m4a"),
    "sabash_beta.m4a": require("../assets/audios/gamewin/sabash_beta.m4a"),
    "well_done.m4a": require("../assets/audios/gamewin/well_done.m4a"),
};

export function useSfx() {
    const sfxEnabled = useRef(true);
    const selection = useRef<SfxSelection>(DEFAULT_SFX_SELECTION);
    const volume = useRef(0.5);
    const sounds = useRef<Partial<Record<SfxType, Audio.Sound>>>({});

    // Load preferences + preload sounds
    useEffect(() => {
        let cancelled = false;

        async function init() {
            const [enabled, sel, vol] = await Promise.all([
                getSfxEnabled(),
                getSfxSelection(),
                getSfxVolume(),
            ]);
            if (cancelled) return;

            sfxEnabled.current = enabled;
            selection.current = sel;
            volume.current = vol;

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
            });

            // Preload each category
            const categories: SfxType[] = ["arrowout", "gameover", "gamewin"];
            for (const cat of categories) {
                const file = sel[cat];
                const source = AUDIO_MAP[file];
                if (!source) continue;

                try {
                    const { sound } = await Audio.Sound.createAsync(source);
                    if (cancelled) {
                        sound.unloadAsync();
                        return;
                    }
                    sounds.current[cat] = sound;
                } catch {
                    // skip if audio fails to load
                }
            }
        }

        init();

        return () => {
            cancelled = true;
            // Unload all sounds
            Object.values(sounds.current).forEach((s) => s?.unloadAsync());
            sounds.current = {};
        };
    }, []);

    const playSfx = useCallback(async (type: SfxType) => {
        if (!sfxEnabled.current) return;
        if (selection.current[type] === "none") return;
        const sound = sounds.current[type];
        if (!sound) return;
        try {
            const vol = await getSfxVolume();
            await sound.setVolumeAsync(vol);
            await sound.setPositionAsync(0);
            await sound.playAsync();
        } catch {
            // skip
        }
    }, []);

    return { playSfx, sfxEnabled };
}
