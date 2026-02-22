import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { HeartsBar } from "./HeartsBar";

interface LevelHeaderProps {
    levelId: number;
    hearts: number;
    elapsedSeconds: number;
}

function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
}

export function LevelHeader({
    levelId,
    hearts,
    elapsedSeconds,
}: LevelHeaderProps) {
    const router = useRouter();

    return (
        <View className="flex-row items-center justify-between w-full px-2 py-2 mt-8 mb-2">
            <View className="flex-row items-center gap-3">
                <Pressable
                    onPress={() =>
                        router.canGoBack() ? router.back() : router.replace("/")
                    }
                    className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 items-center justify-center"
                >
                    <Ionicons
                        name="chevron-back"
                        size={22}
                        className="text-gray-900 dark:text-gray-100"
                    />
                </Pressable>

                <View>
                    <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        LEVEL
                    </Text>
                    <Text className="text-xl font-black text-gray-900 dark:text-gray-100 leading-tight">
                        {levelId}
                    </Text>
                </View>
            </View>

            {/* Center: Timer */}
            <View className="items-center absolute left-0 right-0 pointer-events-none">
                <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    TIME
                </Text>
                <Text className="text-xl font-black text-indigo-500 leading-tight">
                    {formatTime(elapsedSeconds)}
                </Text>
            </View>

            <HeartsBar hearts={hearts} />
        </View>
    );
}
