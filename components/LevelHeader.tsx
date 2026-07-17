import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { formatTime } from "../utils/format";
import { HeartsBar } from "./HeartsBar";

interface LevelHeaderProps {
    levelId: number;
    levelLabel?: string;
    hearts: number;
    elapsedSeconds: number;
    arrowsRemaining: number;
}

export function LevelHeader({
    levelId,
    levelLabel,
    hearts,
    elapsedSeconds,
    arrowsRemaining,
}: LevelHeaderProps) {
    const router = useRouter();
    const { colorScheme } = useColorScheme();

    const isDark = colorScheme === "dark";

    return (
        <View className="flex-row items-center justify-between w-full px-2 py-2 mb-2">
            {/* Left: back + level */}
            <View className="flex-row items-center gap-3 flex-1">
                <Pressable
                    onPress={() =>
                        router.canGoBack() ? router.back() : router.replace("/")
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    hitSlop={8}
                    className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 items-center justify-center"
                >
                    <Ionicons
                        name="chevron-back"
                        size={22}
                        color={isDark ? "#F9FAFB" : "#111827"}
                    />
                </Pressable>

                <View>
                    <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        LEVEL
                    </Text>
                    <View className="flex-row items-center gap-2">
                        <Text
                            numberOfLines={1}
                            className="text-xl font-black text-gray-900 dark:text-gray-100 leading-tight"
                        >
                            {levelLabel || levelId}
                        </Text>
                        <View className="bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                            <Text className="text-xs font-bold text-indigo-500">
                                🏹 {arrowsRemaining}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Center: Timer */}
            <View className="items-center px-2">
                <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    TIME
                </Text>
                <Text className="text-xl font-black text-indigo-500 leading-tight">
                    {formatTime(elapsedSeconds)}
                </Text>
            </View>

            {/* Right: hearts */}
            <View className="flex-1 items-end">
                <HeartsBar hearts={hearts} />
            </View>
        </View>
    );
}
