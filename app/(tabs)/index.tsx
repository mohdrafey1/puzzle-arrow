import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { BannerAdWidget } from "../../components/BannerAdWidget";
import { getUnlockedLevel } from "../../utils/storage";

export default function Home() {
    const [unlocked, setUnlocked] = useState(1);
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            let active = true;
            getUnlockedLevel().then((level) => {
                if (active) setUnlocked(level);
            });
            return () => {
                active = false;
            };
        }, []),
    );

    const shareApp = async () => {
        try {
            const message = `🎯 Check out Puzzle Arrow - the most addictive puzzle game! I've reached level ${unlocked}! Can you beat my score? Download now: https://play.google.com/store/apps/details?id=com.mohdrafey1.puzzlearrow`;

            await Share.share({
                message,
                title: "Share Puzzle Arrow",
            });
        } catch (error) {
            console.error("Error sharing app:", error);
        }
    };

    return (
        <View className="flex-1 bg-gray-100 dark:bg-gray-900 items-center justify-center p-6">
            <Text className="text-4xl font-black text-gray-900 dark:text-gray-100 mb-8 tracking-tight">
                Puzzle <Text className="text-blue-500">Arrow</Text>
            </Text>

            <View className="bg-white dark:bg-gray-800 p-8 rounded-3xl w-full max-w-sm items-center shadow-sm border border-gray-100 dark:border-gray-800">
                <Text className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">
                    Current Level
                </Text>
                <Text className="text-7xl font-black text-gray-900 dark:text-white mb-8">
                    {unlocked}
                </Text>

                <Pressable
                    className="bg-blue-500 active:bg-blue-600 w-full rounded-2xl py-4 items-center mb-2 shadow-md"
                    onPress={() => router.push(`/game/${unlocked}`)}
                >
                    <Text className="text-white text-xl font-bold">
                        Continue
                    </Text>
                </Pressable>
            </View>

            {/* Community Banner */}
            <Pressable
                onPress={() => router.push("/daily")}
                className="mt-8 bg-indigo-50 dark:bg-indigo-900/40 w-full max-w-sm rounded-[24px] overflow-hidden border border-indigo-100 dark:border-indigo-800 active:opacity-80"
            >
                <View className="p-5 flex-row items-center gap-4">
                    <View className="w-12 h-12 bg-indigo-100 dark:bg-indigo-800/80 rounded-full items-center justify-center">
                        <Ionicons name="planet" size={24} color="#6366f1" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-indigo-900 dark:text-indigo-100 font-bold text-lg mb-0.5">
                            Play Community!
                        </Text>
                        <Text className="text-indigo-600 dark:text-indigo-300 text-sm leading-snug pr-2">
                            Discover thousands of unique and challenging levels
                            created by other players.
                        </Text>
                    </View>
                    <Ionicons
                        name="chevron-forward"
                        size={24}
                        color="#6366f1"
                    />
                </View>
            </Pressable>

            <Pressable
                className="mt-4 bg-green-500 active:bg-green-600 w-full max-w-sm rounded-2xl py-3 items-center shadow-md flex-row justify-center gap-2"
                onPress={shareApp}
            >
                <Ionicons name="share-social" size={20} color="white" />
                <Text className="text-white text-lg font-bold">
                    Share our App with Friends
                </Text>
            </Pressable>

            {/* Ad Banner */}
            <View className="absolute bottom-4 left-0 right-0">
                <BannerAdWidget />
            </View>
        </View>
    );
}
