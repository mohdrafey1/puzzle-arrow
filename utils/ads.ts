import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import mobileAds, {
    AdEventType,
    AppOpenAd,
    InterstitialAd,
    RewardedAd,
    RewardedAdEventType,
    TestIds,
} from "react-native-google-mobile-ads";
import { logger } from "./logger";

// Ads are configured for Android only (see app.json androidAppId). Guard every
// entry point so iOS/web calls become harmless no-ops instead of erroring.
const ADS_SUPPORTED = Platform.OS === "android";

// Automatically use test ads in dev, real ads in production
const USE_TEST_ADS = __DEV__;

// ============================================
// AD UNIT IDS - ANDROID ONLY
// ============================================

const PRODUCTION_AD_UNITS = {
    banner: "ca-app-pub-4435788387381825/3854928251",
    interstitial: "ca-app-pub-4435788387381825/7023288120",
    rewarded: "ca-app-pub-4435788387381825/1152743297",
    appOpen: "ca-app-pub-4435788387381825/8839661625",
    native: "ca-app-pub-4435788387381825/6213498286",
    rewardedInterstitial: "ca-app-pub-4435788387381825/5710206450",
};

const TEST_AD_UNITS = {
    banner: TestIds.ADAPTIVE_BANNER,
    interstitial: TestIds.INTERSTITIAL,
    rewarded: TestIds.REWARDED,
    appOpen: TestIds.APP_OPEN,
    native: TestIds.NATIVE,
    rewardedInterstitial: TestIds.REWARDED_INTERSTITIAL,
};

export const AdUnitIds = USE_TEST_ADS ? TEST_AD_UNITS : PRODUCTION_AD_UNITS;

// ============================================
// INITIALIZATION
// ============================================

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export function initializeAds(): Promise<void> {
    if (!ADS_SUPPORTED) return Promise.resolve();
    if (isInitialized) return Promise.resolve();
    if (initPromise) return initPromise;

    const p = mobileAds()
        .initialize()
        .then((status) => {
            logger.log("[AdMob] Initialization successful", status);
            isInitialized = true;
        })
        .catch((e) => {
            logger.error("[AdMob] Initialization error:", e);
        });

    initPromise = p;
    return p;
}

// ============================================
// FREQUENCY CAPPING
// ============================================

const INTERSTITIAL_LEVEL_FREQUENCY = 5; // Show interstitial every 5th level completion
const INTERSTITIAL_GAMEOVER_FREQUENCY = 2; // Show interstitial every 2nd game over

const STORAGE_KEYS = {
    levelCompletionCount: "@ads_level_completion_count",
    gameOverCount: "@ads_game_over_count",
};

// App Open ads must not fire on every foreground. Enforce a minimum interval
// between shows (AdMob-policy friendly and far less intrusive).
const APP_OPEN_MIN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
let lastAppOpenShownAt = 0;
// Suppress the App Open ad briefly after any other full-screen ad, so an
// interstitial/rewarded flow doesn't chain straight into an App Open ad.
let suppressAppOpenUntil = 0;
function suppressAppOpenBriefly() {
    suppressAppOpenUntil = Date.now() + 5000;
}

export async function shouldShowInterstitialOnCompletion(): Promise<boolean> {
    try {
        const raw = await AsyncStorage.getItem(
            STORAGE_KEYS.levelCompletionCount,
        );
        const count = (parseInt(raw || "0", 10) || 0) + 1;
        await AsyncStorage.setItem(
            STORAGE_KEYS.levelCompletionCount,
            String(count),
        );
        return count % INTERSTITIAL_LEVEL_FREQUENCY === 0;
    } catch {
        return false;
    }
}

export async function shouldShowInterstitialOnGameOver(): Promise<boolean> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.gameOverCount);
        const count = (parseInt(raw || "0", 10) || 0) + 1;
        await AsyncStorage.setItem(
            STORAGE_KEYS.gameOverCount,
            String(count),
        );
        return count % INTERSTITIAL_GAMEOVER_FREQUENCY === 0;
    } catch {
        return false;
    }
}

// ============================================
// INTERSTITIAL AD HELPERS
// ============================================

let interstitialAd: InterstitialAd | null = null;
let isInterstitialLoaded = false;

export async function preloadInterstitial(): Promise<void> {
    try {
        await initializeAds();
        interstitialAd = InterstitialAd.createForAdRequest(
            AdUnitIds.interstitial,
            {
                requestNonPersonalizedAdsOnly: true,
                // Exclude sensitive ad categories for family-friendly content
                keywords: ['puzzle', 'game', 'strategy', 'casual', 'brain'],
                contentUrl: 'https://play.google.com/store/apps/details?id=com.mohdrafey1.puzzlearrow',
            }
        );

        const unsubscribeLoaded = interstitialAd.addAdEventListener(
            AdEventType.LOADED,
            () => {
                logger.log("[AdMob] Interstitial Loaded");
                isInterstitialLoaded = true;
                unsubscribeLoaded();
            },
        );

        const unsubscribeError = interstitialAd.addAdEventListener(
            AdEventType.ERROR,
            (error) => {
                logger.error("[AdMob] Interstitial Error:", error);
                isInterstitialLoaded = false;
                unsubscribeError();
            },
        );

        interstitialAd.load();
    } catch {
        // silently fail
    }
}

export function showInterstitial(): Promise<void> {
    return new Promise((resolve) => {
        if (!interstitialAd || !isInterstitialLoaded) {
            resolve();
            preloadInterstitial(); // Reload for next time
            return;
        }
        suppressAppOpenBriefly();

        const unsubscribeClosed = interstitialAd.addAdEventListener(
            AdEventType.CLOSED,
            () => {
                unsubscribeClosed();
                isInterstitialLoaded = false;
                preloadInterstitial(); // Reload for next time
                resolve();
            },
        );

        interstitialAd.show().catch(() => {
            unsubscribeClosed();
            isInterstitialLoaded = false;
            preloadInterstitial();
            resolve();
        });
    });
}

// ============================================
// REWARDED AD HELPERS
// ============================================

let rewardedAd: RewardedAd | null = null;
let isRewardedLoaded = false;

export async function preloadRewarded(): Promise<void> {
    try {
        await initializeAds();
        rewardedAd = RewardedAd.createForAdRequest(AdUnitIds.rewarded, {
            requestNonPersonalizedAdsOnly: true,
            // Exclude sensitive ad categories for family-friendly content
            keywords: ['puzzle', 'game', 'strategy', 'casual', 'brain'],
            contentUrl: 'https://play.google.com/store/apps/details?id=com.mohdrafey1.puzzlearrow',
        });

        const unsubscribeLoaded = rewardedAd.addAdEventListener(
            RewardedAdEventType.LOADED,
            () => {
                logger.log("[AdMob] Rewarded Ad Loaded");
                isRewardedLoaded = true;
                unsubscribeLoaded();
            },
        );

        const unsubscribeError = rewardedAd.addAdEventListener(
            AdEventType.ERROR,
            (error) => {
                logger.error("[AdMob] Rewarded Ad Error:", error);
                isRewardedLoaded = false;
                unsubscribeError();
            },
        );

        rewardedAd.load();
    } catch {
        // silently fail
    }
}

export function isRewardedReady(): boolean {
    return isRewardedLoaded;
}

export function showRewarded(): Promise<boolean> {
    return new Promise((resolve) => {
        if (!rewardedAd || !isRewardedLoaded) {
            resolve(false);
            preloadRewarded();
            return;
        }

        suppressAppOpenBriefly();
        let earned = false;

        const unsubscribeEarned = rewardedAd.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            () => {
                earned = true;
                unsubscribeEarned();
            },
        );

        const unsubscribeClosed = rewardedAd.addAdEventListener(
            AdEventType.CLOSED,
            () => {
                unsubscribeClosed();
                isRewardedLoaded = false;
                preloadRewarded();
                resolve(earned);
            },
        );

        rewardedAd.show().catch(() => {
            unsubscribeEarned();
            unsubscribeClosed();
            isRewardedLoaded = false;
            preloadRewarded();
            resolve(false);
        });
    });
}

// ============================================
// APP OPEN AD
// ============================================

let appOpenAd: AppOpenAd | null = null;
let isAppOpenLoaded = false;

export async function preloadAppOpen(): Promise<void> {
    try {
        await initializeAds();
        appOpenAd = AppOpenAd.createForAdRequest(AdUnitIds.appOpen, {
            requestNonPersonalizedAdsOnly: true,
            // Exclude sensitive ad categories for family-friendly content
            keywords: ['puzzle', 'game', 'strategy', 'casual', 'brain'],
            contentUrl: 'https://play.google.com/store/apps/details?id=com.mohdrafey1.puzzlearrow',
        });

        const unsubscribeLoaded = appOpenAd.addAdEventListener(
            AdEventType.LOADED,
            () => {
                logger.log("[AdMob] App Open Ad Loaded");
                isAppOpenLoaded = true;
                unsubscribeLoaded();
            },
        );

        const unsubscribeError = appOpenAd.addAdEventListener(
            AdEventType.ERROR,
            (error) => {
                logger.error("[AdMob] App Open Ad Error:", error);
                isAppOpenLoaded = false;
                unsubscribeError();
            },
        );

        appOpenAd.load();
    } catch {
        // silently fail
    }
}

export function showAppOpen(): void {
    if (!appOpenAd || !isAppOpenLoaded) return;

    const now = Date.now();
    // Respect the cooldown and the post-ad suppression window.
    if (now < suppressAppOpenUntil) return;
    if (now - lastAppOpenShownAt < APP_OPEN_MIN_INTERVAL_MS) return;

    lastAppOpenShownAt = now;

    const unsubscribeClosed = appOpenAd.addAdEventListener(
        AdEventType.CLOSED,
        () => {
            isAppOpenLoaded = false;
            unsubscribeClosed();
        },
    );

    appOpenAd.show().catch(() => {
        unsubscribeClosed();
        isAppOpenLoaded = false;
    });
}
