import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
    BannerAd,
    BannerAdSize,
} from "react-native-google-mobile-ads";
import { AdUnitIds, initializeAds } from "../utils/ads";

interface BannerAdWidgetProps {
    size?: BannerAdSize;
}

const RESERVED_HEIGHTS: Record<string, number> = {
    [BannerAdSize.BANNER]: 50,
    [BannerAdSize.LARGE_BANNER]: 100,
    [BannerAdSize.MEDIUM_RECTANGLE]: 250,
    [BannerAdSize.FULL_BANNER]: 60,
    [BannerAdSize.LEADERBOARD]: 90,
    [BannerAdSize.ANCHORED_ADAPTIVE_BANNER]: 60,
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30_000;

/**
 * Reusable banner ad component.
 * Always reserves a fixed-height slot to prevent layout shift, even when
 * the ad fails to load or is still initializing. Retries up to 3 times on
 * failure, 30s apart, before giving up for the screen lifetime.
 */
export function BannerAdWidget({
    size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
}: BannerAdWidgetProps) {
    const [isInit, setIsInit] = useState(false);
    const [retryKey, setRetryKey] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const [hasError, setHasError] = useState<string | null>(null);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const reservedHeight = RESERVED_HEIGHTS[size] ?? 60;

    useEffect(() => {
        initializeAds().then(() => setIsInit(true));
        return () => {
            if (retryTimer.current) clearTimeout(retryTimer.current);
        };
    }, []);

    const slotStyle = {
        width: "100%" as const,
        height: reservedHeight,
        alignItems: "center" as const,
        justifyContent: "center" as const,
    };

    if (!isInit || hasError) {
        return <View style={slotStyle} />;
    }

    return (
        <View style={slotStyle}>
            <BannerAd
                key={retryKey}
                unitId={AdUnitIds.banner}
                size={size}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: true,
                    keywords: ["puzzle", "game", "strategy", "casual", "brain"],
                    contentUrl:
                        "https://play.google.com/store/apps/details?id=com.mohdrafey1.puzzlearrow",
                }}
                onAdLoaded={() => {
                    setRetryCount(0);
                }}
                onAdFailedToLoad={(error) => {
                    if (retryCount < MAX_RETRIES) {
                        retryTimer.current = setTimeout(() => {
                            setRetryCount((c) => c + 1);
                            setRetryKey((k) => k + 1);
                        }, RETRY_DELAY_MS);
                    } else {
                        setHasError(error.message);
                    }
                }}
            />
        </View>
    );
}
