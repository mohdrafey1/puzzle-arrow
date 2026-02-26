import { Ionicons } from "@expo/vector-icons";
import { AudioPlayer, createAudioPlayer } from "expo-audio";
import { useFocusEffect, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { AUDIO_MAP } from "../../hooks/useSfx";
import {
    DEFAULT_SFX_SELECTION,
    getHapticsEnabled,
    getSfxEnabled,
    getSfxSelection,
    getSfxVolume,
    resetProgress,
    setHapticsEnabled,
    setSfxEnabled,
    setSfxSelection,
    setSfxVolume,
    setThemePreference,
    SfxSelection,
} from "../../utils/storage";

const SFX_OPTIONS: Record<
    keyof SfxSelection,
    { label: string; files: { name: string; label: string }[] }
> = {
    arrowout: {
        label: "Arrow Out",
        files: [
            { name: "none", label: "Off" },
            { name: "default_swoosh.mp3", label: "Swoosh" },
            { name: "pop.mp3", label: "Pop" },
        ],
    },
    gameover: {
        label: "Game Over",
        files: [
            { name: "none", label: "Off" },
            { name: "default_boo.mp3", label: "Boo" },
            { name: "koshish_karna.m4a", label: "Koshish Karna" },
            { name: "libas_badlega.m4a", label: "Libas Badlega" },
            { name: "chii_sasur.mp3", label: "Chii Sasur" },
        ],
    },
    gamewin: {
        label: "Game Win",
        files: [
            { name: "none", label: "Off" },
            { name: "clapping_default.m4a", label: "Clapping" },
            { name: "sabash_beta.m4a", label: "Sabash Beta" },
            { name: "well_done.m4a", label: "Well Done" },
        ],
    },
};

export default function MeSettings() {
    const { colorScheme, setColorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const [hapticsOn, setHapticsOn] = useState(true);
    const [sfxOn, setSfxOn] = useState(true);
    const [sfxSel, setSfxSel] = useState<SfxSelection>(DEFAULT_SFX_SELECTION);
    const [sfxVolume, setSfxVolumeState] = useState(0.5);
    const [testLevel, setTestLevel] = useState("");
    const router = useRouter();
    const activePreviewSound = useRef<AudioPlayer | null>(null);

    useFocusEffect(
        useCallback(() => {
            getHapticsEnabled().then(setHapticsOn);
            getSfxEnabled().then(setSfxOn);
            getSfxSelection().then(setSfxSel);
            getSfxVolume().then(setSfxVolumeState);
        }, []),
    );

    const handleReset = () => {
        Alert.alert(
            "Reset Progress",
            "Are you sure you want to lose all your progress?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                        await resetProgress();
                        Alert.alert("Done", "Progress reset to level 1");
                    },
                },
            ],
        );
    };

    const toggleTheme = (val: boolean) => {
        const next = val ? "dark" : "light";
        setColorScheme(next);
        setThemePreference(next);
    };

    const toggleHaptics = (val: boolean) => {
        setHapticsOn(val);
        setHapticsEnabled(val);
    };

    const toggleSfx = (val: boolean) => {
        setSfxOn(val);
        setSfxEnabled(val);
    };

    const updateSfxChoice = async (
        category: keyof SfxSelection,
        file: string,
    ) => {
        const next = { ...sfxSel, [category]: file };
        setSfxSel(next);
        setSfxSelection(next);

        // Play preview
        // Always stop any currently playing preview first
        if (activePreviewSound.current) {
            try {
                activePreviewSound.current.pause();
                activePreviewSound.current.remove();
            } catch {
                // ignore cleanup errors
            }
            activePreviewSound.current = null;
        }

        if (file !== "none") {
            try {
                const source = AUDIO_MAP[file];
                if (source) {
                    const player = createAudioPlayer(source);
                    activePreviewSound.current = player;
                    player.volume = sfxVolume;
                    player.play();
                }
            } catch {
                // skip preview on error
            }
        }
    };

    const adjustVolume = (delta: number) => {
        const next = Math.min(
            1,
            Math.max(0, Math.round((sfxVolume + delta) * 10) / 10),
        );
        setSfxVolumeState(next);
        setSfxVolume(next);
    };

    useEffect(() => {
        return () => {
            if (activePreviewSound.current) {
                activePreviewSound.current.pause();
                activePreviewSound.current.remove();
                activePreviewSound.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!sfxOn && activePreviewSound.current) {
            activePreviewSound.current.pause();
            activePreviewSound.current.remove();
            activePreviewSound.current = null;
        }
    }, [sfxOn]);

    return (
        <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900 p-6 pt-16">
            <Text className="text-3xl font-black text-gray-900 dark:text-gray-100 mb-8">
                Settings
            </Text>

            <View className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden mb-8 shadow-sm border border-gray-100 dark:border-gray-800">
                {/* Dark mode */}
                <View className="flex-row items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                    <View className="flex-row items-center gap-3">
                        <Ionicons
                            name="moon"
                            size={20}
                            className="text-gray-600 dark:text-gray-400"
                        />
                        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Dark Mode
                        </Text>
                    </View>
                    <Switch
                        value={isDark}
                        onValueChange={toggleTheme}
                        trackColor={{ false: "#E5E7EB", true: "#6366F1" }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {/* Haptics */}
                <View className="flex-row items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                    <View className="flex-row items-center gap-3">
                        <Ionicons
                            name="phone-portrait"
                            size={20}
                            className="text-gray-600 dark:text-gray-400"
                        />
                        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Haptics
                        </Text>
                    </View>
                    <Switch
                        value={hapticsOn}
                        onValueChange={toggleHaptics}
                        trackColor={{ false: "#E5E7EB", true: "#6366F1" }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {/* Sound Effects */}
                <View className="flex-row items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                    <View className="flex-row items-center gap-3">
                        <Ionicons
                            name="volume-high"
                            size={20}
                            className="text-gray-600 dark:text-gray-400"
                        />
                        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Sound Effects
                        </Text>
                    </View>
                    <Switch
                        value={sfxOn}
                        onValueChange={toggleSfx}
                        trackColor={{ false: "#E5E7EB", true: "#6366F1" }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {/* SFX Volume */}
                {sfxOn && (
                    <View className="flex-row items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                        <View className="flex-row items-center gap-3">
                            <Ionicons
                                name="options"
                                size={20}
                                className="text-gray-600 dark:text-gray-400"
                            />
                            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Volume
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <Pressable
                                onPress={() => adjustVolume(-0.1)}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center active:bg-gray-300 dark:active:bg-gray-600"
                            >
                                <Text className="text-gray-700 dark:text-gray-300 font-bold text-lg">
                                    −
                                </Text>
                            </Pressable>
                            <Text className="text-base font-bold text-indigo-500 w-12 text-center">
                                {Math.round(sfxVolume * 100)}%
                            </Text>
                            <Pressable
                                onPress={() => adjustVolume(0.1)}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center active:bg-gray-300 dark:active:bg-gray-600"
                            >
                                <Text className="text-gray-700 dark:text-gray-300 font-bold text-lg">
                                    +
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* Completed Levels */}
                <Pressable
                    onPress={() => router.push("/completed-levels")}
                    className="flex-row items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700"
                >
                    <View className="flex-row items-center gap-3">
                        <Ionicons name="trophy" size={20} color="#F59E0B" />
                        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Completed Levels
                        </Text>
                    </View>
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={isDark ? "#6B7280" : "#9CA3AF"}
                    />
                </Pressable>

                {/* Dev Level Jump */}
                <View className="flex-row items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20">
                    <View className="flex-row items-center gap-3">
                        <Ionicons name="construct" size={20} color="#6366F1" />
                        <Text className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">
                            Test Level
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <TextInput
                            value={testLevel}
                            onChangeText={setTestLevel}
                            keyboardType="number-pad"
                            placeholder="ID"
                            placeholderTextColor={
                                isDark ? "#9CA3AF" : "#6B7280"
                            }
                            className="bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 w-16 text-center"
                        />
                        <Pressable
                            onPress={() => {
                                const lvl = parseInt(testLevel, 10);
                                if (!isNaN(lvl) && lvl > 0) {
                                    router.push(`/game/${lvl}`);
                                    setTestLevel("");
                                }
                            }}
                            className="bg-indigo-500 px-3 py-1.5 rounded-lg active:bg-indigo-600"
                        >
                            <Text className="text-white font-bold">Go</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Reset */}
                <Pressable
                    onPress={handleReset}
                    className="flex-row items-center justify-between p-5 active:bg-gray-50 dark:active:bg-gray-700"
                >
                    <View className="flex-row items-center gap-3">
                        <Ionicons name="trash" size={20} color="#EF4444" />
                        <Text className="text-lg font-semibold text-red-500">
                            Reset Progress
                        </Text>
                    </View>
                </Pressable>
            </View>

            {/* Sound Selection */}
            {sfxOn && (
                <View className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden mb-8 shadow-sm border border-gray-100 dark:border-gray-800">
                    <View className="p-5 border-b border-gray-100 dark:border-gray-700">
                        <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                            🔊 Sound Selection
                        </Text>
                        <Text className="text-sm text-gray-400">
                            Choose sounds for each event
                        </Text>
                    </View>
                    {(Object.keys(SFX_OPTIONS) as (keyof SfxSelection)[]).map(
                        (category) => (
                            <View
                                key={category}
                                className="p-5 border-b border-gray-100 dark:border-gray-700"
                            >
                                <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                                    {SFX_OPTIONS[category].label}
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {SFX_OPTIONS[category].files.map((file) => {
                                        const isSelected =
                                            sfxSel[category] === file.name;
                                        return (
                                            <Pressable
                                                key={file.name}
                                                onPress={() =>
                                                    updateSfxChoice(
                                                        category,
                                                        file.name,
                                                    )
                                                }
                                                className={`px-4 py-2 rounded-full border ${
                                                    isSelected
                                                        ? "bg-indigo-500 border-indigo-500"
                                                        : "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                                                }`}
                                            >
                                                <Text
                                                    className={`text-sm font-semibold ${
                                                        isSelected
                                                            ? "text-white"
                                                            : "text-gray-700 dark:text-gray-300"
                                                    }`}
                                                >
                                                    {file.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        ),
                    )}
                </View>
            )}

            <Text className="text-center text-gray-400 text-sm font-medium uppercase tracking-widest">
                Puzzle Arrow
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-1 mb-8">
                Version 1.0.0
            </Text>
        </ScrollView>
    );
}
