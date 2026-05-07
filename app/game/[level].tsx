import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import Toast from 'react-native-toast-message';
import { BannerAdWidget } from '../../components/BannerAdWidget';
import { ConfettiOverlay } from '../../components/ConfettiOverlay';
import { GameBoard } from '../../components/GameBoard';
import { LevelHeader } from '../../components/LevelHeader';
import { useGameEngine } from '../../hooks/useGameEngine';
import { checkNewAchievements } from '../../utils/achievements';
import {
    isRewardedReady,
    preloadInterstitial,
    preloadRewarded,
    shouldShowInterstitialOnCompletion,
    shouldShowInterstitialOnGameOver,
    showInterstitial,
    showRewarded,
} from '../../utils/ads';
import { ARROW_COLORS } from '../../utils/customizations';
import { formatTime } from '../../utils/format';
import { submitScore } from '../../utils/leaderboard';
import { markPreviewPassed } from '../../utils/previewLevel';
import {
    ActiveCustomization,
    addArrows,
    getActiveCustomization,
    getLeaderboardUsername,
    getUnlockedAchievements,
    getUnlockedLevel,
    getUserStats,
    saveCompletedLevel,
    setUnlockedLevel,
    unlockAchievement,
    updateUserStats,
} from '../../utils/storage';

function getStars(hearts: number): number {
    if (hearts >= 3) return 3;
    if (hearts >= 2) return 2;
    return 1;
}

export default function GameScreen() {
    const { level, replay, source } = useLocalSearchParams();
    const levelId = parseInt(level as string, 10);
    const isReplay = replay === 'true';
    const isPreview = levelId === 0;
    const isCommunity = source === 'community';
    const router = useRouter();
    const [finalTime, setFinalTime] = useState(0);
    const savedCompletion = useRef(false);
    const [isWatchingAd, setIsWatchingAd] = useState(false);
    const [rewardedLoaded, setRewardedLoaded] = useState(false);

    useEffect(() => {
        preloadInterstitial();
        preloadRewarded();
    }, [levelId]);

    // Customization State
    const [customization, setCustomization] = useState<ActiveCustomization>({
        arrowStyleId: null,
        boardThemeId: null,
        confettiId: null,
    });

    useEffect(() => {
        getActiveCustomization().then(setCustomization);
    }, []);

    const activeArrowColorHex = customization.arrowStyleId
        ? ARROW_COLORS.find((a) => a.id === customization.arrowStyleId)?.value
        : null;

    const handleComplete = useCallback(async () => {
        // Skip save/unlock for preview levels from the editor
        if (isPreview) {
            markPreviewPassed();
            return;
        }

        // --- Progression & Achievements Logic ---
        const currentStats = await getUserStats();
        let statUpdates: any = {};

        if (isCommunity) {
            // Check if this specific community level is already beaten
            const alreadyBeaten =
                currentStats.completedCommunityLevelIds.includes(
                    levelId.toString(),
                );
            if (!alreadyBeaten) {
                statUpdates.communityLevelsBeaten =
                    currentStats.communityLevelsBeaten + 1;
                statUpdates.completedCommunityLevelIds = [
                    ...currentStats.completedCommunityLevelIds,
                    levelId.toString(),
                ];
            }
        } else {
            // Normal campaign level
            statUpdates.levelsCompleted = currentStats.levelsCompleted + 1;
        }

        const newStats = await updateUserStats(statUpdates);

        // Check for new achievements
        const unlockedIds = await getUnlockedAchievements();
        const newlyUnlocked = checkNewAchievements(newStats, unlockedIds);

        if (newlyUnlocked.length > 0) {
            for (const ach of newlyUnlocked) {
                await unlockAchievement(ach.id);
                await addArrows(ach.arrowReward);
                Toast.show({
                    type: 'success',
                    text1: `🏆 Achievement Unlocked: ${ach.title}`,
                    text2: `You earned ${ach.arrowReward} Arrows!`,
                    visibilityTime: 4000,
                    position: 'top',
                });
            }
        }

        if (!isCommunity) {
            const unlocked = await getUnlockedLevel();
            if (levelId >= unlocked) {
                const newLevel = levelId + 1;
                await setUnlockedLevel(newLevel);

                // Submit to leaderboard in background
                try {
                    const username = await getLeaderboardUsername();
                    if (username) {
                        submitScore(username, newLevel).catch(() => {});
                    }
                } catch {
                    // silently fail — offline or not registered
                }
            }
        }
    }, [levelId, isPreview, isCommunity]);

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
        reviveGame,
    } = useGameEngine(levelId, handleComplete);

    // Reset completion refs whenever level changes (or replay remounts this route)
    useEffect(() => {
        setFinalTime(0);
        savedCompletion.current = false;
    }, [levelId]);

    // Freeze time display at first completion frame
    useEffect(() => {
        if (isComplete && finalTime === 0) {
            setFinalTime(elapsedSeconds);
        }
    }, [isComplete, elapsedSeconds, finalTime]);

    // Check if rewarded ad is ready when game over screen appears
    useEffect(() => {
        if (isGameOver) {
            setRewardedLoaded(isRewardedReady());
        }
    }, [isGameOver]);

    const handleNextLevel = async () => {
        if (!isCommunity && !isPreview) {
            const shouldShow = await shouldShowInterstitialOnCompletion();
            if (shouldShow) {
                await showInterstitial();
            }
        }

        if (isCommunity || isPreview) {
            router.back();
        } else if (isReplay) {
            router.replace('/completed-levels');
        } else {
            router.replace(`/game/${levelId + 1}`);
        }
    };

    const handleRetry = async () => {
        if (!isCommunity && !isPreview) {
            const shouldShow = await shouldShowInterstitialOnGameOver();
            if (shouldShow) {
                await showInterstitial();
            }
        }
        resetLevel();
    };

    const handleRevive = async () => {
        setIsWatchingAd(true);
        const earned = await showRewarded();
        setIsWatchingAd(false);
        if (earned) {
            reviveGame();
        } else {
            Toast.show({
                type: 'error',
                text1: 'Ad Failed',
                text2: 'Could not load ad. Try again.',
            });
        }
    };

    const heartsUsed = 3 - hearts;
    const stars = getStars(hearts);

    // Persist completion stats (once) — skip for preview levels
    useEffect(() => {
        if (isPreview) return;
        if (isComplete && finalTime > 0 && !savedCompletion.current) {
            savedCompletion.current = true;
            // Only save time stats for Campaign levels
            if (!isCommunity) {
                saveCompletedLevel({
                    levelId,
                    time: finalTime,
                    heartsUsed: 3 - hearts,
                    stars,
                });
            }
        }
    }, [isComplete, hearts, levelId, stars, finalTime, isPreview, isCommunity]);

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
        <View className='flex-1 bg-gray-50 dark:bg-gray-900 p-2 pt-4'>
            <LevelHeader
                levelId={isPreview ? 0 : levelId}
                levelLabel={
                    isCommunity ? '-' : isPreview ? 'Preview' : undefined
                }
                hearts={hearts}
                elapsedSeconds={
                    isComplete ? finalTime || elapsedSeconds : elapsedSeconds
                }
                arrowsRemaining={board.filter((t) => !t.removed).length}
            />

            <View className='flex-1 w-full items-center justify-center'>
                <GameBoard
                    // Create a stable array of arrows so GameBoard only updates when board changes,
                    // not every 1000ms from elapsedSeconds incrementing.
                    board={board}
                    boardSize={levelData.size}
                    shape={levelData.shape}
                    onTap={handleTap}
                    isResetting={isResetting}
                    errorTileId={errorTileId}
                    arrowColorOverride={activeArrowColorHex}
                    boardThemeOverride={customization.boardThemeId}
                />
            </View>

            {isComplete && (
                <>
                    <View
                        className='absolute inset-0 items-center justify-center'
                        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                    >
                        <Animated.View
                            className='mx-6 w-[85%] max-w-sm bg-white dark:bg-gray-800 rounded-[32px] p-8 items-center shadow-black/30 shadow-[0px_20px_40px_rgba(0,0,0,0.25)] border border-gray-100 dark:border-gray-700 overflow-hidden'
                            style={cardStyle}
                        >
                            {/* Decorative background circle */}
                            <View className='absolute -top-20 -right-20 w-40 h-40 bg-indigo-50 dark:bg-indigo-900/20 rounded-full' />
                            <View className='absolute -bottom-20 -left-20 w-40 h-40 bg-pink-50 dark:bg-pink-900/20 rounded-full' />

                            {/* Stars */}
                            <View className='flex-row items-center justify-center gap-3 mb-6 mt-4'>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <View
                                        key={i}
                                        className={`transform ${i === 1 ? '-translate-y-4' : ''}`}
                                    >
                                        <Ionicons
                                            name={
                                                i < stars
                                                    ? 'star'
                                                    : 'star-outline'
                                            }
                                            size={i === 1 ? 56 : 44}
                                            color={
                                                i < stars
                                                    ? '#FBBF24'
                                                    : '#D1D5DB'
                                            }
                                            style={
                                                i < stars
                                                    ? {
                                                          textShadowColor:
                                                              'rgba(251, 191, 36, 0.4)',
                                                          textShadowOffset: {
                                                              width: 0,
                                                              height: 4,
                                                          },
                                                          textShadowRadius: 12,
                                                      }
                                                    : undefined
                                            }
                                        />
                                    </View>
                                ))}
                            </View>

                            <Text className='text-4xl font-black text-gray-900 dark:text-gray-100 mb-2 tracking-tight text-center'>
                                {isCommunity
                                    ? 'Community Level'
                                    : `Level ${levelId}`}{' '}
                                {'\n'}
                                <Text className='text-indigo-500'>
                                    Cleared!
                                </Text>
                            </Text>

                            {/* Stats */}
                            <View className='flex-row gap-4 mb-8 mt-4 w-full justify-center'>
                                <View className='bg-gray-100 dark:bg-gray-700 px-4 py-2.5 rounded-2xl flex-row items-center gap-2 border border-gray-200 dark:border-gray-600'>
                                    <Ionicons
                                        name='time'
                                        size={20}
                                        color='#818CF8'
                                    />
                                    <Text className='text-gray-700 dark:text-gray-300 font-bold text-base'>
                                        {formatTime(
                                            finalTime || elapsedSeconds,
                                        )}
                                    </Text>
                                </View>
                                <View className='bg-gray-100 dark:bg-gray-700 px-4 py-2.5 rounded-2xl flex-row items-center gap-2 border border-gray-200 dark:border-gray-600'>
                                    <Ionicons
                                        name='heart'
                                        size={20}
                                        color='#F87171'
                                    />
                                    <Text className='text-gray-700 dark:text-gray-300 font-bold text-base'>
                                        {heartsUsed} used
                                    </Text>
                                </View>
                            </View>

                            {/* Primary action */}
                            <Pressable
                                onPress={handleNextLevel}
                                className='bg-indigo-500 active:bg-indigo-600 w-full rounded-2xl mb-4 border-b-4 border-indigo-700 active:border-b-0 active:translate-y-[4px] py-4'
                            >
                                <View className='flex-row items-center justify-center gap-2'>
                                    <Text className='text-white font-black text-lg tracking-wide uppercase'>
                                        {isCommunity
                                            ? 'Back to Community'
                                            : isPreview
                                              ? 'Back to Editor'
                                              : isReplay
                                                ? 'Completed Levels'
                                                : 'Next Level'}
                                    </Text>
                                    <Ionicons
                                        name={
                                            isCommunity
                                                ? 'people'
                                                : isPreview
                                                  ? 'create'
                                                  : isReplay
                                                    ? 'list'
                                                    : 'arrow-forward'
                                        }
                                        size={24}
                                        color='white'
                                    />
                                </View>
                            </Pressable>

                            {/* Replay */}
                            <Pressable
                                onPress={() =>
                                    router.replace(`/game/${levelId}`)
                                }
                                className='w-full py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border-b-4 border-gray-300 dark:border-gray-700 active:border-b-0 active:translate-y-[4px] active:bg-gray-200 dark:active:bg-gray-700'
                            >
                                <View className='flex-row items-center justify-center gap-2'>
                                    <Ionicons
                                        name='refresh'
                                        size={22}
                                        color='#6B7280'
                                    />
                                    <Text className='text-gray-700 dark:text-gray-300 font-bold text-base tracking-wide uppercase'>
                                        Replay
                                    </Text>
                                </View>
                            </Pressable>
                        </Animated.View>
                    </View>
                    <ConfettiOverlay
                        visible={isComplete}
                        themeId={customization.confettiId}
                    />
                </>
            )}

            {isGameOver && (
                <View
                    className='absolute inset-0 items-center justify-center'
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                >
                    <Animated.View
                        className='mx-6 w-[85%] max-w-sm bg-white dark:bg-gray-800 rounded-[32px] p-8 items-center shadow-black/30 shadow-[0px_20px_40px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-700 overflow-hidden'
                        style={cardStyle}
                    >
                        {/* Decorative background circles */}
                        <View className='absolute -top-20 -right-20 w-40 h-40 bg-red-50 dark:bg-red-900/20 rounded-full' />
                        <View className='absolute -bottom-20 -left-20 w-40 h-40 bg-red-50 dark:bg-red-900/20 rounded-full' />

                        <View className='bg-red-100 dark:bg-red-900/40 p-5 rounded-full mb-6 mt-2'>
                            <Ionicons
                                name='heart-half'
                                size={56}
                                color='#EF4444'
                                style={{
                                    textShadowColor: 'rgba(239, 68, 68, 0.4)',
                                    textShadowOffset: { width: 0, height: 4 },
                                    textShadowRadius: 12,
                                }}
                            />
                        </View>

                        <Text className='text-4xl font-black text-gray-900 dark:text-gray-100 mb-2 tracking-tight'>
                            Game Over
                        </Text>
                        <Text className='text-gray-500 dark:text-gray-400 text-base text-center mb-8 px-4 leading-6'>
                            You ran out of hearts!{'\n'}Don&apos;t give up, try
                            again.
                        </Text>

                        {isWatchingAd ? (
                            <View className='mb-4 py-4 w-full items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-2xl'>
                                <ActivityIndicator
                                    size='large'
                                    color='#6366f1'
                                />
                                <Text className='mt-2 text-indigo-500 font-bold'>
                                    Loading ad...
                                </Text>
                            </View>
                        ) : (
                            rewardedLoaded && (
                                <Pressable
                                    onPress={handleRevive}
                                    className='bg-indigo-500 active:bg-indigo-600 w-full rounded-2xl mb-4 border-b-4 border-indigo-700 active:border-b-0 active:translate-y-[4px] py-4'
                                >
                                    <View className='flex-row items-center justify-center gap-2'>
                                        <Ionicons
                                            name='videocam'
                                            size={24}
                                            color='white'
                                        />
                                        <Text className='text-white font-black text-lg tracking-wide uppercase'>
                                            Watch Ad to Revive
                                        </Text>
                                    </View>
                                </Pressable>
                            )
                        )}

                        <Pressable
                            onPress={handleRetry}
                            className='bg-red-500 active:bg-red-600 w-full rounded-2xl mb-4 border-b-4 border-red-700 active:border-b-0 active:translate-y-[4px] py-4'
                        >
                            <View className='flex-row items-center justify-center gap-2'>
                                <Ionicons
                                    name='refresh-circle'
                                    size={26}
                                    color='white'
                                />
                                <Text className='text-white font-black text-lg tracking-wide uppercase'>
                                    Try Again
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() =>
                                isCommunity
                                    ? router.back()
                                    : isPreview
                                      ? router.back()
                                      : router.replace('/')
                            }
                            className='w-full py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border-b-4 border-gray-300 dark:border-gray-700 active:border-b-0 active:translate-y-[4px] active:bg-gray-200 dark:active:bg-gray-700'
                        >
                            <View className='flex-row items-center justify-center gap-2'>
                                <Ionicons
                                    name={
                                        isCommunity
                                            ? 'people'
                                            : isPreview
                                              ? 'create'
                                              : 'home'
                                    }
                                    size={20}
                                    color='#6B7280'
                                />
                                <Text className='text-gray-700 dark:text-gray-300 font-bold text-base tracking-wide uppercase'>
                                    {isCommunity
                                        ? 'Back to Community'
                                        : isPreview
                                          ? 'Back to Editor'
                                          : 'Back to Home'}
                                </Text>
                            </View>
                        </Pressable>
                    </Animated.View>
                </View>
            )}

            <View className='w-full'>
                <BannerAdWidget size={BannerAdSize.BANNER} />
            </View>

            <Toast />
        </View>
    );
}
