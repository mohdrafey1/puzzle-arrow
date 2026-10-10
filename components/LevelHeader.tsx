import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
    onHelp?: () => void;
}
export function LevelHeader({
    levelId,
    levelLabel,
    hearts,
    elapsedSeconds,
    arrowsRemaining,
    onHelp,
}: LevelHeaderProps) {
    const router = useRouter();
    return (
        <View className="w-full pb-3">
            <View className="flex-row items-center justify-between">
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    onPress={() =>
                        router.canGoBack() ? router.back() : router.replace("/")
                    }
                    className="w-11 h-11 rounded-2xl bg-white dark:bg-gray-800 items-center justify-center border border-gray-200 dark:border-gray-700"
                >
                    <Ionicons name="chevron-back" size={22} color="#64748B" />
                </Pressable>
                <Text
                    accessibilityRole="header"
                    className="text-xl font-black text-gray-900 dark:text-gray-100"
                >
                    {levelLabel || `Level ${levelId}`}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="How to play"
                    onPress={onHelp}
                    className="w-11 h-11 items-center justify-center"
                >
                    <Ionicons
                        name="help-circle-outline"
                        size={26}
                        color="#64748B"
                    />
                </Pressable>
            </View>
            <View className="flex-row items-center justify-between pt-2">
                <Text
                    accessibilityLiveRegion="polite"
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400"
                >
                    {arrowsRemaining} arrows left
                </Text>
                <View className="flex-row items-center gap-1">
                    <Ionicons name="time-outline" size={14} color="#94A3B8" />
                    <Text
                        testID="elapsed-time"
                        className="text-xs font-semibold text-gray-500 dark:text-gray-400"
                    >
                        {formatTime(elapsedSeconds)}
                    </Text>
                </View>
                <HeartsBar hearts={hearts} />
            </View>
        </View>
    );
}
