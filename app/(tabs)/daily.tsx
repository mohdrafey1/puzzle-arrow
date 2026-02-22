import { Text, View } from "react-native";

export default function DailyChallenge() {
    return (
        <View className="flex-1 bg-gray-100 dark:bg-gray-900 items-center justify-center">
            <View className="items-center opacity-60">
                <Text className="text-5xl mb-4">🗓</Text>
                <Text className="text-xl font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
                    Coming Soon
                </Text>
                <Text className="text-sm font-medium text-gray-400 dark:text-gray-500 mt-2">
                    Daily generated challenges.
                </Text>
            </View>
        </View>
    );
}
