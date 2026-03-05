import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";

const { width: W, height: H } = Dimensions.get("window");

const DEFAULT_COLORS = [
    "#6366F1",
    "#EC4899",
    "#10B981",
    "#F59E0B",
    "#3B82F6",
    "#8B5CF6",
    "#14B8A6",
    "#F97316",
    "#06B6D4",
    "#84CC16",
    "#A855F7",
];

const GOLD_COLORS = ["#FBBF24", "#F59E0B", "#D97706", "#FEF3C7", "#FFFFFF"];

const NEON_COLORS = ["#39FF14", "#FF073A", "#00FFFF", "#FF00FF", "#FFFF00"];

const NUM_PARTICLES = 60;

function randomBetween(a: number, b: number) {
    return a + Math.random() * (b - a);
}

function Particle({ delay, colors }: { delay: number; colors: string[] }) {
    const x = useSharedValue(randomBetween(0, W));
    const y = useSharedValue(-20);
    const opacity = useSharedValue(0);
    const size = randomBetween(6, 14);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const dur = randomBetween(900, 1800);

    useEffect(() => {
        opacity.value = withDelay(delay, withTiming(1, { duration: 100 }));
        y.value = withDelay(
            delay,
            withTiming(H * 1.1, {
                duration: dur,
                easing: Easing.out(Easing.quad),
            }),
        );
        opacity.value = withDelay(
            delay + dur * 0.7,
            withTiming(0, { duration: dur * 0.3 }),
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: x.value }, { translateY: y.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: size,
                    height: size,
                    borderRadius: Math.random() > 0.5 ? size / 2 : 2,
                    backgroundColor: color,
                },
                animStyle,
            ]}
        />
    );
}

export function ConfettiOverlay({
    visible,
    themeId,
}: {
    visible: boolean;
    themeId?: string | null;
}) {
    if (!visible) return null;

    let activeColors = DEFAULT_COLORS;
    if (themeId === "confetti_gold") activeColors = GOLD_COLORS;
    if (themeId === "confetti_neon") activeColors = NEON_COLORS;

    const particles = Array.from({ length: NUM_PARTICLES }, (_, i) => ({
        key: i,
        delay: randomBetween(0, 600),
    }));

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {particles.map((p) => (
                <Particle key={p.key} delay={p.delay} colors={activeColors} />
            ))}
        </View>
    );
}
