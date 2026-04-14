import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
    BannerAd,
    BannerAdSize,
} from "react-native-google-mobile-ads";
import { AdUnitIds, initializeAds } from "../utils/ads";

interface BannerAdWidgetProps {
    size?: BannerAdSize;
}

/**
 * Reusable banner ad component.
 * Renders an adaptive banner by default.
 * Gracefully hides itself if the ad fails to load.
 */
export function BannerAdWidget({
    size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
}: BannerAdWidgetProps) {
    const [isInit, setIsInit] = useState(false);
    const [hasError, setHasError] = useState<string | null>(null);

    useEffect(() => {
        initializeAds().then(() => setIsInit(true));
    }, []);

    if (!isInit) {
        return __DEV__ ? (
            <View className="w-full items-center py-4 bg-gray-200 dark:bg-gray-800 rounded-lg">
                <Text className="text-gray-500">Initializing AdMob...</Text>
            </View>
        ) : null;
    }

    if (hasError) {
        return __DEV__ ? (
            <View className="w-full items-center py-4 bg-red-100 dark:bg-red-900 rounded-lg border border-red-300">
                <Text className="text-red-600 dark:text-red-400 text-xs text-center px-4">
                    Ad Failed: {hasError}
                </Text>
            </View>
        ) : null;
    }

    return (
        <View className="w-full items-center py-2">
            <BannerAd
                unitId={AdUnitIds.banner}
                size={size}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: true,
                    // Exclude sensitive ad categories for family-friendly content
                    keywords: ['puzzle', 'game', 'family', 'kids'],
                    contentUrl: 'https://play.google.com/store/apps/details?id=com.mohdrafey1.puzzlearrow',
                }}
                onAdLoaded={() => {
                    console.log("[BannerAd] Loaded successfully");
                }}
                onAdFailedToLoad={(error) => {
                    console.error("[BannerAd] Failed to load:", error);
                    setHasError(error.message);
                }}
            />
        </View>
    );
}
