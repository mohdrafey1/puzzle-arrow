import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
        </View>
    );
}
