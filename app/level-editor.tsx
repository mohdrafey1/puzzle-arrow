import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import Svg, { Circle, G, Line, Polygon, Rect } from "react-native-svg";
import { submitCommunityLevel } from "../utils/communityLevels";
import { Direction, Point } from "../utils/movement";
import {
    isPreviewPassed,
    resetPreviewPassed,
    setPreviewLevel,
} from "../utils/previewLevel";
import { getLeaderboardUsername } from "../utils/storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PlacedArrow {
    path: Point[];
    direction: Direction;
}

const DIRECTIONS: { dir: Direction; icon: string; label: string }[] = [
    { dir: "up", icon: "arrow-up", label: "↑" },
    { dir: "down", icon: "arrow-down", label: "↓" },
    { dir: "left", icon: "arrow-back", label: "←" },
    { dir: "right", icon: "arrow-forward", label: "→" },
];

export default function LevelEditor() {
    const router = useRouter();
    const [gridSize, setGridSize] = useState(6);
    const [arrows, setArrows] = useState<PlacedArrow[]>([]);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [selectedDirection, setSelectedDirection] =
        useState<Direction>("right");
    const [copied, setCopied] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [playTestPassed, setPlayTestPassed] = useState(false);

    // Check if the user returned from a successful play test
    useFocusEffect(
        useCallback(() => {
            if (isPreviewPassed()) {
                setPlayTestPassed(true);
                resetPreviewPassed(); // consume the flag so it doesn't persist
            }
        }, []),
    );

    // Board layout
    const padding = 16;
    const availableWidth = SCREEN_WIDTH - padding * 2 - 24;
    const cellSize = Math.floor(availableWidth / gridSize);
    const boardPixelSize = gridSize * cellSize;

    // Track which cells are occupied by placed arrows
    const occupiedCells = useMemo(() => {
        const set = new Set<string>();
        arrows.forEach((a) => {
            a.path.forEach((p) => set.add(`${p.x},${p.y}`));
        });
        return set;
    }, [arrows]);

    // Track which cells are in the current drawing path
    const currentPathSet = useMemo(() => {
        const set = new Set<string>();
        currentPath.forEach((p) => set.add(`${p.x},${p.y}`));
        return set;
    }, [currentPath]);

    const handleCellTap = useCallback(
        (x: number, y: number) => {
            const key = `${x},${y}`;

            // If cell is occupied by a placed arrow, ignore tap (use long press to delete)
            if (occupiedCells.has(key)) return;

            // If cell is already in current path, remove it (undo last)
            if (currentPathSet.has(key)) {
                const idx = currentPath.findIndex(
                    (p) => p.x === x && p.y === y,
                );
                if (idx === currentPath.length - 1) {
                    // Undo last point
                    setCurrentPath((prev) => prev.slice(0, -1));
                }
                return;
            }

            // First cell — just add it
            if (currentPath.length === 0) {
                setCurrentPath([{ x, y }]);
                return;
            }

            const last = currentPath[currentPath.length - 1];
            const dx = Math.abs(x - last.x);
            const dy = Math.abs(y - last.y);

            // Adjacent cell — add directly
            if (dx + dy === 1) {
                setCurrentPath((prev) => [...prev, { x, y }]);
                return;
            }

            // Non-adjacent — BFS to find shortest path from last to target
            // avoiding occupied cells and cells already in the current path
            const blocked = new Set<string>([
                ...occupiedCells,
                ...currentPathSet,
            ]);
            const dirs = [
                [0, 1],
                [0, -1],
                [1, 0],
                [-1, 0],
            ];
            const queue: { x: number; y: number; path: Point[] }[] = [
                { x: last.x, y: last.y, path: [] },
            ];
            const visited = new Set<string>([`${last.x},${last.y}`]);

            while (queue.length > 0) {
                const curr = queue.shift()!;
                for (const [ddx, ddy] of dirs) {
                    const nx = curr.x + ddx;
                    const ny = curr.y + ddy;
                    const nk = `${nx},${ny}`;

                    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize)
                        continue;
                    if (visited.has(nk)) continue;
                    if (blocked.has(nk) && !(nx === x && ny === y)) continue;

                    const newPath = [...curr.path, { x: nx, y: ny }];

                    if (nx === x && ny === y) {
                        // Found target — append entire path
                        setCurrentPath((prev) => [...prev, ...newPath]);
                        return;
                    }

                    visited.add(nk);
                    queue.push({ x: nx, y: ny, path: newPath });
                }
            }
            // No path found — ignore tap
        },
        [currentPath, currentPathSet, occupiedCells, gridSize],
    );

    const handleCellLongPress = useCallback(
        (x: number, y: number) => {
            const key = `${x},${y}`;
            if (occupiedCells.has(key)) {
                setArrows((prev) =>
                    prev.filter(
                        (a) => !a.path.some((p) => p.x === x && p.y === y),
                    ),
                );
                setPlayTestPassed(false);
            }
        },
        [occupiedCells],
    );

    const addArrow = useCallback(() => {
        if (currentPath.length === 0) return;
        setArrows((prev) => [
            ...prev,
            { path: [...currentPath], direction: selectedDirection },
        ]);
        setCurrentPath([]);
        setPlayTestPassed(false); // arrows changed, need re-test
    }, [currentPath, selectedDirection]);

    const clearAll = useCallback(() => {
        setArrows([]);
        setCurrentPath([]);
        setPlayTestPassed(false);
    }, []);

    const cancelPath = useCallback(() => {
        setCurrentPath([]);
    }, []);

    const changeGridSize = useCallback(
        (delta: number) => {
            const newSize = Math.max(4, Math.min(15, gridSize + delta));
            if (newSize !== gridSize) {
                setGridSize(newSize);
                setArrows([]);
                setCurrentPath([]);
                setPlayTestPassed(false);
            }
        },
        [gridSize],
    );

    const exportJSON = useCallback(async () => {
        const level = {
            id: 0,
            size: gridSize,
            tiles: arrows.map((a) => ({
                path: a.path,
                direction: a.direction,
            })),
        };
        const json = JSON.stringify(level, null, 2);
        await Clipboard.setStringAsync(json);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        Alert.alert("Copied!", "Level JSON copied to clipboard.");
    }, [gridSize, arrows]);

    const playTest = useCallback(() => {
        if (arrows.length === 0) return;
        const shape = Array.from({ length: gridSize }, () =>
            Array.from({ length: gridSize }, () => true),
        );
        setPreviewLevel({
            id: 0,
            size: gridSize,
            shape,
            tiles: arrows.map((a) => ({
                path: a.path,
                direction: a.direction,
            })),
        });
        router.push("/game/0?source=editor" as any);
    }, [gridSize, arrows, router]);

    const submitToCommunity = useCallback(async () => {
        if (arrows.length === 0) return;
        const username = await getLeaderboardUsername();
        if (!username) {
            Alert.alert(
                "Username Required",
                "Set a username in the Community or Leaderboard tab first.",
            );
            return;
        }
        setSubmitting(true);
        try {
            const tiles = arrows.map((a) => ({
                path: a.path,
                direction: a.direction,
            }));
            await submitCommunityLevel(username, gridSize, tiles);
            Alert.alert(
                "Shared! 🎉",
                "Your level is now live in the Community tab.",
                [{ text: "OK", onPress: () => router.back() }],
            );
        } catch (err: any) {
            Alert.alert(
                "Error",
                err?.message || "Failed to submit. Check your connection.",
            );
        } finally {
            setSubmitting(false);
        }
    }, [arrows, gridSize, router]);

    // Render a placed arrow as SVG
    const renderArrow = (arrow: PlacedArrow, index: number) => {
        const pts = arrow.path.map((p) => ({
            x: p.x * cellSize + cellSize / 2,
            y: p.y * cellSize + cellSize / 2,
        }));

        const lines = [];
        for (let i = 0; i < pts.length - 1; i++) {
            lines.push(
                <Line
                    key={`arrow-${index}-line-${i}`}
                    x1={pts[i].x}
                    y1={pts[i].y}
                    x2={pts[i + 1].x}
                    y2={pts[i + 1].y}
                    stroke="#3B82F6"
                    strokeWidth={cellSize * 0.1}
                    strokeLinecap="round"
                />,
            );
        }

        // Arrowhead at the last point
        const head = pts[pts.length - 1];
        const arrowAngle = { up: -90, right: 0, down: 90, left: 180 }[
            arrow.direction
        ];
        const arrL = cellSize * 0.3;
        const arrW = cellSize * 0.2;

        // Tail dot
        const tail = pts[0];

        return (
            <G key={`arrow-${index}`}>
                {lines}
                <Circle
                    cx={tail.x}
                    cy={tail.y}
                    r={cellSize * 0.06}
                    fill="#3B82F6"
                />
                <G
                    transform={`translate(${head.x}, ${head.y}) rotate(${arrowAngle})`}
                >
                    <Polygon
                        points={`0,-${arrW} ${arrL},0 0,${arrW}`}
                        fill="#3B82F6"
                    />
                </G>
            </G>
        );
    };

    // Render the current drawing path
    const renderCurrentPath = () => {
        if (currentPath.length === 0) return null;
        const pts = currentPath.map((p) => ({
            x: p.x * cellSize + cellSize / 2,
            y: p.y * cellSize + cellSize / 2,
        }));

        const lines = [];
        for (let i = 0; i < pts.length - 1; i++) {
            lines.push(
                <Line
                    key={`cur-line-${i}`}
                    x1={pts[i].x}
                    y1={pts[i].y}
                    x2={pts[i + 1].x}
                    y2={pts[i + 1].y}
                    stroke="#F59E0B"
                    strokeWidth={cellSize * 0.1}
                    strokeLinecap="round"
                    strokeDasharray={`${cellSize * 0.15} ${cellSize * 0.1}`}
                />,
            );
        }

        // Direction preview arrowhead at last point
        const head = pts[pts.length - 1];
        const arrowAngle = { up: -90, right: 0, down: 90, left: 180 }[
            selectedDirection
        ];
        const arrL = cellSize * 0.3;
        const arrW = cellSize * 0.2;

        return (
            <G>
                {lines}
                {pts.map((p, i) => (
                    <Circle
                        key={`cur-dot-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={cellSize * 0.08}
                        fill="#F59E0B"
                    />
                ))}
                <G
                    transform={`translate(${head.x}, ${head.y}) rotate(${arrowAngle})`}
                >
                    <Polygon
                        points={`0,-${arrW} ${arrL},0 0,${arrW}`}
                        fill="#F59E0B"
                        opacity={0.7}
                    />
                </G>
            </G>
        );
    };

    return (
        <View className="flex-1 bg-gray-50 dark:bg-gray-900 pt-12">
            {/* Header */}
            <View className="flex-row items-center px-4 mb-4">
                <Pressable onPress={() => router.back()} className="mr-3 p-2">
                    <Ionicons name="arrow-back" size={24} color="#3B82F6" />
                </Pressable>
                <Text className="text-2xl font-black text-gray-900 dark:text-gray-100 flex-1">
                    Level Editor
                </Text>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Grid Size Control */}
                <View className="flex-row items-center justify-center gap-4 mb-4 px-4">
                    <Text className="text-gray-500 dark:text-gray-400 font-bold text-sm uppercase tracking-widest">
                        Grid
                    </Text>
                    <Pressable
                        onPress={() => changeGridSize(-1)}
                        className="bg-gray-200 dark:bg-gray-700 w-10 h-10 rounded-xl items-center justify-center active:bg-gray-300"
                    >
                        <Ionicons name="remove" size={22} color="#6B7280" />
                    </Pressable>
                    <Text className="text-3xl font-black text-gray-900 dark:text-white w-12 text-center">
                        {gridSize}
                    </Text>
                    <Pressable
                        onPress={() => changeGridSize(1)}
                        className="bg-gray-200 dark:bg-gray-700 w-10 h-10 rounded-xl items-center justify-center active:bg-gray-300"
                    >
                        <Ionicons name="add" size={22} color="#6B7280" />
                    </Pressable>
                </View>

                {/* Board */}
                <View className="items-center mb-4">
                    <View
                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                        style={{
                            width: boardPixelSize + padding,
                            height: boardPixelSize + padding,
                            padding: padding / 2,
                        }}
                    >
                        <Svg width={boardPixelSize} height={boardPixelSize}>
                            {/* Grid cells */}
                            {Array.from({ length: gridSize }).map((_, y) =>
                                Array.from({ length: gridSize }).map((_, x) => {
                                    const key = `${x},${y}`;
                                    const isOccupied = occupiedCells.has(key);
                                    const isInPath = currentPathSet.has(key);

                                    return (
                                        <Rect
                                            key={key}
                                            x={x * cellSize + 1}
                                            y={y * cellSize + 1}
                                            width={cellSize - 2}
                                            height={cellSize - 2}
                                            rx={cellSize * 0.1}
                                            fill={
                                                isInPath
                                                    ? "#FEF3C7"
                                                    : isOccupied
                                                      ? "#DBEAFE"
                                                      : "#F9FAFB"
                                            }
                                            stroke={
                                                isInPath
                                                    ? "#F59E0B"
                                                    : isOccupied
                                                      ? "#93C5FD"
                                                      : "#E5E7EB"
                                            }
                                            strokeWidth={1}
                                        />
                                    );
                                }),
                            )}

                            {/* Placed arrows */}
                            {arrows.map((a, i) => renderArrow(a, i))}

                            {/* Current drawing path */}
                            {renderCurrentPath()}

                            {/* Cell labels for small grids */}
                            {gridSize <= 8 &&
                                Array.from({ length: gridSize }).map((_, y) =>
                                    Array.from({ length: gridSize }).map(
                                        (_, x) => (
                                            <Circle
                                                key={`dot-${x}-${y}`}
                                                cx={x * cellSize + cellSize / 2}
                                                cy={y * cellSize + cellSize / 2}
                                                r={cellSize * 0.04}
                                                fill="#D1D5DB"
                                                opacity={
                                                    occupiedCells.has(
                                                        `${x},${y}`,
                                                    ) ||
                                                    currentPathSet.has(
                                                        `${x},${y}`,
                                                    )
                                                        ? 0
                                                        : 0.5
                                                }
                                            />
                                        ),
                                    ),
                                )}
                        </Svg>

                        {/* Touch overlay */}
                        <Pressable
                            style={{
                                position: "absolute",
                                top: padding / 2,
                                left: padding / 2,
                                width: boardPixelSize,
                                height: boardPixelSize,
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
                                    x < gridSize &&
                                    y >= 0 &&
                                    y < gridSize
                                ) {
                                    handleCellTap(x, y);
                                }
                            }}
                            onLongPress={(e) => {
                                const x = Math.floor(
                                    e.nativeEvent.locationX / cellSize,
                                );
                                const y = Math.floor(
                                    e.nativeEvent.locationY / cellSize,
                                );
                                if (
                                    x >= 0 &&
                                    x < gridSize &&
                                    y >= 0 &&
                                    y < gridSize
                                ) {
                                    handleCellLongPress(x, y);
                                }
                            }}
                            delayLongPress={400}
                        />
                    </View>
                </View>

                {/* Direction Picker */}
                <View className="px-4 mb-4">
                    <Text className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest mb-2 text-center">
                        Arrow Direction
                    </Text>
                    <View className="flex-row justify-center gap-3">
                        {DIRECTIONS.map(({ dir, icon }) => (
                            <Pressable
                                key={dir}
                                onPress={() => setSelectedDirection(dir)}
                                className={`w-14 h-14 rounded-2xl items-center justify-center border-2 ${
                                    selectedDirection === dir
                                        ? "bg-blue-500 border-blue-600"
                                        : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                }`}
                            >
                                <Ionicons
                                    name={icon as any}
                                    size={24}
                                    color={
                                        selectedDirection === dir
                                            ? "#FFFFFF"
                                            : "#6B7280"
                                    }
                                />
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="px-4 gap-3">
                    {/* Add Arrow */}
                    <Pressable
                        onPress={addArrow}
                        disabled={currentPath.length === 0}
                        className={`rounded-2xl py-4 items-center ${
                            currentPath.length === 0
                                ? "bg-gray-200 dark:bg-gray-800"
                                : "bg-amber-500 active:bg-amber-600"
                        }`}
                    >
                        <View className="flex-row items-center gap-2">
                            <Ionicons
                                name="add-circle"
                                size={22}
                                color={
                                    currentPath.length === 0
                                        ? "#9CA3AF"
                                        : "#FFFFFF"
                                }
                            />
                            <Text
                                className={`font-bold text-base ${
                                    currentPath.length === 0
                                        ? "text-gray-400"
                                        : "text-white"
                                }`}
                            >
                                Add Arrow ({currentPath.length} cells)
                            </Text>
                        </View>
                    </Pressable>

                    {/* Cancel Path */}
                    {currentPath.length > 0 && (
                        <Pressable
                            onPress={cancelPath}
                            className="rounded-2xl py-3 items-center bg-gray-200 dark:bg-gray-800 active:bg-gray-300"
                        >
                            <Text className="text-gray-600 dark:text-gray-400 font-bold text-sm">
                                Cancel Drawing
                            </Text>
                        </Pressable>
                    )}

                    {/* Row: Clear All + Export (dev only) */}
                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={clearAll}
                            disabled={
                                arrows.length === 0 && currentPath.length === 0
                            }
                            className={`flex-1 rounded-2xl py-4 items-center ${
                                arrows.length === 0 && currentPath.length === 0
                                    ? "bg-gray-200 dark:bg-gray-800"
                                    : "bg-red-500 active:bg-red-600"
                            }`}
                        >
                            <View className="flex-row items-center gap-2">
                                <Ionicons
                                    name="trash"
                                    size={20}
                                    color={
                                        arrows.length === 0 &&
                                        currentPath.length === 0
                                            ? "#9CA3AF"
                                            : "#FFFFFF"
                                    }
                                />
                                <Text
                                    className={`font-bold text-sm ${
                                        arrows.length === 0 &&
                                        currentPath.length === 0
                                            ? "text-gray-400"
                                            : "text-white"
                                    }`}
                                >
                                    Clear All
                                </Text>
                            </View>
                        </Pressable>

                        {__DEV__ && (
                            <Pressable
                                onPress={exportJSON}
                                disabled={arrows.length === 0}
                                className={`flex-1 rounded-2xl py-4 items-center ${
                                    arrows.length === 0
                                        ? "bg-gray-200 dark:bg-gray-800"
                                        : "bg-emerald-500 active:bg-emerald-600"
                                }`}
                            >
                                <View className="flex-row items-center gap-2">
                                    <Ionicons
                                        name={
                                            copied ? "checkmark-circle" : "copy"
                                        }
                                        size={20}
                                        color={
                                            arrows.length === 0
                                                ? "#9CA3AF"
                                                : "#FFFFFF"
                                        }
                                    />
                                    <Text
                                        className={`font-bold text-sm ${
                                            arrows.length === 0
                                                ? "text-gray-400"
                                                : "text-white"
                                        }`}
                                    >
                                        {copied ? "Copied!" : "Export JSON"}
                                    </Text>
                                </View>
                            </Pressable>
                        )}
                    </View>

                    {/* Play Test */}
                    <Pressable
                        onPress={playTest}
                        disabled={arrows.length === 0}
                        className={`rounded-2xl py-4 items-center ${
                            arrows.length === 0
                                ? "bg-gray-200 dark:bg-gray-800"
                                : playTestPassed
                                  ? "bg-emerald-500 active:bg-emerald-600"
                                  : "bg-indigo-500 active:bg-indigo-600"
                        }`}
                    >
                        <View className="flex-row items-center gap-2">
                            <Ionicons
                                name={
                                    playTestPassed ? "checkmark-circle" : "play"
                                }
                                size={22}
                                color={
                                    arrows.length === 0 ? "#9CA3AF" : "#FFFFFF"
                                }
                            />
                            <Text
                                className={`font-bold text-base ${
                                    arrows.length === 0
                                        ? "text-gray-400"
                                        : "text-white"
                                }`}
                            >
                                {playTestPassed
                                    ? "Play Test ✓ Passed"
                                    : "Play Test"}
                            </Text>
                        </View>
                    </Pressable>

                    {/* Submit to Community */}
                    <Pressable
                        onPress={submitToCommunity}
                        disabled={!playTestPassed || submitting}
                        className={`rounded-2xl py-4 items-center ${
                            !playTestPassed || submitting
                                ? "bg-gray-200 dark:bg-gray-800"
                                : "bg-amber-500 active:bg-amber-600"
                        }`}
                    >
                        {submitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <View className="flex-row items-center gap-2">
                                <Ionicons
                                    name="cloud-upload"
                                    size={22}
                                    color={
                                        !playTestPassed ? "#9CA3AF" : "#FFFFFF"
                                    }
                                />
                                <Text
                                    className={`font-bold text-base ${
                                        !playTestPassed
                                            ? "text-gray-400"
                                            : "text-white"
                                    }`}
                                >
                                    {!playTestPassed
                                        ? "Pass Play Test to Share"
                                        : "Share to Community"}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                </View>

                {/* Info */}
                <View className="px-4 mt-6">
                    <View className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
                        <Text className="text-blue-700 dark:text-blue-300 text-xs leading-5 font-medium">
                            • Tap cells to draw a path (auto-fills gaps!)
                            {"\n"}• Pick a direction, then tap "Add Arrow"
                            {"\n"}• Hold a placed arrow to delete it
                            {"\n"}• Arrows: {arrows.length} placed
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
