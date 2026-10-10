import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    Linking,
    Pressable,
    ScrollView,
    Share,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BannerAdWidget } from "../../components/BannerAdWidget";
import {
    CAMPAIGN_VERSION,
    getDifficultyProfile,
} from "../../constants/levelDifficulty";
import {
    getDailyChallenge,
    getDailyProgress,
    getDailyRecord,
} from "../../utils/dailyChallenge";
import { getCompletedLevels, getUnlockedLevel } from "../../utils/storage";

export default function Home() {
    const router = useRouter();
    const [unlocked, setUnlocked] = useState(1);
    const [perfects, setPerfects] = useState(0);
    const [daily, setDaily] = useState(() => getDailyChallenge());
    const [dailyDone, setDailyDone] = useState(false);
    const [streak, setStreak] = useState(0);
    useFocusEffect(
        useCallback(() => {
            let active = true;
            const refresh = async () => {
                const today = getDailyChallenge();
                const [level, records, progress, record] = await Promise.all([
                    getUnlockedLevel(),
                    getCompletedLevels(),
                    getDailyProgress(),
                    getDailyRecord(today.dateKey),
                ]);
                if (!active) return;
                setUnlocked(level);
                setDaily(today);
                setDailyDone(!!record);
                setStreak(progress.currentStreak);
                setPerfects(
                    records.filter(
                        (r) =>
                            (r.version || 1) === CAMPAIGN_VERSION &&
                            r.stars === 3,
                    ).length,
                );
            };
            void refresh().catch(() => undefined);
            const interval = setInterval(() => {
                void refresh().catch(() => undefined);
            }, 60000);
            return () => {
                active = false;
                clearInterval(interval);
            };
        }, []),
    );
    const profile = getDifficultyProfile(unlocked);
    const chapterStart = (profile.chapter - 1) * 40 + 1;
    const chapterProgress = (unlocked - chapterStart) / 40;
    const share = async () => {
        try {
            await Share.share({
                message: `I'm on level ${unlocked} in Puzzle Arrow. Find a clear path and untangle the board: https://play.google.com/store/apps/details?id=com.mohdrafey1.puzzlearrow`,
                title: "Puzzle Arrow",
            });
        } catch {
            /* Share cancelled. */
        }
    };
    const playDaily = () => {
        const today = getDailyChallenge();
        router.push({
            pathname: "/game/[level]",
            params: {
                level: String(today.levelId),
                source: "daily",
                date: today.dateKey,
            },
        });
    };
    return (
        <SafeAreaView
            edges={["top"]}
            className="flex-1 bg-gray-50 dark:bg-gray-900"
        >
            <ScrollView
                contentContainerStyle={{
                    padding: 24,
                    paddingBottom: 32,
                    width: "100%",
                    maxWidth: 620,
                    alignSelf: "center",
                }}
                showsVerticalScrollIndicator={false}
            >
                <View className="flex-row items-center justify-between mb-7 mt-3">
                    <View>
                        <Text className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-1">
                            A little focus. A clear path.
                        </Text>
                        <Text className="text-3xl font-black text-gray-900 dark:text-white">
                            Puzzle Arrow
                        </Text>
                    </View>
                    <View className="w-11 h-11 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl items-center justify-center">
                        <Ionicons
                            name="navigate-outline"
                            size={23}
                            color="#6366F1"
                        />
                    </View>
                </View>
                <View className="rounded-[28px] bg-indigo-600 p-6 overflow-hidden">
                    <View
                        style={{
                            position: "absolute",
                            right: -18,
                            top: 18,
                            opacity: 0.17,
                        }}
                    >
                        <Svg width={160} height={175} viewBox="0 0 160 175">
                            <Path
                                d="M20 145 L20 75 L75 75 L75 25 M60 40 L75 25 L90 40 M45 155 L135 155 L135 100 L105 100 M118 87 L105 100 L118 113"
                                stroke="white"
                                strokeWidth={9}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        </Svg>
                    </View>
                    <View className="flex-row items-center justify-between">
                        <Text className="text-indigo-100 font-bold text-xs uppercase tracking-widest">
                            Your journey · Chapter {profile.chapter}
                        </Text>
                        <Text className="text-indigo-100 text-xs font-semibold">
                            {profile.kind === "challenge"
                                ? "Checkpoint"
                                : profile.label}
                        </Text>
                    </View>
                    <Text className="text-white text-5xl font-black mt-5 mb-2">
                        Level {unlocked}
                    </Text>
                    <Text className="text-indigo-100 text-sm leading-5 pr-14 mb-5">
                        {profile.title}. Take your time and find the next
                        opening.
                    </Text>
                    <View className="h-1.5 bg-indigo-400/50 rounded-full overflow-hidden mb-2">
                        <View
                            style={{
                                height: "100%",
                                width: `${chapterProgress * 100}%`,
                                backgroundColor: "#C7D2FE",
                            }}
                        />
                    </View>
                    <Text className="text-indigo-100 text-xs mb-6">
                        {unlocked - chapterStart} of 40 levels cleared in this
                        chapter
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Continue level ${unlocked}`}
                        onPress={() => router.push(`/game/${unlocked}`)}
                        className="min-h-[56px] py-4 bg-white rounded-2xl flex-row items-center justify-center gap-3 active:bg-indigo-50"
                    >
                        <Text className="text-indigo-700 text-lg font-black">
                            Continue
                        </Text>
                        <Ionicons
                            name="arrow-forward"
                            color="#4338CA"
                            size={22}
                        />
                    </Pressable>
                </View>
                <View className="flex-row gap-3 my-4">
                    <View className="flex-1 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
                        <Text className="text-2xl font-black text-gray-900 dark:text-white">
                            {perfects}
                        </Text>
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Perfect clears
                        </Text>
                    </View>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="View completed levels"
                        onPress={() => router.push("/completed-levels")}
                        className="flex-1 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 flex-row items-center justify-between"
                    >
                        <View>
                            <Text className="text-sm font-bold text-gray-900 dark:text-white">
                                Your clears
                            </Text>
                            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Replay & improve
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            color="#64748B"
                            size={18}
                        />
                    </Pressable>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                        dailyDone
                            ? "Replay daily challenge"
                            : "Play daily challenge"
                    }
                    onPress={playDaily}
                    className="rounded-3xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-5 mb-4"
                >
                    <View className="flex-row items-center gap-3">
                        <View className="h-11 w-11 rounded-2xl bg-amber-100 dark:bg-amber-900/40 items-center justify-center">
                            <Ionicons
                                name={
                                    dailyDone
                                        ? "checkmark-circle"
                                        : "sunny-outline"
                                }
                                size={24}
                                color="#B45309"
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="font-black text-lg text-gray-900 dark:text-white">
                                Daily challenge
                            </Text>
                            <Text className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                                {new Date(
                                    `${daily.dateKey}T12:00:00Z`,
                                ).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    timeZone: "UTC",
                                })}{" "}
                                ·{" "}
                                {dailyDone
                                    ? "Cleared today"
                                    : "Today’s shared puzzle"}
                                {streak > 0 ? ` · ${streak} day streak` : ""}
                            </Text>
                        </View>
                        <Ionicons
                            name="arrow-forward"
                            size={20}
                            color="#B45309"
                        />
                    </View>
                    <Text className="text-sm leading-5 text-gray-600 dark:text-gray-300 mt-3">
                        A tougher pick from the campaign. Available offline,
                        with a new selection every day.
                    </Text>
                    <Text className="text-xs text-amber-800 dark:text-amber-300 mt-3">
                        Next puzzle at{" "}
                        {daily.nextResetAt.toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                        })}
                    </Text>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/daily")}
                    className="rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 flex-row items-center gap-3"
                >
                    <Ionicons name="people-outline" size={25} color="#6366F1" />
                    <View className="flex-1">
                        <Text className="font-bold text-base text-gray-900 dark:text-white">
                            Made by the community
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Play, create, and share new puzzles.
                        </Text>
                    </View>
                    <Ionicons
                        name="chevron-forward"
                        size={19}
                        color="#94A3B8"
                    />
                </Pressable>
                <View className="flex-row justify-center gap-5 mt-5 mb-3">
                    <Pressable
                        accessibilityRole="button"
                        onPress={share}
                        className="min-h-[44px] justify-center"
                    >
                        <Text className="text-sm text-gray-500 dark:text-gray-400">
                            Share the game
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="link"
                        onPress={() =>
                            Linking.openURL(
                                "https://play.google.com/store/apps/details?id=com.mohdrafey1.puzzlearrow&showAllReviews=true",
                            )
                        }
                        className="min-h-[44px] justify-center"
                    >
                        <Text className="text-sm text-gray-500 dark:text-gray-400">
                            Rate Puzzle Arrow
                        </Text>
                    </Pressable>
                </View>
                <BannerAdWidget />
            </ScrollView>
        </SafeAreaView>
    );
}
