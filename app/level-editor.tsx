import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Polygon, Rect } from "react-native-svg";
import Toast from "react-native-toast-message";
import { checkNewAchievements } from "../utils/achievements";
import { submitCommunityLevel } from "../utils/communityLevels";
import { Direction, Point } from "../utils/movement";
import {
    isPreviewPassed,
    resetPreviewPassed,
    setPreviewLevel,
} from "../utils/previewLevel";
import {
    addArrows,
    getLeaderboardUsername,
    getLevelDraft,
    getUnlockedAchievements,
    getUserStats,
    saveLevelDraft,
    unlockAchievement,
    updateUserStats,
} from "../utils/storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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

const PRESET_SIZES = [4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25];
const AVAILABLE_TAGS = ["Logic", "Maze", "Hard", "Speed", "Easy", "Creative"];

export default function LevelEditor() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    // Theme-aware board colors so the editor grid matches the app in dark mode.
    const cellColors = {
        emptyFill: isDark ? "#1F2937" : "#F9FAFB",
        emptyStroke: isDark ? "#374151" : "#E5E7EB",
        occupiedFill: isDark ? "#1E3A5F" : "#DBEAFE",
        occupiedStroke: isDark ? "#3B82F6" : "#93C5FD",
        pathFill: isDark ? "#4D3B10" : "#FEF3C7",
        pathStroke: "#F59E0B",
        dot: isDark ? "#4B5563" : "#D1D5DB",
    };
    const [gridCols, setGridCols] = useState(6);
    const [gridRows, setGridRows] = useState(6);
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customRowsText, setCustomRowsText] = useState("6");
    const [customColsText, setCustomColsText] = useState("6");
    const [arrows, setArrows] = useState<PlacedArrow[]>([]);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [selectedDirection, setSelectedDirection] =
        useState<Direction>("right");
    const [copied, setCopied] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [playTestPassed, setPlayTestPassed] = useState(false);
    const [showPresetPicker, setShowPresetPicker] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const [history, setHistory] = useState<PlacedArrow[][]>([]);
    const [redoStack, setRedoStack] = useState<PlacedArrow[][]>([]);
    const [loadedDraft, setLoadedDraft] = useState(false);

    // Initial draft loading
    React.useEffect(() => {
        let mounted = true;
        getLevelDraft().then((draft) => {
            if (mounted && draft) {
                setGridCols(draft.gridCols);
                setGridRows(draft.gridRows);
                setArrows(draft.arrows);
            }
            if (mounted) setLoadedDraft(true);
        });
        return () => {
            mounted = false;
        };
    }, []);

    // Save draft
    React.useEffect(() => {
        if (!loadedDraft) return;
        if (arrows.length > 0) {
            saveLevelDraft({ gridCols, gridRows, arrows });
        } else {
            saveLevelDraft(null);
        }
    }, [arrows, gridCols, gridRows, loadedDraft]);

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
    // Use generous height — up to 60% of screen
    const availableHeight = SCREEN_HEIGHT * 0.6;
    // Use width-based cell size so the board always fills full width;
    // for tall grids the board overflows vertically and the user can zoom/pan.
    const cellSize = Math.floor(availableWidth / gridCols);
    const boardPixelWidth = gridCols * cellSize;
    const boardPixelHeight = gridRows * cellSize;
    // Container clips tall boards to available height
    const containerHeight = Math.min(
        boardPixelHeight + padding,
        availableHeight + padding,
    );

    // Determine if board needs zoom (large grids with tiny cells)
    const isLargeGrid = gridRows > 15 || gridCols > 15;

    // Pinch-to-zoom & pan shared values
    const zoomScale = useSharedValue(1);
    const savedZoomScale = useSharedValue(1);
    const panX = useSharedValue(0);
    const savedPanX = useSharedValue(0);
    const panY = useSharedValue(0);
    const savedPanY = useSharedValue(0);

    // Reset zoom/pan when the grid dimensions change. Done in an effect rather
    // than the render body so we never mutate shared values mid-render.
    React.useEffect(() => {
        zoomScale.value = 1;
        savedZoomScale.value = 1;
        panX.value = 0;
        savedPanX.value = 0;
        panY.value = 0;
        savedPanY.value = 0;
    }, [
        gridCols,
        gridRows,
        zoomScale,
        savedZoomScale,
        panX,
        savedPanX,
        panY,
        savedPanY,
    ]);

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            zoomScale.value = Math.max(
                0.5,
                Math.min(savedZoomScale.value * e.scale, 5),
            );
        })
        .onEnd(() => {
            savedZoomScale.value = zoomScale.value;
        });

    const panGesture = Gesture.Pan()
        .minPointers(2)
        .onUpdate((e) => {
            panX.value = savedPanX.value + e.translationX;
            panY.value = savedPanY.value + e.translationY;
        })
        .onEnd(() => {
            savedPanX.value = panX.value;
            savedPanY.value = panY.value;
        });

    const boardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: panX.value },
            { translateY: panY.value },
            { scale: zoomScale.value },
        ],
    }));

    // Track which cells are occupied by placed arrows
    const occupiedCells = useMemo(() => {
        const set = new Set<string>();
        arrows.forEach((a) => {
            a.path.forEach((p) => set.add(`${p.x},${p.y}`));
        });
        return set;
    }, [arrows]);

    const currentPathSet = useMemo(() => {
        const set = new Set<string>();
        currentPath.forEach((p) => set.add(`${p.x},${p.y}`));
        return set;
    }, [currentPath]);

    const pushHistory = useCallback(
        (newArrows: PlacedArrow[], prevArrows: PlacedArrow[]) => {
            setHistory((prev) => [...prev, prevArrows]);
            setRedoStack([]);
            setArrows(newArrows);
        },
        [],
    );

    const handleUndo = useCallback(() => {
        if (history.length === 0) return;
        setHistory((prev) => {
            const prevState = prev[prev.length - 1];
            const newHistory = prev.slice(0, -1);
            setRedoStack((rs) => [...rs, arrows]);
            setArrows(prevState);
            setPlayTestPassed(false);
            return newHistory;
        });
    }, [history, arrows]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        setRedoStack((prev) => {
            const nextState = prev[prev.length - 1];
            const newRedo = prev.slice(0, -1);
            setHistory((h) => [...h, arrows]);
            setArrows(nextState);
            setPlayTestPassed(false);
            return newRedo;
        });
    }, [redoStack, arrows]);

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

                    if (nx < 0 || nx >= gridCols || ny < 0 || ny >= gridRows)
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
        [currentPath, currentPathSet, occupiedCells, gridCols, gridRows],
    );

    const handleCellLongPress = useCallback(
        (x: number, y: number) => {
            const key = `${x},${y}`;
            if (occupiedCells.has(key)) {
                const newArrows = arrows.filter(
                    (a) => !a.path.some((p) => p.x === x && p.y === y),
                );
                pushHistory(newArrows, arrows);
                setPlayTestPassed(false);
            }
        },
        [occupiedCells, arrows, pushHistory],
    );

    const tapGesture = Gesture.Tap()
        .maxDuration(250)
        .runOnJS(true)
        .onEnd((e) => {
            const x = Math.floor(e.x / cellSize);
            const y = Math.floor(e.y / cellSize);
            if (x >= 0 && x < gridCols && y >= 0 && y < gridRows) {
                handleCellTap(x, y);
            }
        });

    const longPressGesture = Gesture.LongPress()
        .minDuration(400)
        .runOnJS(true)
        .onEnd((e) => {
            const x = Math.floor(e.x / cellSize);
            const y = Math.floor(e.y / cellSize);
            if (x >= 0 && x < gridCols && y >= 0 && y < gridRows) {
                handleCellLongPress(x, y);
            }
        });

    const touchGestures = Gesture.Exclusive(longPressGesture, tapGesture);
    const composedGesture = Gesture.Simultaneous(
        Gesture.Simultaneous(pinchGesture, panGesture),
        touchGestures,
    );

    const addArrow = useCallback(() => {
        if (currentPath.length === 0) return;
        const newArrows = [
            ...arrows,
            { path: [...currentPath], direction: selectedDirection },
        ];
        pushHistory(newArrows, arrows);
        setCurrentPath([]);
        setPlayTestPassed(false); // arrows changed, need re-test
    }, [currentPath, selectedDirection, arrows, pushHistory]);

    const clearAll = useCallback(() => {
        const doClear = () => {
            if (arrows.length > 0) pushHistory([], arrows);
            setCurrentPath([]);
            setPlayTestPassed(false);
        };
        // Confirm before wiping a non-trivial draft.
        if (arrows.length > 0) {
            Alert.alert(
                "Clear All Arrows?",
                "This removes every arrow on the board. You can undo afterwards.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear", style: "destructive", onPress: doClear },
                ],
            );
        } else {
            doClear();
        }
    }, [arrows, pushHistory]);

    const cancelPath = useCallback(() => {
        setCurrentPath([]);
    }, []);

    const applyGridSize = useCallback(
        (newCols: number, newRows: number) => {
            const cols = Math.max(4, Math.min(25, newCols));
            const rows = Math.max(4, Math.min(50, newRows));
            if (cols !== gridCols || rows !== gridRows) {
                setGridCols(cols);
                setGridRows(rows);
                if (arrows.length > 0) pushHistory([], arrows);
                setCurrentPath([]);
                setPlayTestPassed(false);
            }
        },
        [gridCols, gridRows, arrows, pushHistory],
    );

    const changeGridSize = useCallback(
        (delta: number) => {
            // For simple mode, keep square
            const currentSize = Math.max(gridCols, gridRows);
            const newSize = Math.max(4, Math.min(25, currentSize + delta));
            applyGridSize(newSize, newSize);
        },
        [gridCols, gridRows, applyGridSize],
    );

    const applyCustomSize = useCallback(() => {
        const cols = parseInt(customColsText, 10) || 6;
        const rows = parseInt(customRowsText, 10) || 6;
        applyGridSize(cols, rows);
    }, [customColsText, customRowsText, applyGridSize]);

    // For LevelData compatibility, use max dimension as "size"
    const effectiveSize = Math.max(gridCols, gridRows);

    const exportJSON = useCallback(async () => {
        const level = {
            id: 0,
            size: effectiveSize,
            rows: gridRows,
            cols: gridCols,
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
    }, [effectiveSize, gridRows, gridCols, arrows]);

    const playTest = useCallback(() => {
        if (arrows.length === 0) return;
        // Build shape array: rows × cols, all true
        const shape = Array.from({ length: gridRows }, () =>
            Array.from({ length: gridCols }, () => true),
        );
        // Pad to square for game engine compatibility
        const paddedSize = effectiveSize;
        const paddedShape = Array.from({ length: paddedSize }, (_, y) =>
            Array.from({ length: paddedSize }, (_, x) =>
                y < gridRows && x < gridCols ? true : false,
            ),
        );
        setPreviewLevel({
            id: 0,
            size: paddedSize,
            shape: paddedShape,
            tiles: arrows.map((a) => ({
                path: a.path,
                direction: a.direction,
            })),
        });
        router.push("/game/0?source=editor" as any);
    }, [gridRows, gridCols, effectiveSize, arrows, router]);

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
            await submitCommunityLevel(
                username,
                effectiveSize,
                tiles,
                selectedTags,
                { rows: gridRows, cols: gridCols },
            );
            await saveLevelDraft(null); // Clear draft
            setArrows([]); // Reset UI
            pushHistory([], arrows);
            setCurrentPath([]);

            // Track stats & check achievements
            const currentStats = await getUserStats();
            const newStats = await updateUserStats({
                levelsCreated: currentStats.levelsCreated + 1,
            });
            const unlockedIds = await getUnlockedAchievements();
            const newlyUnlocked = checkNewAchievements(newStats, unlockedIds);

            if (newlyUnlocked.length > 0) {
                for (const ach of newlyUnlocked) {
                    await unlockAchievement(ach.id);
                    await addArrows(ach.arrowReward);
                    Toast.show({
                        type: "success",
                        text1: `🏆 Achievement Unlocked: ${ach.title}`,
                        text2: `You earned ${ach.arrowReward} Arrows!`,
                        visibilityTime: 4000,
                        position: "top",
                    });
                }
            } else {
                Toast.show({
                    type: "success",
                    text1: "Shared! 🎉",
                    text2: "Your level is now live in the Community tab.",
                    visibilityTime: 3000,
                    position: "top",
                });
            }

            // Small delay to let toast trigger before transitioning if we wanted
            setTimeout(() => {
                router.back();
            }, 500);
        } catch (err: any) {
            Alert.alert(
                "Error",
                err?.message || "Failed to submit. Check your connection.",
            );
        } finally {
            setSubmitting(false);
        }
    }, [arrows, effectiveSize, router, selectedTags, gridRows, gridCols]);

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

    const isSquare = gridCols === gridRows;
    const gridLabel = isSquare ? `${gridCols}` : `${gridCols}×${gridRows}`;

    return (
        <View
            className="flex-1 bg-gray-50 dark:bg-gray-900"
            style={{ paddingTop: insets.top + 8 }}
        >
            {/* Header */}
            <View className="flex-row items-center px-4 mb-4">
                <Pressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    hitSlop={8}
                    className="mr-3 p-2"
                >
                    <Ionicons name="arrow-back" size={24} color="#3B82F6" />
                </Pressable>
                <Text className="text-2xl font-black text-gray-900 dark:text-gray-100 flex-1">
                    Level Editor
                </Text>

                {/* Undo / Redo */}
                <View className="flex-row gap-2">
                    <Pressable
                        onPress={handleUndo}
                        disabled={history.length === 0}
                        className={`w-10 h-10 rounded-xl items-center justify-center ${
                            history.length === 0
                                ? "bg-gray-100 dark:bg-gray-800 opacity-50"
                                : "bg-gray-200 dark:bg-gray-700 active:bg-gray-300"
                        }`}
                    >
                        <Ionicons
                            name="arrow-undo"
                            size={20}
                            color={history.length === 0 ? "#9CA3AF" : "#4B5563"}
                        />
                    </Pressable>
                    <Pressable
                        onPress={handleRedo}
                        disabled={redoStack.length === 0}
                        className={`w-10 h-10 rounded-xl items-center justify-center ${
                            redoStack.length === 0
                                ? "bg-gray-100 dark:bg-gray-800 opacity-50"
                                : "bg-gray-200 dark:bg-gray-700 active:bg-gray-300"
                        }`}
                    >
                        <Ionicons
                            name="arrow-redo"
                            size={20}
                            color={
                                redoStack.length === 0 ? "#9CA3AF" : "#4B5563"
                            }
                        />
                    </Pressable>
                </View>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* Grid Size Control */}
                <View className="px-4 mb-4">
                    {!isCustomMode ? (
                        <>
                            {/* Simple Square Mode */}
                            <View className="flex-row items-center justify-center gap-4 mb-2">
                                <Text className="text-gray-500 dark:text-gray-400 font-bold text-sm uppercase tracking-widest">
                                    Grid
                                </Text>
                                <Pressable
                                    onPress={() => changeGridSize(-1)}
                                    className="bg-gray-200 dark:bg-gray-700 w-10 h-10 rounded-xl items-center justify-center active:bg-gray-300"
                                >
                                    <Ionicons
                                        name="remove"
                                        size={22}
                                        color="#6B7280"
                                    />
                                </Pressable>
                                <Pressable
                                    onPress={() =>
                                        setShowPresetPicker(!showPresetPicker)
                                    }
                                >
                                    <Text className="text-base font-black text-gray-900 dark:text-white w-12 text-center">
                                        {gridLabel}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => changeGridSize(1)}
                                    className="bg-gray-200 dark:bg-gray-700 w-10 h-10 rounded-xl items-center justify-center active:bg-gray-300"
                                >
                                    <Ionicons
                                        name="add"
                                        size={22}
                                        color="#6B7280"
                                    />
                                </Pressable>
                            </View>

                            {/* Preset size quick-pick */}
                            {showPresetPicker && (
                                <View className="flex-row flex-wrap justify-center gap-2 mb-3">
                                    {PRESET_SIZES.map((s) => (
                                        <Pressable
                                            key={s}
                                            onPress={() => {
                                                applyGridSize(s, s);
                                                setShowPresetPicker(false);
                                            }}
                                            className={`px-3 py-2 rounded-xl border ${
                                                gridCols === s && gridRows === s
                                                    ? "bg-blue-500 border-blue-600"
                                                    : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                            }`}
                                        >
                                            <Text
                                                className={`font-bold text-xs ${
                                                    gridCols === s &&
                                                    gridRows === s
                                                        ? "text-white"
                                                        : "text-gray-600 dark:text-gray-400"
                                                }`}
                                            >
                                                {s}×{s}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}

                            {/* Switch to Custom */}
                            <Pressable
                                onPress={() => {
                                    setIsCustomMode(true);
                                    setCustomColsText(String(gridCols));
                                    setCustomRowsText(String(gridRows));
                                }}
                                className="self-center"
                            >
                                <Text className="text-blue-500 font-bold text-xs uppercase tracking-wider">
                                    Custom Size ↗
                                </Text>
                            </Pressable>
                        </>
                    ) : (
                        <>
                            {/* Custom Rows × Cols Mode */}
                            <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                                <Text className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest mb-3 text-center">
                                    Custom Grid (W max 25, H max 50)
                                </Text>
                                <View className="flex-row items-center justify-center gap-3">
                                    <View className="items-center">
                                        <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase mb-1">
                                            Cols (W)
                                        </Text>
                                        <TextInput
                                            value={customColsText}
                                            onChangeText={setCustomColsText}
                                            keyboardType="number-pad"
                                            maxLength={2}
                                            className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-2xl font-black text-center w-16 h-12 rounded-xl border border-gray-200 dark:border-gray-600"
                                            selectTextOnFocus
                                        />
                                    </View>
                                    <Text className="text-gray-400 dark:text-gray-500 text-2xl font-black mt-4">
                                        ×
                                    </Text>
                                    <View className="items-center">
                                        <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase mb-1">
                                            Rows (H)
                                        </Text>
                                        <TextInput
                                            value={customRowsText}
                                            onChangeText={setCustomRowsText}
                                            keyboardType="number-pad"
                                            maxLength={2}
                                            className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-2xl font-black text-center w-16 h-12 rounded-xl border border-gray-200 dark:border-gray-600"
                                            selectTextOnFocus
                                        />
                                    </View>
                                </View>
                                <View className="flex-row gap-3 mt-4 justify-center">
                                    <Pressable
                                        onPress={() => setIsCustomMode(false)}
                                        className="px-5 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700"
                                    >
                                        <Text className="text-gray-600 dark:text-gray-400 font-bold text-sm">
                                            Cancel
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => {
                                            applyCustomSize();
                                            setIsCustomMode(false);
                                        }}
                                        className="px-5 py-2.5 rounded-xl bg-blue-500 active:bg-blue-600"
                                    >
                                        <Text className="text-white font-bold text-sm">
                                            Apply
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        </>
                    )}
                </View>

                {/* Board */}
                <View className="items-center mb-4">
                    <View
                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                        style={{
                            width: availableWidth + padding,
                            height: containerHeight,
                            padding: padding / 2,
                        }}
                    >
                        <GestureDetector gesture={composedGesture}>
                            <Animated.View
                                style={[
                                    {
                                        width: boardPixelWidth,
                                        height: boardPixelHeight,
                                    },
                                    boardAnimatedStyle,
                                ]}
                            >
                                <Svg
                                    width={boardPixelWidth}
                                    height={boardPixelHeight}
                                >
                                    {/* Grid cells */}
                                    {Array.from({ length: gridRows }).map(
                                        (_, y) =>
                                            Array.from({
                                                length: gridCols,
                                            }).map((_, x) => {
                                                const key = `${x},${y}`;
                                                const isOccupied =
                                                    occupiedCells.has(key);
                                                const isInPath =
                                                    currentPathSet.has(key);

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
                                                                ? cellColors.pathFill
                                                                : isOccupied
                                                                  ? cellColors.occupiedFill
                                                                  : cellColors.emptyFill
                                                        }
                                                        stroke={
                                                            isInPath
                                                                ? cellColors.pathStroke
                                                                : isOccupied
                                                                  ? cellColors.occupiedStroke
                                                                  : cellColors.emptyStroke
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
                                    {effectiveSize <= 8 &&
                                        Array.from({ length: gridRows }).map(
                                            (_, y) =>
                                                Array.from({
                                                    length: gridCols,
                                                }).map((_, x) => (
                                                    <Circle
                                                        key={`dot-${x}-${y}`}
                                                        cx={
                                                            x * cellSize +
                                                            cellSize / 2
                                                        }
                                                        cy={
                                                            y * cellSize +
                                                            cellSize / 2
                                                        }
                                                        r={cellSize * 0.04}
                                                        fill={cellColors.dot}
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
                                                )),
                                        )}
                                </Svg>
                            </Animated.View>
                        </GestureDetector>
                    </View>
                    {/* Zoom hint for large grids */}
                    {isLargeGrid && (
                        <Text className="text-gray-400 dark:text-gray-500 text-[10px] mt-1 font-medium">
                            Pinch to zoom • Two-finger drag to pan
                        </Text>
                    )}
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

                {/* Tag Selection — placed BEFORE the action buttons so levels
                    get tagged before they are shared. */}
                <View className="px-4 mb-4">
                    <Text className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest mb-2 text-center">
                        Add Tags (Optional)
                    </Text>
                    <View className="flex-row flex-wrap justify-center gap-2">
                        {AVAILABLE_TAGS.map((tag) => {
                            const isSelected = selectedTags.includes(tag);
                            return (
                                <Pressable
                                    key={tag}
                                    onPress={() => {
                                        if (isSelected) {
                                            setSelectedTags(
                                                selectedTags.filter(
                                                    (t) => t !== tag,
                                                ),
                                            );
                                        } else {
                                            if (selectedTags.length >= 3) {
                                                Alert.alert(
                                                    "Max 3 Tags",
                                                    "You can only select up to 3 tags per level.",
                                                );
                                                return;
                                            }
                                            setSelectedTags([
                                                ...selectedTags,
                                                tag,
                                            ]);
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-full border ${
                                        isSelected
                                            ? "bg-blue-500 border-blue-600"
                                            : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                    }`}
                                >
                                    <Text
                                        className={`text-xs font-bold ${
                                            isSelected
                                                ? "text-white"
                                                : "text-gray-600 dark:text-gray-400"
                                        }`}
                                    >
                                        {tag}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="px-4 gap-3 pb-8">
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
                            {"\n"}• Tap the grid number for preset sizes
                            {"\n"}• Use "Custom Size" for non-square grids (up
                            to 50)
                            {"\n"}• Arrows: {arrows.length} placed | Grid:{" "}
                            {gridCols}×{gridRows}
                        </Text>
                    </View>

                    {/* Beta Note */}
                    <Text className="text-gray-400 dark:text-gray-500 text-[10px] text-center mt-4 mb-8 leading-4 px-2 tracking-wide font-medium">
                        NOTE: Custom shapes are coming soon!
                        {"\n"}This is a beta feature, so you might encounter
                        some bugs.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
