import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { ConfettiOverlay } from "../../components/ConfettiOverlay";
import { GameBoard } from "../../components/GameBoard";
import { LevelHeader } from "../../components/LevelHeader";
import { useGameEngine } from "../../hooks/useGameEngine";
import {
    getUnlockedLevel,
    saveCompletedLevel,
    setUnlockedLevel,
} from "../../utils/storage";

function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
}

function getStars(hearts: number): number {
    if (hearts >= 3) return 3;
    if (hearts >= 2) return 2;
    return 1;
}

export default function GameScreen() {
    const { level, replay } = useLocalSearchParams();
    const levelId = parseInt(level as string, 10);
    const isReplay = replay === "true";
    const router = useRouter();
    const finalTime = useRef(0);
    const savedCompletion = useRef(false);

    const handleComplete = useCallback(async () => {
        const unlocked = await getUnlockedLevel();
        if (levelId >= unlocked) {
            await setUnlockedLevel(levelId + 1);
        }
    }, [levelId]);

    const {
        board,
        hearts,
        levelData,
        handleTap,
        resetLevel,
        isResetting,
        errorTileId,
        elapsedSeconds,
        isComplete,
        isGameOver,
    } = useGameEngine(levelId, handleComplete);

    // Freeze time display at completion
    if (isComplete && finalTime.current === 0) {
        finalTime.current = elapsedSeconds;
    }

    const heartsUsed = 3 - hearts;
    const stars = getStars(hearts);

    // Persist completion stats (once)
    if (isComplete && finalTime.current > 0 && !savedCompletion.current) {
        savedCompletion.current = true;
        saveCompletedLevel({
            levelId,
            time: finalTime.current,
            heartsUsed,
            stars,
        });
    }

    // Card entrance animation (shared by completion & game over overlays)
    const cardScale = useSharedValue(0.6);
    const cardOpacity = useSharedValue(0);
    if (isComplete || isGameOver) {
        cardScale.value = withSpring(1, { damping: 14, stiffness: 120 });
        cardOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    }
    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
        opacity: cardOpacity.value,
    }));

    return (
        <View className="flex-1 bg-gray-50 dark:bg-gray-900 p-2 pt-8">
            <LevelHeader
                levelId={levelId}
                hearts={hearts}
                elapsedSeconds={isComplete ? finalTime.current : elapsedSeconds}
            />

            <View className="flex-1 w-full items-center justify-center">
                <GameBoard
                    board={board}
                    boardSize={levelData.size}
                    onTap={handleTap}
                    isResetting={isResetting}
                    errorTileId={errorTileId}
                />
            </View>

            {isComplete && (
                <>
                    <ConfettiOverlay visible={isComplete} />
                    <View
                        className="absolute inset-0 items-center justify-center"
                        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
                    >
                        <Animated.View
                            className="mx-6 bg-white dark:bg-gray-800 rounded-3xl p-8 items-center shadow-2xl"
                            style={cardStyle}
                        >
                            {/* Stars */}
                            <Text className="text-5xl mb-2">
                                {Array.from({ length: 3 })
                                    .map((_, i) => (i < stars ? "⭐" : "☆"))
                                    .join("")}
                            </Text>

                            <Text className="text-3xl font-black text-gray-900 dark:text-gray-100 mb-1 tracking-tight">
                                Level {levelId} Done!
                            </Text>
                            <Text className="text-gray-400 dark:text-gray-500 text-base mb-6">
                                🕐 {formatTime(finalTime.current)} · ❤️{" "}
                                {heartsUsed} used
                            </Text>

                            {/* Primary action */}
                            <Pressable
                                onPress={() =>
                                    isReplay
                                        ? router.replace("/completed-levels")
                                        : router.replace(`/game/${levelId + 1}`)
                                }
                                className="bg-indigo-500 active:bg-indigo-600 w-full py-4 rounded-2xl mb-3 items-center"
                            >
                                <Text className="text-white font-bold text-lg px-4">
                                    {isReplay
                                        ? "← Completed Levels"
                                        : "Next Level →"}
                                </Text>
                            </Pressable>

                            {/* Replay */}
                            <Pressable
                                onPress={() =>
                                    router.replace(`/game/${levelId}`)
                                }
                                className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 items-center"
                            >
                                <Text className="text-gray-600 dark:text-gray-400 font-semibold text-base px-4">
                                    Replay
                                </Text>
                            </Pressable>
                        </Animated.View>
                    </View>
                </>
            )}

            {isGameOver && (
                <View
                    className="absolute inset-0 items-center justify-center"
                    style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
                >
                    <Animated.View
                        className="mx-6 bg-white dark:bg-gray-800 rounded-3xl p-8 items-center shadow-2xl"
                        style={cardStyle}
                    >
                        <Text className="text-5xl mb-2">💔</Text>

                        <Text className="text-3xl font-black text-gray-900 dark:text-gray-100 mb-1 tracking-tight">
                            Game Over
                        </Text>
                        <Text className="text-gray-400 dark:text-gray-500 text-base mb-6">
                            You ran out of hearts!
                        </Text>

                        <Pressable
                            onPress={resetLevel}
                            className="bg-indigo-500 active:bg-indigo-600 w-full py-4 rounded-2xl mb-3 items-center"
                        >
                            <Text className="text-white font-bold text-lg px-4">
                                Try Again
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => router.replace("/")}
                            className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 items-center"
                        >
                            <Text className="text-gray-600 dark:text-gray-400 font-semibold text-base px-4">
                                Back to Home
                            </Text>
                        </Pressable>
                    </Animated.View>
                </View>
            )}
        </View>
    );
}
