import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View,
} from "react-native";
import {
    LeaderboardEntry,
    checkUsernameAvailable,
    fetchLeaderboard,
    fetchUserEntry,
    submitScore,
} from "../../utils/leaderboard";
import {
    getLeaderboardUsername,
    getUnlockedLevel,
    setLeaderboardUsername,
} from "../../utils/storage";

export default function LeaderboardScreen() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [username, setUsername] = useState<string | null>(null);
    const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);

    // Username modal state
    const [showModal, setShowModal] = useState(false);
    const [inputName, setInputName] = useState("");
    const [checking, setChecking] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const hasCheckedUsername = useRef(false);

    // Check connectivity
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setIsOffline(!state.isConnected);
        });
        return () => unsubscribe();
    }, []);

    // Load username and leaderboard on focus
    useFocusEffect(
        useCallback(() => {
            let active = true;

            async function init() {
                const savedName = await getLeaderboardUsername();

                if (active) {
                    setUsername(savedName);
                    if (!savedName && !hasCheckedUsername.current) {
                        hasCheckedUsername.current = true;
                        setShowModal(true);
                    }
                }

                try {
                    const data = await fetchLeaderboard();
                    if (active) setEntries(data);

                    if (savedName) {
                        const entry = await fetchUserEntry(savedName);
                        if (active) setUserEntry(entry);
                    }
                } catch {
                    // offline or error
                } finally {
                    if (active) setLoading(false);
                }
            }

            init();
            return () => {
                active = false;
            };
        }, []),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const data = await fetchLeaderboard();
            setEntries(data);
            if (username) {
                const entry = await fetchUserEntry(username);
                setUserEntry(entry);
            }
        } catch {
            // offline
        } finally {
            setRefreshing(false);
        }
    };

    const handleSubmitUsername = async () => {
        const trimmed = inputName.trim();
        if (trimmed.length < 3) {
            setErrorMsg("Username must be at least 3 characters");
            return;
        }
        if (trimmed.length > 15) {
            setErrorMsg("Username must be 15 characters or less");
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
            setErrorMsg("Only letters, numbers, and underscores");
            return;
        }

        setChecking(true);
        setErrorMsg("");

        try {
            const available = await checkUsernameAvailable(trimmed);
            if (!available) {
                setErrorMsg("Username is already taken");
                setChecking(false);
                return;
            }

            // Save username locally
            await setLeaderboardUsername(trimmed);
            setUsername(trimmed);

            // Submit current level
            const currentLevel = await getUnlockedLevel();
            await submitScore(trimmed, currentLevel);

            setShowModal(false);
            setInputName("");

            // Refresh leaderboard
            const data = await fetchLeaderboard();
            setEntries(data);
            const entry = await fetchUserEntry(trimmed);
            setUserEntry(entry);
        } catch {
            setErrorMsg("Network error. Please try again.");
        } finally {
            setChecking(false);
        }
    };

    const getRankStyle = (rank: number) => {
        if (rank === 1)
            return {
                bg: "bg-amber-100 dark:bg-amber-900/30",
                border: "border-amber-300 dark:border-amber-700",
                icon: "🥇",
                textColor: "text-amber-800 dark:text-amber-200",
            };
        if (rank === 2)
            return {
                bg: "bg-gray-100 dark:bg-gray-700/50",
                border: "border-gray-300 dark:border-gray-600",
                icon: "🥈",
                textColor: "text-gray-700 dark:text-gray-200",
            };
        if (rank === 3)
            return {
                bg: "bg-orange-50 dark:bg-orange-900/20",
                border: "border-orange-300 dark:border-orange-700",
                icon: "🥉",
                textColor: "text-orange-800 dark:text-orange-200",
            };
        return {
            bg: "bg-white dark:bg-gray-800",
            border: "border-gray-100 dark:border-gray-700",
            icon: "",
            textColor: "text-gray-600 dark:text-gray-400",
        };
    };

    // ── Offline Screen ──
    if (isOffline) {
        return (
            <View className="flex-1 bg-gray-100 dark:bg-gray-900 pt-16">
                <View className="flex-1 items-center justify-center p-6">
                    <View className="bg-white dark:bg-gray-800 p-8 rounded-3xl items-center shadow-sm border border-gray-100 dark:border-gray-700 max-w-sm w-full">
                        <View className="bg-red-100 dark:bg-red-900/30 p-5 rounded-full mb-6">
                            <Ionicons
                                name="cloud-offline"
                                size={48}
                                color="#EF4444"
                            />
                        </View>
                        <Text className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-3 text-center">
                            You are offline
                        </Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-center mb-6 leading-6">
                            Please check your internet connection and try again.
                        </Text>
                        <Pressable
                            onPress={async () => {
                                const state = await NetInfo.fetch();
                                if (state.isConnected) {
                                    setIsOffline(false);
                                    setLoading(true);
                                    try {
                                        const data = await fetchLeaderboard();
                                        setEntries(data);
                                        if (username) {
                                            const entry =
                                                await fetchUserEntry(username);
                                            setUserEntry(entry);
                                        }
                                    } catch {
                                        // still offline
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                            className="bg-blue-500 active:bg-blue-600 px-8 py-4 rounded-2xl w-full"
                        >
                            <Text className="text-white text-lg font-bold text-center">
                                Retry
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }

    // ── Loading Screen ──
    if (loading) {
        return (
            <View className="flex-1 bg-gray-100 dark:bg-gray-900 pt-16">
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator
                        size="large"
                        color={isDark ? "#818CF8" : "#6366F1"}
                    />
                    <Text className="text-gray-500 dark:text-gray-400 mt-4 font-medium">
                        Loading leaderboard...
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-100 dark:bg-gray-900 pt-16">
            {/* Header */}
            <View className="px-6 pb-4">
                <View className="flex-row items-center justify-between">
                    <Text className="text-3xl font-black text-gray-900 dark:text-gray-100">
                        Leaderboard
                    </Text>
                    {username && (
                        <View className="bg-indigo-100 dark:bg-indigo-900/30 px-4 py-2 rounded-full">
                            <Text className="text-indigo-600 dark:text-indigo-300 font-bold text-sm">
                                @{username}
                            </Text>
                        </View>
                    )}
                </View>
                {!username && (
                    <Pressable
                        onPress={() => setShowModal(true)}
                        className="mt-3 bg-indigo-500 active:bg-indigo-600 px-5 py-3 rounded-2xl flex-row items-center justify-center gap-2"
                    >
                        <Ionicons name="person-add" size={18} color="white" />
                        <Text className="text-white font-bold">
                            Set Username to Join
                        </Text>
                    </Pressable>
                )}
            </View>

            {/* Leaderboard List */}
            <FlatList
                data={entries}
                keyExtractor={(item) => item.username}
                contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingBottom: 24,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={isDark ? "#818CF8" : "#6366F1"}
                    />
                }
                ListEmptyComponent={
                    <View className="items-center py-16">
                        <Ionicons
                            name="trophy-outline"
                            size={64}
                            color={isDark ? "#4B5563" : "#D1D5DB"}
                        />
                        <Text className="text-gray-400 dark:text-gray-500 mt-4 text-lg font-semibold">
                            No entries yet
                        </Text>
                        <Text className="text-gray-400 dark:text-gray-600 mt-1 text-sm">
                            Be the first to join!
                        </Text>
                    </View>
                }
                renderItem={({ item, index }) => {
                    const rank = index + 1;
                    const style = getRankStyle(rank);
                    const isCurrentUser = item.username === username;

                    return (
                        <View
                            className={`flex-row items-center p-4 rounded-2xl mb-2 border ${style.bg} ${style.border} ${isCurrentUser ? "border-indigo-400 dark:border-indigo-500" : ""}`}
                        >
                            {/* Rank */}
                            <View className="w-12 items-center">
                                {style.icon ? (
                                    <Text className="text-2xl">
                                        {style.icon}
                                    </Text>
                                ) : (
                                    <Text
                                        className={`text-lg font-black ${style.textColor}`}
                                    >
                                        #{rank}
                                    </Text>
                                )}
                            </View>

                            {/* Username */}
                            <View className="flex-1 ml-3">
                                <View className="flex-row items-center gap-2">
                                    <Text
                                        className={`text-base font-bold ${isCurrentUser ? "text-indigo-600 dark:text-indigo-300" : "text-gray-900 dark:text-gray-100"}`}
                                    >
                                        {item.username}
                                    </Text>
                                    {isCurrentUser && (
                                        <View className="bg-indigo-500 px-2 py-0.5 rounded-md">
                                            <Text className="text-white text-xs font-bold">
                                                YOU
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Level */}
                            <View className="items-end">
                                <Text className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
                                    Level
                                </Text>
                                <Text className="text-xl font-black text-gray-900 dark:text-gray-100">
                                    {item.level}
                                </Text>
                            </View>
                        </View>
                    );
                }}
            />

            {/* Sticky "My Score" Footer if user not in top 100 */}
            {username &&
                userEntry &&
                !entries.some((e) => e.username === username) && (
                    <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 pb-8 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                        <View className="flex-row items-center justify-between mx-2">
                            <View className="flex-row items-center gap-3">
                                <View className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-xl">
                                    <Ionicons
                                        name="person"
                                        size={20}
                                        color="#6366F1"
                                    />
                                </View>
                                <View>
                                    <Text className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wide">
                                        Your Score
                                    </Text>
                                    <Text className="text-gray-900 dark:text-white font-black text-lg">
                                        @{username}
                                    </Text>
                                </View>
                            </View>
                            <View className="items-end bg-gray-50 dark:bg-gray-700/50 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700">
                                <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                                    Level
                                </Text>
                                <Text className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                    {userEntry.level}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

            {/* Username Modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowModal(false)}
            >
                <View
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                >
                    <View className="bg-white dark:bg-gray-800 mx-6 w-[85%] max-w-sm rounded-3xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
                        {/* Close button */}
                        <Pressable
                            onPress={() => setShowModal(false)}
                            className="absolute top-4 right-4 p-2"
                        >
                            <Ionicons
                                name="close"
                                size={24}
                                color={isDark ? "#9CA3AF" : "#6B7280"}
                            />
                        </Pressable>

                        <View className="items-center mb-6">
                            <View className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-full mb-4">
                                <Ionicons
                                    name="person"
                                    size={36}
                                    color="#6366F1"
                                />
                            </View>
                            <Text className="text-2xl font-black text-gray-900 dark:text-gray-100 text-center">
                                Choose Username
                            </Text>
                            <Text className="text-gray-500 dark:text-gray-400 text-center mt-2 text-sm leading-5">
                                Pick a unique name for the leaderboard. This
                                cannot be changed later.
                            </Text>
                        </View>

                        <TextInput
                            value={inputName}
                            onChangeText={(text) => {
                                setInputName(text);
                                setErrorMsg("");
                            }}
                            placeholder="Enter username"
                            placeholderTextColor={
                                isDark ? "#6B7280" : "#9CA3AF"
                            }
                            autoCapitalize="none"
                            autoCorrect={false}
                            maxLength={15}
                            className="bg-gray-100 dark:bg-gray-700 px-5 py-4 rounded-2xl text-gray-900 dark:text-gray-100 text-lg font-semibold border border-gray-200 dark:border-gray-600 mb-3"
                        />

                        {errorMsg ? (
                            <View className="flex-row items-center gap-2 mb-3 px-1">
                                <Ionicons
                                    name="alert-circle"
                                    size={16}
                                    color="#EF4444"
                                />
                                <Text className="text-red-500 text-sm font-medium">
                                    {errorMsg}
                                </Text>
                            </View>
                        ) : (
                            <Text className="text-gray-400 dark:text-gray-500 text-xs px-1 mb-3">
                                3–15 characters · letters, numbers, underscores
                            </Text>
                        )}

                        <Pressable
                            onPress={handleSubmitUsername}
                            disabled={checking}
                            className={`py-4 rounded-2xl items-center ${checking ? "bg-indigo-300" : "bg-indigo-500 active:bg-indigo-600"}`}
                        >
                            {checking ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white text-lg font-bold">
                                    Join Leaderboard
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
