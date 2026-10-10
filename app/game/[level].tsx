import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { BannerAdWidget } from "../../components/BannerAdWidget";
import { ConfettiOverlay } from "../../components/ConfettiOverlay";
import { GameBoard } from "../../components/GameBoard";
import { LevelHeader } from "../../components/LevelHeader";
import {
    CAMPAIGN_VERSION,
    getDifficultyProfile,
} from "../../constants/levelDifficulty";
import { useGameEngine } from "../../hooks/useGameEngine";
import { checkNewAchievements } from "../../utils/achievements";
import {
    isRewardedReady,
    preloadInterstitial,
    preloadRewarded,
    shouldShowInterstitialOnCompletion,
    showInterstitial,
    showRewarded,
} from "../../utils/ads";
import { ARROW_COLORS } from "../../utils/customizations";
import {
    getDailyChallenge,
    recordDailyCompletion,
} from "../../utils/dailyChallenge";
import { formatTime } from "../../utils/format";
import { submitScore } from "../../utils/leaderboard";
import { getPreviewLevel, markPreviewPassed } from "../../utils/previewLevel";
import {
    ActiveCustomization,
    addArrows,
    getActiveCustomization,
    getLeaderboardUsername,
    getUnlockedAchievements,
    getUnlockedLevel,
    recordLevelCompletion,
    saveCompletedLevel,
    setUnlockedLevel,
    unlockAchievement,
} from "../../utils/storage";

const noOp = () => undefined;
type SessionProps = {
    levelId: number;
    isReplay: boolean;
    source: string;
    communityId?: string;
    dateKey?: string;
};

export default function GameScreen() {
    const params = useLocalSearchParams<{
        level: string;
        replay?: string;
        source?: string;
        communityId?: string;
        date?: string;
    }>();
    const router = useRouter();
    const levelId = Number(params.level);
    const source = params.source || "campaign";
    const validLevel =
        Number.isSafeInteger(levelId) && levelId >= 0 && levelId <= 1000000;
    const dailyDate = params.date
        ? new Date(`${params.date}T00:00:00Z`)
        : new Date();
    const daily =
        source === "daily" && Number.isFinite(dailyDate.getTime())
            ? getDailyChallenge(dailyDate)
            : null;
    const validSource =
        ["campaign", "community", "daily"].includes(source) &&
        (source !== "community" ||
            (levelId === 0 &&
                typeof params.communityId === "string" &&
                !!params.communityId));
    const validDate =
        !params.date ||
        (typeof params.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(params.date) &&
            Number.isFinite(dailyDate.getTime()) &&
            dailyDate.toISOString().slice(0, 10) === params.date);
    if (
        !validLevel ||
        !validSource ||
        !validDate ||
        (levelId === 0 &&
            !getPreviewLevel(
                source === "community"
                    ? `community:${params.communityId}`
                    : "editor",
            )) ||
        (source === "daily" && (!daily || daily.levelId !== levelId))
    ) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center p-8">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                    This puzzle is unavailable
                </Text>
                <Text className="text-gray-500 text-center mt-3 mb-6">
                    Open it again from the campaign, community, or editor.
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => router.replace("/")}
                    className="bg-indigo-600 px-8 py-4 rounded-2xl"
                >
                    <Text className="font-bold text-white">Back to Home</Text>
                </Pressable>
            </SafeAreaView>
        );
    }
    return (
        <GameSession
            key={`${levelId}:${source}:${params.communityId || ""}:${daily?.dateKey || ""}`}
            levelId={levelId}
            source={source}
            isReplay={params.replay === "true"}
            communityId={params.communityId}
            dateKey={daily?.dateKey}
        />
    );
}

function GameSession({
    levelId,
    source,
    isReplay,
    communityId,
    dateKey,
}: SessionProps) {
    const router = useRouter();
    const focused = useIsFocused();
    const isCommunity = source === "community";
    const isDaily = source === "daily";
    const isPreview = levelId === 0 && !isCommunity;
    const [showHelp, setShowHelp] = useState(false);
    const [isWatchingAd, setIsWatchingAd] = useState(false);
    const [rewardedLoaded, setRewardedLoaded] = useState(false);
    const [completionSaved, setCompletionSaved] = useState(false);
    const [advancing, setAdvancing] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const [saveRetry, setSaveRetry] = useState(0);
    const completionAttempt = useRef<number | null>(null);
    const [customization, setCustomization] = useState<ActiveCustomization>({
        arrowStyleId: null,
        boardThemeId: null,
        confettiId: null,
    });
    const {
        board,
        hearts,
        mistakes,
        revivesUsed,
        hintsUsed,
        stars,
        hintTileId,
        requestHint,
        attemptCount,
        levelData,
        handleTap,
        resetLevel,
        isResetting,
        errorTileId,
        elapsedSeconds,
        isComplete,
        isGameOver,
        reviveGame,
    } = useGameEngine(levelId, noOp, {
        isActive: focused && !isWatchingAd && !showHelp,
        levelKey: `${source}:${communityId || dateKey || levelId}`,
    });
    const profile =
        levelId > 0
            ? levelData.difficulty?.profile || getDifficultyProfile(levelId)
            : null;
    const remaining = board.filter((t) => !t.removed).length;
    const progress = board.length
        ? (board.length - remaining) / board.length
        : 0;
    const activeArrowColorHex = ARROW_COLORS.find(
        (a) => a.id === customization.arrowStyleId,
    )?.value;
    useEffect(() => {
        getActiveCustomization().then(setCustomization);
        preloadInterstitial();
        preloadRewarded();
    }, []);
    useEffect(() => {
        if (isGameOver) setRewardedLoaded(isRewardedReady());
    }, [isGameOver]);
    useEffect(() => {
        setCompletionSaved(false);
        setSaveError(false);
        completionAttempt.current = null;
    }, [attemptCount]);

    useEffect(() => {
        if (!isComplete || completionAttempt.current === attemptCount) return;
        completionAttempt.current = attemptCount;
        setSaveError(false);
        const save = async () => {
            if (isPreview) {
                markPreviewPassed();
                return;
            }
            if (isDaily && dateKey) {
                await recordDailyCompletion({
                    dateKey,
                    levelId,
                    time: elapsedSeconds,
                    stars,
                });
                return;
            }
            const result = await recordLevelCompletion(
                isCommunity
                    ? { source: "community", communityId: communityId! }
                    : { source: "campaign", levelId },
            );
            if (!isCommunity) {
                await saveCompletedLevel({
                    levelId,
                    version: levelData.version || CAMPAIGN_VERSION,
                    time: elapsedSeconds,
                    heartsUsed: mistakes,
                    stars,
                    hintsUsed,
                    revivesUsed,
                });
                const unlocked = await getUnlockedLevel();
                if (levelId >= unlocked) {
                    await setUnlockedLevel(levelId + 1);
                    const username = await getLeaderboardUsername();
                    if (username)
                        void submitScore(username, levelId + 1).catch(
                            () => undefined,
                        );
                }
            }
            const unlockedIds = await getUnlockedAchievements();
            for (const achievement of checkNewAchievements(
                result.stats,
                unlockedIds,
            )) {
                await unlockAchievement(achievement.id);
                await addArrows(achievement.arrowReward);
                Toast.show({
                    type: "success",
                    text1: achievement.title,
                    text2: `You earned ${achievement.arrowReward} Arrows!`,
                });
            }
        };
        void save()
            .then(() => setCompletionSaved(true))
            .catch(() => setSaveError(true));
    }, [
        isComplete,
        attemptCount,
        isPreview,
        isCommunity,
        isDaily,
        dateKey,
        communityId,
        levelId,
        elapsedSeconds,
        stars,
        mistakes,
        hintsUsed,
        revivesUsed,
        levelData.version,
        saveRetry,
    ]);

    const leave = () => {
        if (isWatchingAd || (isComplete && !completionSaved && !saveError))
            return;
        if (isDaily) router.replace("/");
        else if (isCommunity || isPreview) {
            if (router.canGoBack()) router.back();
            else router.replace("/");
        } else if (isReplay) router.replace("/completed-levels");
        else router.replace("/");
    };
    const next = async () => {
        if (advancing || !completionSaved) return;
        setAdvancing(true);
        try {
            if (isDaily || isCommunity || isPreview || isReplay) {
                leave();
                return;
            }
            if (await shouldShowInterstitialOnCompletion())
                await showInterstitial();
            router.replace(`/game/${levelId + 1}`);
        } finally {
            setAdvancing(false);
        }
    };
    const revive = async () => {
        if (isWatchingAd) return;
        setIsWatchingAd(true);
        try {
            const earned = await showRewarded();
            if (earned) reviveGame();
            else
                Toast.show({
                    type: "error",
                    text1: "Ad unavailable",
                    text2: "You can retry the puzzle for free.",
                });
        } finally {
            setIsWatchingAd(false);
        }
    };
    const replay = () => {
        setCompletionSaved(false);
        resetLevel();
    };
    const detail = hintTileId
        ? "The blue ring marks a clear exit. Tap that arrow."
        : errorTileId
          ? "That path is blocked. Follow the red line to the blocker."
          : profile?.tip ||
            "Tap an arrow only when the path ahead of its head is clear.";
    const nextLabel = isDaily
        ? "Back to Home"
        : isCommunity
          ? "Back to Community"
          : isPreview
            ? "Back to Editor"
            : isReplay
              ? "Completed Levels"
              : "Next Level";
    const primaryClass =
        "bg-indigo-600 active:bg-indigo-700 rounded-2xl min-h-[52px] px-5 py-4 w-full items-center justify-center";
    return (
        <SafeAreaView
            edges={["top", "bottom"]}
            className="flex-1 bg-gray-50 dark:bg-gray-900"
        >
            <View
                className="flex-1 px-3 pt-2 w-full self-center"
                style={{ maxWidth: 800 }}
            >
                <LevelHeader
                    levelId={levelId}
                    levelLabel={
                        isDaily
                            ? "Daily Challenge"
                            : isCommunity
                              ? "Community"
                              : isPreview
                                ? "Playtest"
                                : undefined
                    }
                    hearts={hearts}
                    elapsedSeconds={elapsedSeconds}
                    arrowsRemaining={remaining}
                    onHelp={() => setShowHelp(true)}
                />
                <View className="flex-row items-center justify-between mb-2 gap-2">
                    <View className="flex-1">
                        <Text
                            numberOfLines={1}
                            className="text-sm font-bold text-gray-900 dark:text-gray-100"
                        >
                            {isDaily
                                ? new Date(
                                      `${dateKey}T12:00:00Z`,
                                  ).toLocaleDateString(undefined, {
                                      month: "long",
                                      day: "numeric",
                                      timeZone: "UTC",
                                  })
                                : profile?.title || "Find a clear path"}
                        </Text>
                        <Text
                            numberOfLines={2}
                            className="text-xs text-gray-500 dark:text-gray-400 mt-1"
                            style={{ minHeight: 32 }}
                        >
                            {detail}
                        </Text>
                    </View>
                    {profile && (
                        <View
                            className={`rounded-full px-3 py-1.5 ${profile.kind === "challenge" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-indigo-100 dark:bg-indigo-900/40"}`}
                        >
                            <Text className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                {profile.kind === "challenge"
                                    ? "Challenge"
                                    : profile.label}
                            </Text>
                        </View>
                    )}
                </View>
                <View className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                    <View
                        style={{
                            width: `${progress * 100}%`,
                            height: "100%",
                            backgroundColor: "#6366F1",
                        }}
                    />
                </View>
                <GameBoard
                    board={board}
                    boardSize={levelData.size}
                    shape={levelData.shape}
                    onTap={handleTap}
                    isResetting={isResetting}
                    errorTileId={errorTileId}
                    hintTileId={hintTileId}
                    arrowColorOverride={activeArrowColorHex}
                    boardThemeOverride={customization.boardThemeId}
                />
                <View className="flex-row items-center gap-3 py-2">
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Show a hint"
                        accessibilityHint="Highlights one clear arrow. This attempt can earn up to two stars."
                        disabled={
                            hintsUsed > 0 ||
                            isResetting ||
                            isComplete ||
                            isGameOver
                        }
                        onPress={requestHint}
                        className={`flex-row items-center gap-2 rounded-2xl px-4 py-3 min-h-[48px] ${hintsUsed ? "bg-gray-200 dark:bg-gray-800" : "bg-indigo-100 dark:bg-indigo-900/40"}`}
                    >
                        <Ionicons
                            name="bulb-outline"
                            size={20}
                            color={hintsUsed ? "#94A3B8" : "#6366F1"}
                        />
                        <Text className="font-bold text-sm text-indigo-700 dark:text-indigo-300">
                            {hintsUsed ? "Hint used" : "Hint · 1 free"}
                        </Text>
                    </Pressable>
                    <Text className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                        {hintsUsed
                            ? "Hint-assisted clear: up to 2 stars."
                            : "No time limit. A hint gives up to 2 stars."}
                    </Text>
                </View>
                <BannerAdWidget />
            </View>
            <Modal
                visible={showHelp}
                transparent
                animationType="fade"
                onRequestClose={() => setShowHelp(false)}
            >
                <View className="flex-1 bg-black/60 justify-center items-center p-5">
                    <ScrollView
                        style={{
                            maxHeight: "90%",
                            width: "100%",
                            maxWidth: 448,
                        }}
                        contentContainerStyle={{
                            backgroundColor: "transparent",
                        }}
                    >
                        <View className="w-full rounded-3xl bg-white dark:bg-gray-800 p-6">
                            <Text className="text-2xl font-black text-gray-900 dark:text-white mb-5">
                                Find a clear path
                            </Text>
                            <Text className="text-base leading-7 text-gray-600 dark:text-gray-300">
                                1. Look straight ahead from an arrowhead. If
                                another arrow is in the way, clear that one
                                first.{"\n\n"}2. Tap anywhere on a clear arrow
                                to send it out. Empty space outside the board
                                shape is an exit.{"\n\n"}3. Clear every arrow. A
                                blocked tap costs one heart. You can take as
                                long as you need.
                            </Text>
                            <Text className="text-sm leading-5 text-gray-500 dark:text-gray-400 mt-5 mb-6">
                                Guides and zoom are free and do not affect
                                stars. One hint is available each attempt (up to
                                2 stars). Revived attempts earn 1 star.
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => setShowHelp(false)}
                                className={primaryClass}
                            >
                                <Text className="font-bold text-white">
                                    Let’s play
                                </Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
            <Modal
                visible={isComplete || isGameOver}
                transparent
                animationType="fade"
                onRequestClose={leave}
            >
                <View className="flex-1 bg-black/60 justify-center items-center p-5">
                    <ScrollView
                        style={{
                            maxHeight: "95%",
                            width: "100%",
                            maxWidth: 420,
                        }}
                        contentContainerStyle={{
                            flexGrow: 1,
                            justifyContent: "center",
                        }}
                    >
                        <View className="bg-white dark:bg-gray-800 rounded-3xl p-6 items-center">
                            {isComplete ? (
                                <View className="flex-row gap-3 mb-5">
                                    {[0, 1, 2].map((i) => (
                                        <Ionicons
                                            key={i}
                                            name={
                                                i < stars
                                                    ? "star"
                                                    : "star-outline"
                                            }
                                            size={44}
                                            color={
                                                i < stars
                                                    ? "#F59E0B"
                                                    : "#CBD5E1"
                                            }
                                        />
                                    ))}
                                </View>
                            ) : (
                                <Ionicons
                                    name="refresh-circle-outline"
                                    size={64}
                                    color="#6366F1"
                                />
                            )}
                            <Text
                                accessibilityRole="header"
                                className="text-3xl font-black text-gray-900 dark:text-white text-center mt-2"
                            >
                                {isComplete
                                    ? isDaily
                                        ? "Daily complete!"
                                        : "Beautifully cleared!"
                                    : "Try a fresh approach"}
                            </Text>
                            <Text className="text-sm text-center text-gray-500 dark:text-gray-400 mt-3 mb-5">
                                {isComplete
                                    ? mistakes === 0 && hintsUsed === 0
                                        ? "A clean solve. Every arrow found its way."
                                        : hintsUsed
                                          ? "Hint-assisted clear. Try again for three stars."
                                          : "Another puzzle untangled."
                                    : "Trace the blockers back to an arrow with a clear exit. Retry whenever you’re ready."}
                            </Text>
                            <View className="flex-row gap-6 justify-center mb-6">
                                <View className="items-center">
                                    <Text className="text-xl font-bold text-gray-900 dark:text-white">
                                        {formatTime(elapsedSeconds)}
                                    </Text>
                                    <Text className="text-xs text-gray-500 mt-1">
                                        Active time
                                    </Text>
                                </View>
                                <View className="items-center">
                                    <Text className="text-xl font-bold text-gray-900 dark:text-white">
                                        {mistakes}
                                    </Text>
                                    <Text className="text-xs text-gray-500 mt-1">
                                        Mistakes
                                    </Text>
                                </View>
                                <View className="items-center">
                                    <Text className="text-xl font-bold text-gray-900 dark:text-white">
                                        {hintsUsed}
                                    </Text>
                                    <Text className="text-xs text-gray-500 mt-1">
                                        Hints
                                    </Text>
                                </View>
                            </View>
                            {isComplete ? (
                                <>
                                    {saveError && (
                                        <View className="w-full bg-amber-50 dark:bg-amber-900/30 p-4 rounded-2xl mb-3">
                                            <Text className="text-sm text-amber-900 dark:text-amber-200 mb-3">
                                                Your solve is complete, but it
                                                has not been saved. Retry before
                                                leaving.
                                            </Text>
                                            <Pressable
                                                accessibilityRole="button"
                                                onPress={() => {
                                                    completionAttempt.current =
                                                        null;
                                                    setSaveRetry((n) => n + 1);
                                                }}
                                                className="py-3 items-center rounded-xl bg-amber-200"
                                            >
                                                <Text className="font-bold text-amber-900">
                                                    Retry saving
                                                </Text>
                                            </Pressable>
                                            <Pressable
                                                accessibilityRole="button"
                                                onPress={leave}
                                                className="py-3 items-center"
                                            >
                                                <Text className="text-xs text-amber-900 dark:text-amber-200">
                                                    Leave without saving
                                                </Text>
                                            </Pressable>
                                        </View>
                                    )}
                                    <Pressable
                                        accessibilityRole="button"
                                        disabled={!completionSaved || advancing}
                                        onPress={next}
                                        className={primaryClass}
                                    >
                                        {!completionSaved || advancing ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <Text className="text-white font-bold text-base">
                                                {nextLabel}
                                            </Text>
                                        )}
                                    </Pressable>
                                    <Pressable
                                        accessibilityRole="button"
                                        disabled={!completionSaved}
                                        onPress={replay}
                                        className="mt-3 w-full min-h-[48px] items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700"
                                    >
                                        <Text className="font-bold text-gray-600 dark:text-gray-200">
                                            Play again
                                        </Text>
                                    </Pressable>
                                </>
                            ) : (
                                <>
                                    <Pressable
                                        accessibilityRole="button"
                                        disabled={isWatchingAd}
                                        onPress={replay}
                                        className={primaryClass}
                                    >
                                        <Text className="text-white font-bold text-base">
                                            Retry for free
                                        </Text>
                                    </Pressable>
                                    {rewardedLoaded && (
                                        <Pressable
                                            accessibilityRole="button"
                                            disabled={isWatchingAd}
                                            onPress={revive}
                                            className="mt-3 py-3 w-full items-center"
                                        >
                                            {isWatchingAd ? (
                                                <ActivityIndicator color="#6366F1" />
                                            ) : (
                                                <Text className="font-semibold text-indigo-600 dark:text-indigo-300">
                                                    Watch ad · continue with 1
                                                    heart
                                                </Text>
                                            )}
                                        </Pressable>
                                    )}
                                    <Pressable
                                        accessibilityRole="button"
                                        disabled={isWatchingAd}
                                        onPress={leave}
                                        className="mt-2 py-3 w-full items-center"
                                    >
                                        <Text className="font-semibold text-gray-500">
                                            Back
                                        </Text>
                                    </Pressable>
                                </>
                            )}
                        </View>
                    </ScrollView>
                    {isComplete && (
                        <ConfettiOverlay
                            visible
                            themeId={customization.confettiId}
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}
