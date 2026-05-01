import { useColorScheme } from 'nativewind';
import React, { useCallback, useMemo, useRef } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { TileData } from '../utils/movement';
import { ArrowTile, ArrowTileRef } from './ArrowTile';

const { width } = Dimensions.get('window');

interface GameBoardProps {
    board: TileData[];
    boardSize: number;
    shape: boolean[][];
    onTap: (tile: TileData, onExitAnimation: () => void) => void;
    isResetting: boolean;
    errorTileId: string | null;
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
    arrowColorOverride,
    boardThemeOverride,
}: GameBoardProps) {
    const { colorScheme } = useColorScheme();

    // Resolved arrow color — hoisted out of ArrowTile so we have a single
    // nativewind subscription regardless of how many tiles are on the board.
    const tileColor =
        arrowColorOverride || (colorScheme === 'dark' ? '#F9FAFB' : '#111827');

    // Theme application logic
    let dotColor = colorScheme === 'dark' ? '#374151' : '#D1D5DB';
    let bgClasses =
        'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

    if (boardThemeOverride === 'theme_ocean') {
        bgClasses =
            'bg-cyan-50 dark:bg-cyan-900/40 border-cyan-200 dark:border-cyan-800';
        dotColor = colorScheme === 'dark' ? '#155E75' : '#67E8F9'; // cyan-800 : cyan-300
    } else if (boardThemeOverride === 'theme_forest') {
        bgClasses =
            'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800';
        dotColor = colorScheme === 'dark' ? '#065F46' : '#6EE7B7'; // emerald-800 : emerald-300
    } else if (boardThemeOverride === 'theme_midnight') {
        bgClasses =
            'bg-slate-900 dark:bg-slate-950 border-slate-700 dark:border-slate-800';
        dotColor = '#334155';
    }

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
                // Circle proportional to cell size
                const r = Math.max(1, cellSize * 0.02);
                parts.push(
                    `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`,
                );
            }
        }
        return parts.join(' ');
    }, [boardSize, cellSize, shape]);

    // Spatial index: O(1) tap → tile lookup. Rebuilt only when `board` reference changes.
    // Tiles later in the array are higher z-index, so we walk in reverse and prefer
    // a head match over a body match for the same cell.
    const cellIndex = useMemo(() => {
        const heads = new Map<string, TileData>();
        const bodies = new Map<string, TileData>();
        for (let i = board.length - 1; i >= 0; i--) {
            const t = board[i];
            if (t.removed) continue;
            const head = t.path[t.path.length - 1];
            const headKey = `${head.x},${head.y}`;
            if (!heads.has(headKey)) heads.set(headKey, t);
            for (const p of t.path) {
                const key = `${p.x},${p.y}`;
                if (!bodies.has(key)) bodies.set(key, t);
            }
        }
        return { heads, bodies };
    }, [board]);

    const handleTapCell = useCallback(
        (x: number, y: number) => {
            // Ignore taps on inactive cells
            if (!shape[y]?.[x]) return;
            const key = `${x},${y}`;
            const tile = cellIndex.heads.get(key) ?? cellIndex.bodies.get(key);
            if (tile) {
                const ref = tileRefs.current[tile.id];
                onTap(tile, () => ref?.onExit());
            }
        },
        [cellIndex, shape, onTap],
    );

    return (
        <GestureDetector gesture={composed}>
            <View
                className={`flex-1 w-full items-center justify-center overflow-hidden rounded-2xl shadow-xl border relative ${bgClasses}`}
            >
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
                            position: 'relative',
                        }}
                    >
                        {/** The main SVG canvas drawing the exact paths based on logic */}
                        <Svg
                            width='100%'
                            height='100%'
                            style={{ position: 'absolute' }}
                        >
                            <Defs>
                                <ClipPath id='boardClip'>
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
                            <G clipPath='url(#boardClip)'>
                                {board
                                    .filter((tile) => !tile.removed)
                                    .map((tile) => (
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
                                            tileColor={tileColor}
                                        />
                                    ))}
                            </G>
                        </Svg>

                        {/** Single touch handler — replaces N×N Pressable components */}
                        <Pressable
                            style={{
                                position: 'absolute',
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
            </View>
        </GestureDetector>
    );
});
