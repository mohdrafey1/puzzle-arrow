import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import {
    getHapticsEnabled,
    resetProgress,
    setHapticsEnabled,
    setThemePreference,
} from "../../utils/storage";

export default function MeSettings() {
    const { colorScheme, setColorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const [hapticsOn, setHapticsOn] = useState(true);
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            getHapticsEnabled().then(setHapticsOn);
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

    return (
        <View className="flex-1 bg-gray-100 dark:bg-gray-900 p-6 pt-16">
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

            <Text className="text-center text-gray-400 text-sm font-medium uppercase tracking-widest">
                Puzzle Arrow
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-1">
                Version 1.0.0
            </Text>
        </View>
    );
}
