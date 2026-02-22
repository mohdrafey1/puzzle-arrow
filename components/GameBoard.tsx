import { useColorScheme } from "nativewind";
import React, { useRef } from "react";
import { Dimensions, Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, G, Rect } from "react-native-svg";
import { TileData } from "../utils/movement";
import { ArrowTile, ArrowTileRef } from "./ArrowTile";

const { width } = Dimensions.get("window");

interface GameBoardProps {
    board: TileData[];
    boardSize: number;
    onTap: (tile: TileData, onExitAnimation: () => void) => void;
    isResetting: boolean;
    errorTileId: string | null;
}

export function GameBoard({
    board,
    boardSize,
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
            scale.value = Math.max(
                0.5,
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

    // Virtual cell matrix grid to capture taps exactly over cell indices instead of complex SVG hits
    const cells = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            cells.push({ x, y });
        }
    }

    const handleTapCell = (x: number, y: number) => {
        // Find highest z-index path that occupies this cell
        // Since board is mapped reverse from generation, last elements in array are drawn on top,
        // wait, we map forward, so last is on top. We search reversed.
        const tile = [...board]
            .reverse()
            .find(
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
                            {cells.map((c) => (
                                <Circle
                                    key={`dot-${c.x}-${c.y}`}
                                    cx={c.x * cellSize + cellSize / 2}
                                    cy={c.y * cellSize + cellSize / 2}
                                    r={3}
                                    fill={dotColor}
                                />
                            ))}
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

                        {/** Invisible absolutely positioned touch grid map overlays */}
                        <View
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                flexWrap: "wrap",
                                flexDirection: "row",
                            }}
                        >
                            {cells.map((c) => (
                                <Pressable
                                    key={`${c.x}-${c.y}`}
                                    onPress={() => handleTapCell(c.x, c.y)}
                                    style={{
                                        width: cellSize,
                                        height: cellSize,
                                    }}
                                />
                            ))}
                        </View>
                    </View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}
