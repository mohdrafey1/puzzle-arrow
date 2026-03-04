import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View,
} from "react-native";
import {
    CommunityLevel,
    fetchCommunityLevels,
    voteCommunityLevel,
} from "../../utils/communityLevels";
import { checkUsernameAvailable, submitScore } from "../../utils/leaderboard";
import { setPreviewLevel } from "../../utils/previewLevel";
import {
    getLeaderboardUsername,
    getUnlockedLevel,
    setLeaderboardUsername,
} from "../../utils/storage";

export default function CommunityScreen() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const router = useRouter();

    const [levels, setLevels] = useState<CommunityLevel[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [username, setUsername] = useState<string | null>(null);

    // Username modal
    const [showModal, setShowModal] = useState(false);
    const [inputName, setInputName] = useState("");
    const [checking, setChecking] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [pendingAction, setPendingAction] = useState<"create" | null>(null);

    // Voting in-flight tracker
    const votingRef = useRef<Set<string>>(new Set());

    // Connectivity
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setIsOffline(!state.isConnected);
        });
        return () => unsubscribe();
    }, []);

    // Load data on focus
    useFocusEffect(
        useCallback(() => {
            let active = true;

            async function init() {
                const savedName = await getLeaderboardUsername();
                if (active) setUsername(savedName);

                try {
                    const data = await fetchCommunityLevels();
                    if (active) setLevels(data);
                } catch {
                    // offline
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
            const data = await fetchCommunityLevels();
            setLevels(data);
        } catch {
            // offline
        } finally {
            setRefreshing(false);
        }
    };

    const handleCreateLevel = () => {
        if (!username) {
            setPendingAction("create");
            setShowModal(true);
            return;
        }
        router.push("/level-editor" as any);
    };

    const handlePlayLevel = (level: CommunityLevel) => {
        const shape = Array.from({ length: level.size }, () =>
            Array.from({ length: level.size }, () => true),
        );
        setPreviewLevel({
            id: 0,
            size: level.size,
            shape,
            tiles: level.tiles.map((t) => ({
                path: t.path,
                direction: t.direction,
            })),
        });
        router.push("/game/0?source=community" as any);
    };

    const handleVote = async (levelId: string, vote: "up" | "down") => {
        if (!username) {
            Alert.alert("Username Required", "Set a username to vote.");
            setShowModal(true);
            return;
        }
        if (votingRef.current.has(levelId)) return;
        votingRef.current.add(levelId);

        try {
            await voteCommunityLevel(levelId, username, vote);
            // Refresh the list
            const data = await fetchCommunityLevels();
            setLevels(data);
        } catch {
            Alert.alert("Error", "Failed to vote. Try again.");
        } finally {
            votingRef.current.delete(levelId);
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

            await setLeaderboardUsername(trimmed);
            setUsername(trimmed);

            // Submit current level to leaderboard
            const currentLevel = await getUnlockedLevel();
            await submitScore(trimmed, currentLevel);

            setShowModal(false);
            setInputName("");

            // Perform pending action
            if (pendingAction === "create") {
                setPendingAction(null);
                setTimeout(() => router.push("/level-editor" as any), 300);
            }
        } catch {
            setErrorMsg("Network error. Please try again.");
        } finally {
            setChecking(false);
        }
    };

    // ── Offline ──
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
                            Community levels need an internet connection.
                        </Text>
                        <Pressable
                            onPress={async () => {
                                const state = await NetInfo.fetch();
                                if (state.isConnected) {
                                    setIsOffline(false);
                                    setLoading(true);
                                    try {
                                        const data =
                                            await fetchCommunityLevels();
                                        setLevels(data);
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

    // ── Loading ──
    if (loading) {
        return (
            <View className="flex-1 bg-gray-100 dark:bg-gray-900 pt-16">
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator
                        size="large"
                        color={isDark ? "#818CF8" : "#6366F1"}
                    />
                    <Text className="text-gray-500 dark:text-gray-400 mt-4 font-medium">
                        Loading community levels...
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
                        Community
                    </Text>
                    {username && (
                        <View className="bg-indigo-100 dark:bg-indigo-900/30 px-4 py-2 rounded-full">
                            <Text className="text-indigo-600 dark:text-indigo-300 font-bold text-sm">
                                @{username}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Create Level Button */}
                <Pressable
                    onPress={handleCreateLevel}
                    className="mt-3 bg-amber-500 active:bg-amber-600 px-5 py-3.5 rounded-2xl flex-row items-center justify-center gap-2"
                >
                    <Ionicons name="create" size={20} color="white" />
                    <Text className="text-white font-bold text-base">
                        Create & Share a Level
                    </Text>
                </Pressable>

                {!username && (
                    <Pressable
                        onPress={() => setShowModal(true)}
                        className="mt-2 flex-row items-center justify-center gap-1 py-2"
                    >
                        <Ionicons
                            name="person-add"
                            size={14}
                            color={isDark ? "#9CA3AF" : "#6B7280"}
                        />
                        <Text className="text-gray-500 dark:text-gray-400 text-xs font-bold">
                            Set username to create levels
                        </Text>
                    </Pressable>
                )}
            </View>

            {/* Community Levels List */}
            <FlatList
                data={levels}
                keyExtractor={(item) => item.id}
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
                            name="planet-outline"
                            size={64}
                            color={isDark ? "#4B5563" : "#D1D5DB"}
                        />
                        <Text className="text-gray-400 dark:text-gray-500 mt-4 text-lg font-semibold">
                            No community levels yet
                        </Text>
                        <Text className="text-gray-400 dark:text-gray-600 mt-1 text-sm">
                            Be the first to create one!
                        </Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const netScore = item.thumbsUp - item.thumbsDown;
                    const userVote = username
                        ? item.votes?.[username]
                        : undefined;

                    return (
                        <Pressable
                            onPress={() => handlePlayLevel(item)}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-750"
                        >
                            {/* Top row: creator + metadata */}
                            <View className="flex-row items-center justify-between mb-3">
                                <View className="flex-row items-center gap-2 flex-1">
                                    <View className="bg-indigo-100 dark:bg-indigo-900/30 p-1.5 rounded-full">
                                        <Ionicons
                                            name="person"
                                            size={14}
                                            color="#6366F1"
                                        />
                                    </View>
                                    <Text className="text-gray-900 dark:text-gray-100 font-bold text-sm">
                                        {item.creator}
                                    </Text>
                                    {item.creator === username && (
                                        <View className="bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-md">
                                            <Text className="text-amber-700 dark:text-amber-300 text-xs font-bold">
                                                YOU
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View className="flex-row items-center gap-3">
                                    <View className="flex-row items-center gap-1">
                                        <Ionicons
                                            name="grid"
                                            size={12}
                                            color={
                                                isDark ? "#9CA3AF" : "#6B7280"
                                            }
                                        />
                                        <Text className="text-gray-500 dark:text-gray-400 text-xs font-medium">
                                            {item.size}×{item.size}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center gap-1">
                                        <Text className="text-xs">🏹</Text>
                                        <Text className="text-gray-500 dark:text-gray-400 text-xs font-medium">
                                            {item.tiles.length}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Bottom: play hint + votes */}
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-1.5">
                                    <Ionicons
                                        name="play-circle"
                                        size={18}
                                        color="#3B82F6"
                                    />
                                    <Text className="text-blue-500 font-bold text-sm">
                                        Play
                                    </Text>
                                </View>

                                <View className="flex-row items-center gap-2">
                                    {/* Score */}
                                    <View
                                        className={`px-3 py-1 rounded-full ${
                                            netScore > 0
                                                ? "bg-emerald-100 dark:bg-emerald-900/30"
                                                : netScore < 0
                                                  ? "bg-red-100 dark:bg-red-900/30"
                                                  : "bg-gray-100 dark:bg-gray-700"
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-black ${
                                                netScore > 0
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : netScore < 0
                                                      ? "text-red-500 dark:text-red-400"
                                                      : "text-gray-500 dark:text-gray-400"
                                            }`}
                                        >
                                            {netScore > 0
                                                ? `+${netScore}`
                                                : netScore}
                                        </Text>
                                    </View>

                                    {/* Thumbs up */}
                                    <Pressable
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleVote(item.id, "up");
                                        }}
                                        className={`p-2 rounded-xl ${
                                            userVote === "up"
                                                ? "bg-emerald-500"
                                                : "bg-gray-100 dark:bg-gray-700"
                                        }`}
                                    >
                                        <Ionicons
                                            name="thumbs-up"
                                            size={16}
                                            color={
                                                userVote === "up"
                                                    ? "#FFFFFF"
                                                    : isDark
                                                      ? "#9CA3AF"
                                                      : "#6B7280"
                                            }
                                        />
                                    </Pressable>

                                    {/* Thumbs down */}
                                    <Pressable
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleVote(item.id, "down");
                                        }}
                                        className={`p-2 rounded-xl ${
                                            userVote === "down"
                                                ? "bg-red-500"
                                                : "bg-gray-100 dark:bg-gray-700"
                                        }`}
                                    >
                                        <Ionicons
                                            name="thumbs-down"
                                            size={16}
                                            color={
                                                userVote === "down"
                                                    ? "#FFFFFF"
                                                    : isDark
                                                      ? "#9CA3AF"
                                                      : "#6B7280"
                                            }
                                        />
                                    </Pressable>
                                </View>
                            </View>
                        </Pressable>
                    );
                }}
            />

            {/* Username Modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setShowModal(false);
                    setPendingAction(null);
                }}
            >
                <View
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                >
                    <View className="bg-white dark:bg-gray-800 mx-6 w-[85%] max-w-sm rounded-3xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
                        <Pressable
                            onPress={() => {
                                setShowModal(false);
                                setPendingAction(null);
                            }}
                            className="absolute top-4 right-4 p-2"
                        >
                            <Ionicons
                                name="close"
                                size={24}
                                color={isDark ? "#9CA3AF" : "#6B7280"}
                            />
                        </Pressable>

                        <View className="items-center mb-6">
                            <View className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full mb-4">
                                <Ionicons
                                    name="person"
                                    size={36}
                                    color="#F59E0B"
                                />
                            </View>
                            <Text className="text-2xl font-black text-gray-900 dark:text-gray-100 text-center">
                                Choose Username
                            </Text>
                            <Text className="text-gray-500 dark:text-gray-400 text-center mt-2 text-sm leading-5">
                                You need a username to create & share levels
                                with the community.
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
                            className={`py-4 rounded-2xl items-center ${checking ? "bg-amber-300" : "bg-amber-500 active:bg-amber-600"}`}
                        >
                            {checking ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white text-lg font-bold">
                                    Set Username
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
