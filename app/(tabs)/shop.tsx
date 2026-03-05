import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import {
    ARROW_COLORS,
    BOARD_THEMES,
    CONFETTI_STYLES,
    CustomizationItem,
    CustomizationType,
    DEFAULT_UNLOCKED_ITEMS,
} from "../../utils/customizations";
import {
    ActiveCustomization,
    addArrows,
    getActiveCustomization,
    getArrowsBalance,
    getUnlockedItems,
    setActiveCustomization,
    unlockItem,
} from "../../utils/storage";

export default function ShopScreen() {
    const router = useRouter();
    const [balance, setBalance] = useState(0);
    const [unlocked, setUnlocked] = useState<string[]>([]);
    const [active, setActive] = useState<ActiveCustomization>({
        arrowStyleId: null,
        boardThemeId: null,
        confettiId: null,
    });
    const [activeTab, setActiveTab] = useState<CustomizationType>("arrowColor");

    const loadData = async () => {
        const bal = await getArrowsBalance();
        const unl = await getUnlockedItems();
        const act = await getActiveCustomization();

        // Merge defaults
        const allUnlocked = Array.from(
            new Set([...unl, ...DEFAULT_UNLOCKED_ITEMS]),
        );

        setBalance(bal);
        setUnlocked(allUnlocked);
        setActive(act);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, []),
    );

    const handlePurchase = (item: CustomizationItem) => {
        if (unlocked.includes(item.id)) return;

        if (balance < item.price) {
            Alert.alert(
                "Not enough arrows",
                "Play more levels to earn arrows!",
            );
            return;
        }

        Alert.alert(
            "Purchase Item",
            `Unlock ${item.name} for ${item.price} Arrows?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unlock",
                    style: "default",
                    onPress: async () => {
                        await addArrows(-item.price);
                        await unlockItem(item.id);
                        loadData();
                    },
                },
            ],
        );
    };

    const handleEquip = async (item: CustomizationItem) => {
        if (!unlocked.includes(item.id)) return;

        const updates: Partial<ActiveCustomization> = {};
        if (item.type === "arrowColor") updates.arrowStyleId = item.id;
        if (item.type === "boardTheme") updates.boardThemeId = item.id;
        if (item.type === "confettiStyle") updates.confettiId = item.id;

        await setActiveCustomization(updates);
        loadData();
    };

    const renderItemCard = (item: CustomizationItem) => {
        const isUnlocked = unlocked.includes(item.id);
        const isEquipped =
            (item.type === "arrowColor" && active.arrowStyleId === item.id) ||
            (item.type === "boardTheme" && active.boardThemeId === item.id) ||
            (item.type === "confettiStyle" && active.confettiId === item.id) ||
            (item.type === "arrowColor" &&
                active.arrowStyleId === null &&
                item.id === "arrow_blue") ||
            (item.type === "boardTheme" &&
                active.boardThemeId === null &&
                item.id === "theme_default") ||
            (item.type === "confettiStyle" &&
                active.confettiId === null &&
                item.id === "confetti_default");

        return (
            <View
                key={item.id}
                className={`bg-white dark:bg-gray-800 rounded-3xl p-5 mb-4 shadow-sm border ${
                    isEquipped
                        ? "border-indigo-500"
                        : "border-gray-100 dark:border-gray-700"
                } flex-row items-center justify-between`}
            >
                <View className="flex-row items-center gap-4">
                    <View
                        className="w-12 h-12 rounded-2xl items-center justify-center border border-gray-200 dark:border-gray-600"
                        style={
                            item.type === "arrowColor"
                                ? { backgroundColor: item.value }
                                : item.type === "boardTheme"
                                  ? {
                                        backgroundColor:
                                            item.value === "ocean"
                                                ? "#0891b2" // cyan-600
                                                : item.value === "forest"
                                                  ? "#059669" // emerald-600
                                                  : item.value === "midnight"
                                                    ? "#0f172a" // slate-900
                                                    : "#f3f4f6", // default
                                    }
                                  : { backgroundColor: "#f3f4f6" } // placeholder for confetti
                        }
                    >
                        {item.type !== "arrowColor" && (
                            <Ionicons
                                name={
                                    item.type === "boardTheme"
                                        ? "grid"
                                        : "sparkles"
                                }
                                size={24}
                                color={
                                    item.type === "boardTheme" &&
                                    item.value === "midnight"
                                        ? "#cbd5e1"
                                        : "#6b7280"
                                }
                            />
                        )}
                    </View>
                    <View>
                        <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {item.name}
                        </Text>
                        {!isUnlocked ? (
                            <View className="flex-row items-center gap-1 mt-1">
                                <Text className="text-indigo-500 font-bold text-sm">
                                    {item.price}
                                </Text>
                                <Ionicons
                                    name="arrow-up"
                                    size={12}
                                    color="#6366f1"
                                />
                            </View>
                        ) : (
                            <Text className="text-green-500 font-bold text-sm mt-1">
                                Unlocked
                            </Text>
                        )}
                    </View>
                </View>

                {isEquipped ? (
                    <View className="bg-indigo-100 dark:bg-indigo-900/40 px-4 py-2 rounded-full">
                        <Text className="text-indigo-600 dark:text-indigo-400 font-bold">
                            Equipped
                        </Text>
                    </View>
                ) : isUnlocked ? (
                    <Pressable
                        onPress={() => handleEquip(item)}
                        className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-full active:bg-gray-200 dark:active:bg-gray-600 border border-gray-200 dark:border-gray-600"
                    >
                        <Text className="text-gray-700 dark:text-gray-300 font-bold">
                            Equip
                        </Text>
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={() => handlePurchase(item)}
                        className={`px-4 py-2 rounded-full active:opacity-80 flex-row items-center gap-1 ${
                            balance >= item.price
                                ? "bg-indigo-500"
                                : "bg-gray-300 dark:bg-gray-700"
                        }`}
                    >
                        <Text className="text-white font-bold">Unlock</Text>
                    </Pressable>
                )}
            </View>
        );
    };

    const currentList =
        activeTab === "arrowColor"
            ? ARROW_COLORS
            : activeTab === "boardTheme"
              ? BOARD_THEMES
              : CONFETTI_STYLES;

    return (
        <View className="flex-1 bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <View className="pt-16 pb-4 px-6 bg-white dark:bg-gray-800 shadow-sm z-10">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-3xl font-black text-gray-900 dark:text-gray-100">
                        Shop
                    </Text>
                    <View className="bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border border-indigo-100 dark:border-indigo-800">
                        <Text className="text-indigo-600 dark:text-indigo-400 font-black text-lg">
                            {balance}
                        </Text>
                        <Ionicons name="arrow-up" size={16} color="#6366f1" />
                    </View>
                </View>

                {/* Tabs */}
                <View className="flex-row gap-2">
                    {[
                        {
                            id: "arrowColor",
                            label: "Arrows",
                            icon: "arrow-forward",
                        },
                        { id: "boardTheme", label: "Boards", icon: "grid" },
                        {
                            id: "confettiStyle",
                            label: "Confetti",
                            icon: "sparkles",
                        },
                    ].map((tab) => (
                        <Pressable
                            key={tab.id}
                            onPress={() =>
                                setActiveTab(tab.id as CustomizationType)
                            }
                            className={`flex-1 flex-row justify-center items-center gap-1.5 py-3 rounded-xl border ${
                                activeTab === tab.id
                                    ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500"
                                    : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                            }`}
                        >
                            <Ionicons
                                name={tab.icon as any}
                                size={16}
                                color={
                                    activeTab === tab.id ? "#6366f1" : "#6b7280"
                                }
                            />
                            <Text
                                className={`font-bold ${
                                    activeTab === tab.id
                                        ? "text-indigo-600 dark:text-indigo-400"
                                        : "text-gray-500 dark:text-gray-400"
                                }`}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* Earn Arrows Banner */}
            <Pressable
                onPress={() => router.push("/achievements")}
                className="mx-6 mt-4 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 rounded-2xl flex-row items-center justify-between border border-indigo-100 dark:border-indigo-800 active:opacity-80"
            >
                <View className="flex-row items-center gap-3">
                    <Ionicons name="trophy" size={24} color="#6366f1" />
                    <View>
                        <Text className="font-bold text-indigo-900 dark:text-indigo-100">
                            How to earn arrows?
                        </Text>
                        <Text className="text-xs text-indigo-600 dark:text-indigo-400">
                            View Achievements
                        </Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6366f1" />
            </Pressable>

            {/* List */}
            <ScrollView
                className="flex-1 p-6"
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {currentList.map(renderItemCard)}
            </ScrollView>
        </View>
    );
}
