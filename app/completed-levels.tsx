import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { CompletionRecord, getCompletedLevels } from "../utils/storage";

function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
}

function StarRow({ count }: { count: number }) {
    return (
        <Text className="text-lg">
            {Array.from({ length: 3 })
                .map((_, i) => (i < count ? "⭐" : "☆"))
                .join("")}
        </Text>
    );
}

export default function CompletedLevelsScreen() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const [records, setRecords] = useState<CompletionRecord[]>([]);

    useFocusEffect(
        useCallback(() => {
            getCompletedLevels().then(setRecords);
        }, []),
    );

    const renderItem = ({ item }: { item: CompletionRecord }) => (
        <View className="bg-white dark:bg-gray-800 rounded-2xl mb-3 p-4 flex-row items-center border border-gray-100 dark:border-gray-700">
            {/* Level badge */}
            <View className="bg-indigo-500 w-12 h-12 rounded-xl items-center justify-center mr-4">
                <Text className="text-white font-black text-lg">
                    {item.levelId}
                </Text>
            </View>

            {/* Stats */}
            <View className="flex-1">
                <StarRow count={item.stars} />
                <View className="flex-row items-center gap-4 mt-1">
                    <Text className="text-gray-500 dark:text-gray-400 text-sm">
                        🕐 {formatTime(item.time)}
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-sm">
                        ❤️ {item.heartsUsed} used
                    </Text>
                </View>
            </View>

            {/* Replay */}
            <Pressable
                onPress={() => router.push(`/game/${item.levelId}?replay=true`)}
                className="bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 w-10 h-10 rounded-xl items-center justify-center"
            >
                <Ionicons
                    name="reload"
                    size={18}
                    color={isDark ? "#D1D5DB" : "#4B5563"}
                />
            </Pressable>
        </View>
    );

    return (
        <View className="flex-1 bg-gray-100 dark:bg-gray-900 p-6 pt-16">
            {/* Header */}
            <View className="flex-row items-center mb-6">
                <Pressable
                    onPress={() => router.back()}
                    className="mr-3 w-10 h-10 rounded-xl bg-white dark:bg-gray-800 items-center justify-center border border-gray-100 dark:border-gray-700"
                >
                    <Ionicons
                        name="chevron-back"
                        size={22}
                        color={isDark ? "#F9FAFB" : "#111827"}
                    />
                </Pressable>
                <Text className="text-3xl font-black text-gray-900 dark:text-gray-100">
                    Completed Levels
                </Text>
            </View>

            {records.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                    <Ionicons
                        name="trophy-outline"
                        size={64}
                        color={isDark ? "#374151" : "#D1D5DB"}
                    />
                    <Text className="text-gray-400 dark:text-gray-600 text-lg mt-4 font-semibold">
                        No completed levels yet
                    </Text>
                    <Text className="text-gray-400 dark:text-gray-600 text-sm mt-1">
                        Go play some levels!
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={records}
                    keyExtractor={(item) => String(item.levelId)}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            )}
        </View>
    );
}
