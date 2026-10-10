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
    isHinted?: boolean;
    hintColor?: string;
    errorColor?: string;
    tileColor: string;
}

export interface ArrowTileRef {
    onExit: () => void;
}

export const ArrowTile = React.memo(
    forwardRef<ArrowTileRef, ArrowTileProps>(
        (
            {
                tile,
                cellSize,
                boardSize,
                isResetting,
                hasError,
                isHinted,
                tileColor,
                hintColor = "#0284C7",
                errorColor = "#DC2626",
            },
            ref,
        ) => {
            const actualColor = hasError
                ? errorColor
                : isHinted
                  ? hintColor
                  : tileColor;

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
                const order = Math.random() * 220;
                opacity.value = withDelay(
                    order,
                    withTiming(1, { duration: 260 }),
                );
            }, [opacity]);

            useEffect(() => {
                if (isResetting) {
                    opacity.value = withTiming(0, { duration: 220 });
                    progress.value = 0;
                }
            }, [isResetting, opacity, progress]);

            useEffect(() => {
                if (hasError) {
                    // Small bump in the escape direction then snap back simulating blocked impact
                    const bumpAmount = cellSize * 0.2;
                    progress.value = withSequence(
                        withTiming(bumpAmount, {
                            duration: 70,
                            easing: Easing.out(Easing.ease),
                        }),
                        withTiming(-bumpAmount * 0.5, { duration: 70 }),
                        withTiming(0, { duration: 70 }),
                    );
                }
            }, [hasError, cellSize, progress]);

            useImperativeHandle(ref, () => ({
                onExit: () => {
                    progress.value = withTiming(escapeDist, {
                        duration: 320,
                        easing: Easing.in(Easing.ease),
                    });
                    opacity.value = withDelay(
                        200,
                        withTiming(0, { duration: 120 }),
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

            const isSingle = tile.path.length === 1;
            const tailProps = useAnimatedProps(() => ({
                cx: M.x + (isSingle ? progress.value * dirX : 0),
                cy: M.y + (isSingle ? progress.value * dirY : 0),
                opacity: progress.value > 0 && !isSingle ? 0 : 1,
            }));

            const gProps = useAnimatedProps(() => ({
                opacity: opacity.value,
            }));

            const arrowAngle = { up: -90, right: 0, down: 90, left: 180 }[
                tile.direction
            ];
            const arrL = Math.max(4, cellSize * 0.3);
            const arrW = Math.max(2.5, cellSize * 0.18);

            return (
                <AnimatedG animatedProps={gProps}>
                    {isHinted && (
                        <Circle
                            cx={pts[pts.length - 1].x}
                            cy={pts[pts.length - 1].y}
                            r={cellSize * 0.48}
                            fill="none"
                            stroke={hintColor}
                            strokeWidth={2}
                            strokeDasharray="3 3"
                        />
                    )}
                    <AnimatedPath
                        d={pathString}
                        stroke={actualColor}
                        strokeWidth={Math.max(1.8, cellSize * 0.085)}
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
                        r={Math.max(0.9, cellSize * 0.0425)}
                        fill={actualColor}
                        animatedProps={tailProps}
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
