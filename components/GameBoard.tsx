import { useColorScheme } from "nativewind";
import React, { useMemo, useRef } from "react";
import { Dimensions, Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import Svg, { ClipPath, Defs, G, Path, Rect } from "react-native-svg";
import { TileData } from "../utils/movement";
import { ArrowTile, ArrowTileRef } from "./ArrowTile";

const { width } = Dimensions.get("window");

interface GameBoardProps {
    board: TileData[];
    boardSize: number;
    shape: boolean[][];
    onTap: (tile: TileData, onExitAnimation: () => void) => void;
    isResetting: boolean;
    errorTileId: string | null;
}

export function GameBoard({
    board,
    boardSize,
    shape,
    onTap,
    isResetting,
    errorTileId,
}: GameBoardProps) {
    const { colorScheme } = useColorScheme();
    const dotColor = colorScheme === "dark" ? "#374151" : "#D1D5DB";

    const paddingBoard = 12;
    const availableWidth = width - 24;
    const cellSize = Math.floor(
        (availableWidth - paddingBoard * 2) / boardSize,
    );
    const boardPixelSize = boardSize * cellSize;

    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const pinch = Gesture.Pinch()
        .onUpdate((e) => {
            const minScale = boardSize <= 10 ? 1.0 : 0.8;
            scale.value = Math.max(
                minScale,
                Math.min(savedScale.value * e.scale, 4),
            );
        })
        .onEnd(() => {
            savedScale.value = scale.value;
        });

    const pan = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onUpdate((e) => {
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const composed = Gesture.Simultaneous(pinch, pan);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    // Track tile refs for imperative animations
    const tileRefs = useRef<Record<string, ArrowTileRef | null>>({});

    // Build a single SVG path for all dots (only active shape cells)
    const dotsPath = useMemo(() => {
        const parts: string[] = [];
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (!shape[y]?.[x]) continue;
                const cx = x * cellSize + cellSize / 2;
                const cy = y * cellSize + cellSize / 2;
                // Small circle as arc path (radius 1.5)
                parts.push(
                    `M ${cx - 1.5},${cy} a 1.5,1.5 0 1,0 3,0 a 1.5,1.5 0 1,0 -3,0`,
                );
            }
        }
        return parts.join(" ");
    }, [boardSize, cellSize, shape]);

    const handleTapCell = (x: number, y: number) => {
        // Ignore taps on inactive cells
        if (!shape[y]?.[x]) return;

        // Find highest z-index path that occupies this cell
        // Prioritize tapping the actual "head" of an arrow over intersecting paths
        const reversedBoard = [...board].reverse();
        const headTile = reversedBoard.find(
            (t) =>
                !t.removed &&
                t.path[t.path.length - 1].x === x &&
                t.path[t.path.length - 1].y === y,
        );
        const tile =
            headTile ||
            reversedBoard.find(
                (t) => !t.removed && t.path.some((p) => p.x === x && p.y === y),
            );

        if (tile) {
            const ref = tileRefs.current[tile.id];
            onTap(tile, () => ref?.onExit());
        }
    };

    return (
        <View className="flex-1 w-full items-center justify-center overflow-hidden rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 relative">
            <GestureDetector gesture={composed}>
                <Animated.View
                    style={[
                        {
                            width: boardPixelSize + paddingBoard * 2,
                            height: boardPixelSize + paddingBoard * 2,
                            padding: paddingBoard,
                        },
                        animatedStyle,
                    ]}
                >
                    <View
                        style={{
                            width: boardPixelSize,
                            height: boardPixelSize,
                            position: "relative",
                        }}
                    >
                        {/** The main SVG canvas drawing the exact paths based on logic */}
                        <Svg
                            width="100%"
                            height="100%"
                            style={{ position: "absolute" }}
                        >
                            <Defs>
                                <ClipPath id="boardClip">
                                    <Rect
                                        x={0}
                                        y={0}
                                        width={boardPixelSize}
                                        height={boardPixelSize}
                                    />
                                </ClipPath>
                            </Defs>
                            {/* Single batched path for all dots — replaces N×N Circle elements */}
                            <Path d={dotsPath} fill={dotColor} />
                            <G clipPath="url(#boardClip)">
                                {board.map((tile) => (
                                    <ArrowTile
                                        key={tile.id}
                                        ref={(el) => {
                                            tileRefs.current[tile.id] = el;
                                        }}
                                        tile={tile}
                                        cellSize={cellSize}
                                        boardSize={boardSize}
                                        isResetting={isResetting}
                                        hasError={errorTileId === tile.id}
                                    />
                                ))}
                            </G>
                        </Svg>

                        {/** Single touch handler — replaces N×N Pressable components */}
                        <Pressable
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                            }}
                            onPress={(e) => {
                                const x = Math.floor(
                                    e.nativeEvent.locationX / cellSize,
                                );
                                const y = Math.floor(
                                    e.nativeEvent.locationY / cellSize,
                                );
                                if (
                                    x >= 0 &&
                                    x < boardSize &&
                                    y >= 0 &&
                                    y < boardSize
                                ) {
                                    handleTapCell(x, y);
                                }
                            }}
                        />
                    </View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}
