import { useColorScheme } from "nativewind";
import React, { forwardRef, useEffect, useImperativeHandle } from "react";
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { Circle, G, Path, Polygon } from "react-native-svg";
import { TileData } from "../utils/movement";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ArrowTileProps {
    tile: TileData;
    cellSize: number;
    boardSize: number;
    isResetting: boolean;
    hasError: boolean;
}

export interface ArrowTileRef {
    onExit: () => void;
}

export const ArrowTile = React.memo(
    forwardRef<ArrowTileRef, ArrowTileProps>(
        ({ tile, cellSize, boardSize, isResetting, hasError }, ref) => {
            const { colorScheme } = useColorScheme();
            const tileColor = colorScheme === "dark" ? "#F9FAFB" : "#111827";
            const actualColor = hasError ? "#EF4444" : tileColor;

            // Build Line Coordinates inside cell centers
            const pts = tile.path.map((p) => ({
                x: p.x * cellSize + cellSize / 2,
                y: p.y * cellSize + cellSize / 2,
            }));

            const dirX =
                tile.direction === "right"
                    ? 1
                    : tile.direction === "left"
                      ? -1
                      : 0;
            const dirY =
                tile.direction === "down"
                    ? 1
                    : tile.direction === "up"
                      ? -1
                      : 0;

            let M = pts[0];
            let L_total = (tile.path.length - 1) * cellSize;

            // Handle single cell "point" paths mathematically allowing them to have physical volume
            if (tile.path.length === 1) {
                L_total = cellSize * 0.4;
                M = {
                    x: pts[0].x - dirX * L_total,
                    y: pts[0].y - dirY * L_total,
                };
            }

            // Extend escape ray outwards out of bounds
            const escapeDist = boardSize * cellSize * 1.5;
            const E = {
                x: pts[pts.length - 1].x + dirX * escapeDist,
                y: pts[pts.length - 1].y + dirY * escapeDist,
            };

            const pathString =
                `M ${M.x},${M.y} ` +
                pts
                    .slice(1)
                    .map((p) => `L ${p.x},${p.y}`)
                    .join(" ") +
                ` L ${E.x},${E.y}`;

            const progress = useSharedValue(0);
            const opacity = useSharedValue(0);

            useEffect(() => {
                // Entrance: simple fade in with stagger
                const order = Math.random() * 300;
                opacity.value = withDelay(
                    order,
                    withTiming(1, { duration: 350 }),
                );
            }, []);

            useEffect(() => {
                if (isResetting) {
                    opacity.value = withTiming(0, { duration: 300 });
                    progress.value = 0;
                }
            }, [isResetting]);

            useEffect(() => {
                if (hasError) {
                    // Small bump in the escape direction then snap back simulating blocked impact
                    const bumpAmount = cellSize * 0.2;
                    progress.value = withSequence(
                        withTiming(bumpAmount, {
                            duration: 80,
                            easing: Easing.out(Easing.ease),
                        }),
                        withTiming(-bumpAmount * 0.5, { duration: 80 }),
                        withTiming(0, { duration: 80 }),
                    );
                }
            }, [hasError]);

            useImperativeHandle(ref, () => ({
                onExit: () => {
                    progress.value = withTiming(escapeDist, {
                        duration: 600,
                        easing: Easing.in(Easing.ease),
                    });
                    opacity.value = withDelay(
                        400,
                        withTiming(0, { duration: 200 }),
                    );
                },
            }));

            const pathProps = useAnimatedProps(() => {
                return {
                    strokeDashoffset: -progress.value,
                };
            });

            const headProps = useAnimatedProps(() => {
                return {
                    transform: [
                        {
                            translateX:
                                pts[pts.length - 1].x + progress.value * dirX,
                        },
                        {
                            translateY:
                                pts[pts.length - 1].y + progress.value * dirY,
                        },
                    ] as any,
                };
            });

            const arrowAngle = { up: -90, right: 0, down: 90, left: 180 }[
                tile.direction
            ];
            const arrL = cellSize * 0.25;
            const arrW = cellSize * 0.15;

            // Only animate opacity on the group — SVG transforms from canvas origin,
            // causing collapse glitch when scale is animated.
            const gProps = useAnimatedProps(() => ({
                opacity: opacity.value,
            }));

            return (
                <AnimatedG animatedProps={gProps}>
                    <AnimatedPath
                        d={pathString}
                        stroke={actualColor}
                        strokeWidth={cellSize * 0.08}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        strokeDasharray={`${L_total} 10000`}
                        animatedProps={pathProps}
                    />
                    {/** A small circle rounding the very tail end to cleanly close paths */}
                    <AnimatedCircle
                        cx={M.x}
                        cy={M.y}
                        r={cellSize * 0.04}
                        fill={actualColor}
                        animatedProps={useAnimatedProps(() => ({
                            cx:
                                M.x +
                                (tile.path.length === 1
                                    ? progress.value * dirX
                                    : 0),
                            cy:
                                M.y +
                                (tile.path.length === 1
                                    ? progress.value * dirY
                                    : 0),
                            opacity:
                                progress.value > 0 && tile.path.length > 1
                                    ? 0
                                    : 1, // Hide once pulled
                        }))}
                    />
                    <AnimatedG animatedProps={headProps}>
                        <G rotation={arrowAngle}>
                            <Polygon
                                points={`0,-${arrW} ${arrL},0 0,${arrW}`}
                                fill={actualColor}
                            />
                        </G>
                    </AnimatedG>
                </AnimatedG>
            );
        },
    ),
);
