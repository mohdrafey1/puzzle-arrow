import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";

interface HeartsBarProps {
    hearts: number;
    maxHearts?: number;
}

export function HeartsBar({ hearts, maxHearts = 3 }: HeartsBarProps) {
    const prevHearts = useRef(hearts);
    const shakeX = useSharedValue(0);

    useEffect(() => {
        if (hearts < prevHearts.current) {
            // Shakes when losing a heart
            shakeX.value = withSequence(
                withTiming(-10, { duration: 50 }),
                withTiming(10, { duration: 50 }),
                withTiming(-10, { duration: 50 }),
                withSpring(0),
            );
        }
        prevHearts.current = hearts;
    }, [hearts]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: shakeX.value }],
        };
    });

    return (
        <Animated.View
            style={animatedStyle}
            className="flex-row items-center gap-2"
        >
            {Array.from({ length: maxHearts }).map((_, i) => (
                <Ionicons
                    key={i}
                    name={i < hearts ? "heart" : "heart-outline"}
                    size={32}
                    className={
                        i < hearts
                            ? "text-red-500"
                            : "text-gray-300 dark:text-gray-600"
                    }
                />
            ))}
        </Animated.View>
    );
}
