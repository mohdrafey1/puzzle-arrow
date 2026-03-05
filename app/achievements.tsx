import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Achievement, ACHIEVEMENTS } from "../utils/achievements";
import {
    getUnlockedAchievements,
    getUserStats,
    UserStats,
} from "../utils/storage";

export default function AchievementsScreen() {
    const router = useRouter();
    const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
    const [stats, setStats] = useState<UserStats | null>(null);

    useEffect(() => {
        const load = async () => {
            const [unl, st] = await Promise.all([
                getUnlockedAchievements(),
                getUserStats(),
            ]);
            setUnlockedIds(unl);
            setStats(st);
        };
        load();
    }, []);

    const renderAchievementCard = (ach: Achievement) => {
        const isUnlocked = unlockedIds.includes(ach.id);

        let currentProgress = 0;
        if (stats) {
            if (ach.requiredStat === "completedCommunityLevelIds") {
                currentProgress = stats.completedCommunityLevelIds.length;
            } else {
                currentProgress = (stats[ach.requiredStat] as number) || 0;
            }
        }

        const progressClamped = Math.min(ach.requiredValue, currentProgress);
        const progressPercent = Math.round(
            (progressClamped / ach.requiredValue) * 100,
        );

        return (
            <View
                key={ach.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 shadow-sm border ${
                    isUnlocked
                        ? "border-green-500"
                        : "border-gray-200 dark:border-gray-700"
                } flex-row items-center gap-4`}
            >
                {/* Icon Circle */}
                <View
                    className={`w-14 h-14 rounded-full items-center justify-center ${
                        isUnlocked
                            ? "bg-green-100 dark:bg-green-900/40"
                            : "bg-gray-100 dark:bg-gray-700"
                    }`}
                >
                    <Ionicons
                        name={isUnlocked ? "trophy" : "lock-closed"}
                        size={28}
                        color={isUnlocked ? "#10B981" : "#9CA3AF"}
                    />
                </View>

                {/* Details */}
                <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {ach.title}
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {ach.description}
                    </Text>

                    {/* Progress Bar & Reward */}
                    <View className="mt-3 flex-row items-center justify-between">
                        <View className="flex-1 mr-4">
                            <View className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <View
                                    className={`h-full ${
                                        isUnlocked
                                            ? "bg-green-500"
                                            : "bg-indigo-500"
                                    }`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </View>
                            <Text className="text-xs text-gray-400 mt-1 font-medium">
                                {progressClamped} / {ach.requiredValue}
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-md">
                            <Text className="text-yellow-600 dark:text-yellow-400 font-bold text-xs font-mono">
                                +{ach.arrowReward}
                            </Text>
                            <Ionicons
                                name="arrow-up"
                                size={12}
                                color="#D97706"
                            />
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-gray-50 dark:bg-gray-900 pt-12">
            <Stack.Screen options={{ headerShown: false }} />
            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
                <View className="flex-row items-center gap-4">
                    <Pressable
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
                    >
                        <Ionicons name="arrow-back" size={24} color="#6B7280" />
                    </Pressable>
                    <Text className="text-2xl font-black text-gray-900 dark:text-gray-100">
                        Achievements
                    </Text>
                </View>
                <View className="bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                    <Text className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {unlockedIds.length} / {ACHIEVEMENTS.length}
                    </Text>
                </View>
            </View>

            {/* List */}
            <ScrollView
                className="flex-1 p-6"
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {ACHIEVEMENTS.map(renderAchievementCard)}
            </ScrollView>
        </View>
    );
}
