import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    LayoutChangeEvent,
    Platform,
    Pressable,
    Text,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";
import { TileData } from "../utils/movement";
import { getReadableArrowColor } from "../utils/colors";
import { ArrowTile, ArrowTileRef } from "./ArrowTile";

interface GameBoardProps {
    board: TileData[];
    boardSize: number;
    shape: boolean[][];
    onTap: (tile: TileData, onExitAnimation: () => void) => void;
    isResetting: boolean;
    errorTileId: string | null;
    hintTileId?: string | null;
    arrowColorOverride?: string | null;
    boardThemeOverride?: string | null;
}

export const GameBoard = React.memo(function GameBoard({
    board,
    boardSize,
    shape,
    onTap,
    isResetting,
    errorTileId,
    hintTileId,
    arrowColorOverride,
    boardThemeOverride,
}: GameBoardProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const midnight = boardThemeOverride === "theme_midnight";
    const darkBoard = isDark || midnight;
    const [layout, setLayout] = useState({ width: 320, height: 420 });
    const [showGuides, setShowGuides] = useState(false);
    const backgroundColor = midnight
        ? "#0F172A"
        : boardThemeOverride === "theme_ocean"
          ? isDark
              ? "#12333E"
              : "#ECFEFF"
          : boardThemeOverride === "theme_forest"
            ? isDark
                ? "#12382C"
                : "#ECFDF5"
            : isDark
              ? "#172033"
              : "#FFFFFF";
    const tileColor = getReadableArrowColor(
        arrowColorOverride || (darkBoard ? "#F9FAFB" : "#172033"),
        backgroundColor,
    );
    const hintColor = getReadableArrowColor("#0EA5E9", backgroundColor);
    const errorColor = getReadableArrowColor("#EF4444", backgroundColor);
    const padding = 18;
    const canvasSize = Math.max(
        80,
        Math.min(layout.width - padding * 2, layout.height - padding * 2),
    );
    const cellSize = canvasSize / boardSize;
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedX = useSharedValue(0);
    const savedY = useSharedValue(0);
    const gestureActivity = useRef({
        pan: false,
        pinch: false,
        suppressUntil: 0,
    });
    const tileRefs = useRef<Record<string, ArrowTileRef | null>>({});

    const fit = useCallback(() => {
        scale.value = savedScale.value = 1;
        translateX.value = savedX.value = 0;
        translateY.value = savedY.value = 0;
    }, [scale, savedScale, translateX, translateY, savedX, savedY]);
    useEffect(() => {
        fit();
    }, [shape, layout.width, layout.height, fit]);

    const navigationStart = useCallback((kind: "pan" | "pinch") => {
        gestureActivity.current[kind] = true;
    }, []);
    const navigationEnd = useCallback((kind: "pan" | "pinch") => {
        if (gestureActivity.current[kind])
            gestureActivity.current.suppressUntil = Date.now() + 120;
        gestureActivity.current[kind] = false;
    }, []);
    const pinch = Gesture.Pinch()
        .runOnJS(true)
        .onStart(() => navigationStart("pinch"))
        .onUpdate((e) => {
            scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 4));
        })
        .onFinalize(() => {
            savedScale.value = scale.value;
            const bound = (canvasSize * (scale.value - 1)) / 2;
            translateX.value = savedX.value = Math.max(
                -bound,
                Math.min(bound, translateX.value),
            );
            translateY.value = savedY.value = Math.max(
                -bound,
                Math.min(bound, translateY.value),
            );
            navigationEnd("pinch");
        });
    const pan = Gesture.Pan()
        .minDistance(10)
        .maxPointers(1)
        .runOnJS(true)
        .onStart(() => navigationStart("pan"))
        .onUpdate((e) => {
            const bound = (canvasSize * (scale.value - 1)) / 2;
            translateX.value = Math.max(
                -bound,
                Math.min(bound, savedX.value + e.translationX),
            );
            translateY.value = Math.max(
                -bound,
                Math.min(bound, savedY.value + e.translationY),
            );
        })
        .onFinalize(() => {
            savedX.value = translateX.value;
            savedY.value = translateY.value;
            navigationEnd("pan");
        });
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));
    const zoom = (delta: number) => {
        scale.value = savedScale.value = Math.max(
            1,
            Math.min(4, scale.value + delta),
        );
        const bound = (canvasSize * (scale.value - 1)) / 2;
        translateX.value = savedX.value = Math.max(
            -bound,
            Math.min(bound, translateX.value),
        );
        translateY.value = savedY.value = Math.max(
            -bound,
            Math.min(bound, translateY.value),
        );
    };
    const cells = useMemo(() => {
        const result = new Map<string, TileData>();
        for (const tile of board) {
            if (!tile.removed)
                for (const p of tile.path) result.set(`${p.x},${p.y}`, tile);
        }
        return result;
    }, [board]);
    const dots = useMemo(() => {
        const paths: string[] = [];
        shape.forEach((row, y) =>
            row.forEach((active, x) => {
                if (!active) return;
                const cx = (x + 0.5) * cellSize,
                    cy = (y + 0.5) * cellSize,
                    r = Math.max(0.8, cellSize * 0.035);
                paths.push(
                    `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`,
                );
            }),
        );
        return paths.join(" ");
    }, [shape, cellSize]);
    const guides = useMemo(
        () =>
            board
                .filter((t) => !t.removed)
                .map((tile) => {
                    const head = tile.path[tile.path.length - 1];
                    const dx =
                        tile.direction === "right"
                            ? 1
                            : tile.direction === "left"
                              ? -1
                              : 0;
                    const dy =
                        tile.direction === "down"
                            ? 1
                            : tile.direction === "up"
                              ? -1
                              : 0;
                    let x = head.x + dx,
                        y = head.y + dy;
                    let blocker: { x: number; y: number } | null = null;
                    while (
                        x >= 0 &&
                        y >= 0 &&
                        x < boardSize &&
                        y < boardSize &&
                        shape[y][x]
                    ) {
                        if (cells.has(`${x},${y}`)) {
                            blocker = { x, y };
                            break;
                        }
                        x += dx;
                        y += dy;
                    }
                    return {
                        id: tile.id,
                        blocker,
                        d: `M ${(head.x + 0.5) * cellSize},${(head.y + 0.5) * cellSize} L ${(x + 0.5) * cellSize},${(y + 0.5) * cellSize}`,
                    };
                }),
        [board, cells, shape, boardSize, cellSize],
    );
    const errorGuide = guides.find((g) => g.id === errorTileId);
    const onLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setLayout((prev) =>
            prev.width === width && prev.height === height
                ? prev
                : { width, height },
        );
    };
    const controlClass =
        "min-w-[44px] h-11 px-3 items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700";
    return (
        <View className="flex-1 w-full" style={{ minHeight: 160 }}>
            <View
                className="flex-1 w-full rounded-3xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                onLayout={onLayout}
                style={{ backgroundColor }}
            >
                <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
                    <View
                        className="flex-1 items-center justify-center"
                        style={{ overflow: "hidden" }}
                    >
                        <Animated.View
                            style={[
                                { width: canvasSize, height: canvasSize },
                                animatedStyle,
                            ]}
                        >
                            <Svg
                                width={canvasSize}
                                height={canvasSize}
                                style={{ position: "absolute" }}
                            >
                                <Defs>
                                    <ClipPath id="boardClip">
                                        <Rect
                                            x={0}
                                            y={0}
                                            width={canvasSize}
                                            height={canvasSize}
                                        />
                                    </ClipPath>
                                </Defs>
                                <Path
                                    d={dots}
                                    fill={darkBoard ? "#475569" : "#CBD5E1"}
                                />
                                <G clipPath="url(#boardClip)">
                                    {guides
                                        .filter(
                                            (g) =>
                                                showGuides ||
                                                g.id === hintTileId ||
                                                g.id === errorTileId,
                                        )
                                        .map((g) => (
                                            <Path
                                                key={g.id}
                                                d={g.d}
                                                stroke={
                                                    g.id === errorTileId
                                                        ? errorColor
                                                        : hintColor
                                                }
                                                strokeWidth={
                                                    g.id === errorTileId
                                                        ? 2.5
                                                        : 1.5
                                                }
                                                strokeDasharray="3 4"
                                                opacity={
                                                    g.id === errorTileId ||
                                                    g.id === hintTileId
                                                        ? 1
                                                        : 0.35
                                                }
                                            />
                                        ))}
                                    {board
                                        .filter((t) => !t.removed)
                                        .map((tile) => (
                                            <ArrowTile
                                                key={tile.id}
                                                ref={(el) => {
                                                    if (el)
                                                        tileRefs.current[
                                                            tile.id
                                                        ] = el;
                                                    else
                                                        delete tileRefs.current[
                                                            tile.id
                                                        ];
                                                }}
                                                tile={tile}
                                                cellSize={cellSize}
                                                boardSize={boardSize}
                                                isResetting={isResetting}
                                                hasError={
                                                    errorTileId === tile.id
                                                }
                                                isHinted={
                                                    hintTileId === tile.id
                                                }
                                                tileColor={tileColor}
                                                hintColor={hintColor}
                                                errorColor={errorColor}
                                            />
                                        ))}
                                    {errorGuide?.blocker && (
                                        <Circle
                                            cx={
                                                (errorGuide.blocker.x + 0.5) *
                                                cellSize
                                            }
                                            cy={
                                                (errorGuide.blocker.y + 0.5) *
                                                cellSize
                                            }
                                            r={cellSize * 0.32}
                                            stroke={errorColor}
                                            strokeWidth={2}
                                            fill="none"
                                        />
                                    )}
                                </G>
                            </Svg>
                            <Pressable
                                testID="game-board"
                                accessibilityLabel="Puzzle board. Tap an arrow with a clear exit."
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                }}
                                onPress={(e) => {
                                    if (
                                        gestureActivity.current.pan ||
                                        gestureActivity.current.pinch ||
                                        Date.now() <
                                            gestureActivity.current
                                                .suppressUntil ||
                                        isResetting
                                    )
                                        return;
                                    let localX = e.nativeEvent.locationX,
                                        localY = e.nativeEvent.locationY;
                                    if (Platform.OS === "web") {
                                        // RN Web onPress supplies a MouseEvent. Convert screen pixels
                                        // through the transformed rectangle so zoomed taps stay accurate.
                                        const mouse =
                                            e.nativeEvent as unknown as {
                                                clientX: number;
                                                clientY: number;
                                            };
                                        const target =
                                            e.currentTarget as unknown as {
                                                getBoundingClientRect(): {
                                                    left: number;
                                                    top: number;
                                                    width: number;
                                                    height: number;
                                                };
                                            };
                                        const rect =
                                            target.getBoundingClientRect();
                                        localX =
                                            ((mouse.clientX - rect.left) *
                                                canvasSize) /
                                            rect.width;
                                        localY =
                                            ((mouse.clientY - rect.top) *
                                                canvasSize) /
                                            rect.height;
                                    }
                                    const x = Math.floor(localX / cellSize),
                                        y = Math.floor(localY / cellSize);
                                    if (!shape[y]?.[x]) return;
                                    const tile = cells.get(`${x},${y}`);
                                    if (tile)
                                        onTap(tile, () =>
                                            tileRefs.current[tile.id]?.onExit(),
                                        );
                                }}
                            />
                        </Animated.View>
                    </View>
                </GestureDetector>
            </View>
            <View className="flex-row items-center justify-between pt-2 pb-1">
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Toggle exit guides"
                    accessibilityState={{ selected: showGuides }}
                    onPress={() => setShowGuides((v) => !v)}
                    className={`${controlClass} flex-row gap-1.5`}
                >
                    <Ionicons
                        name="grid-outline"
                        size={17}
                        color={showGuides ? "#6366F1" : "#64748B"}
                    />
                    <Text className="text-xs font-bold text-gray-600 dark:text-gray-300">
                        Guides {showGuides ? "on" : "off"}
                    </Text>
                </Pressable>
                <View className="flex-row gap-2">
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Zoom out"
                        onPress={() => zoom(-0.5)}
                        className={controlClass}
                    >
                        <Ionicons name="remove" size={20} color="#64748B" />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Fit board"
                        onPress={fit}
                        className={controlClass}
                    >
                        <Text className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            Fit
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Zoom in"
                        onPress={() => zoom(0.5)}
                        className={controlClass}
                    >
                        <Ionicons name="add" size={20} color="#64748B" />
                    </Pressable>
                </View>
            </View>
        </View>
    );
});
