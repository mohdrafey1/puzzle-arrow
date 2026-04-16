import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { getStaticLevel } from "../assets/levels";
import { generateLevel, LevelData, restoreShape } from "../constants/levels";
import { buildOccupiedGrid, canMove, clearTileFromGrid, TileData } from "../utils/movement";
import { getPreviewLevel } from "../utils/previewLevel";
import { getHapticsEnabled } from "../utils/storage";
import { useSfx } from "./useSfx";

function buildBoard(
    tiles: Omit<TileData, "id">[],
    levelId: number,
    attemptCount: number,
): TileData[] {
    return tiles
        .map((t, index) => ({
            ...t,
            id: `p_${levelId}_${attemptCount}_${index}`,
        }))
        .reverse();
}

function getLevelData(levelId: number): LevelData {
    // Preview level from the editor (id=0)
    if (levelId === 0) {
        const preview = getPreviewLevel();
        if (preview) return preview;
    }

    const raw = getStaticLevel(levelId);
    if (raw) {
        return {
            ...raw,
            shape: restoreShape(levelId, raw.size),
        };
    }
    // Fallback to dynamic generation for levels beyond the static bundle
    return generateLevel(levelId);
}

export function useGameEngine(levelId: number, onLevelComplete: () => void) {
    const [levelData, setLevelData] = useState<LevelData>(() =>
        getLevelData(levelId),
    );
    const [attemptCount, setAttemptCount] = useState(0);
    const [board, setBoard] = useState<TileData[]>(() =>
        buildBoard(levelData.tiles, levelId, 0),
    );
    const [hearts, setHearts] = useState(3);
    const [isResetting, setIsResetting] = useState(false);
    const [errorTileId, setErrorTileId] = useState<string | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);

    const animationLock = useRef(false);
    const hapticsEnabled = useRef(true);
    const occupiedGridRef = useRef<boolean[][] | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { playSfx } = useSfx();

    // ── Keep stable refs so handleTap never needs state in deps ──
    const boardRef = useRef<TileData[]>(board);

    const levelDataRef = useRef<LevelData>(levelData);
    useEffect(() => {
        levelDataRef.current = levelData;
    }, [levelData]);

    // Fast synchronous level load when levelId changes
    useEffect(() => {
        setIsComplete(false);
        setIsGameOver(false);
        setIsResetting(false);
        setErrorTileId(null);
        setHearts(3);
        setElapsedSeconds(0);

        const data = getLevelData(levelId);
        setLevelData(data);
        levelDataRef.current = data;
        setAttemptCount(0);

        const newBoard = buildBoard(data.tiles, levelId, 0);
        boardRef.current = newBoard;
        setBoard(newBoard);
        occupiedGridRef.current = buildOccupiedGrid(newBoard, data.size);
    }, [levelId]);

    // Load haptics preference
    useEffect(() => {
        getHapticsEnabled().then((enabled) => {
            hapticsEnabled.current = enabled;
        });
    }, []);

    // Timer
    useEffect(() => {
        if (isComplete || isResetting || isGameOver) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        setElapsedSeconds(0);
        timerRef.current = setInterval(
            () => setElapsedSeconds((s) => s + 1),
            1000,
        );
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [levelId, isResetting, isComplete, isGameOver]);

    const haptic = useCallback(
        (type: "light" | "heavy" | "error" | "success") => {
            if (!hapticsEnabled.current) return;
            if (type === "light")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            else if (type === "heavy")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            else if (type === "success")
                Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                );
            else
                Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Error,
                );
        },
        [],
    );

    const resetLevel = useCallback(() => {
        setIsResetting(true);
        setIsComplete(false);
        setIsGameOver(false);
        setTimeout(() => {
            setAttemptCount((prev) => {
                const nextAttempt = prev + 1;
                const newBoard = buildBoard(
                    levelDataRef.current.tiles,
                    levelId,
                    nextAttempt,
                );
                boardRef.current = newBoard;
                setBoard(newBoard);
                occupiedGridRef.current = buildOccupiedGrid(newBoard, levelDataRef.current.size);
                return nextAttempt;
            });
            setHearts(3);
            setIsResetting(false);
        }, 500);
    }, [levelId]);

    const removeTile = useCallback(
        (id: string) => {
            setBoard((prev) => {
                const next = prev.map((t) =>
                    t.id === id ? { ...t, removed: true } : t,
                );
                if (next.every((t) => t.removed)) {
                    haptic("success");
                    playSfx("gamewin");
                    setIsComplete(true);
                    setTimeout(onLevelComplete, 500);
                }
                return next;
            });
        },
        [onLevelComplete, haptic],
    );

    // ── Stable handleTap: reads board/levelData from refs, never recreates on board change ──
    const removeTileRef = useRef(removeTile);
    useEffect(() => {
        removeTileRef.current = removeTile;
    }, [removeTile]);
    const heartsRef = useRef(hearts);
    useEffect(() => {
        heartsRef.current = hearts;
    }, [hearts]);
    const isResettingRef = useRef(isResetting);
    useEffect(() => {
        isResettingRef.current = isResetting;
    }, [isResetting]);

    const handleTap = useCallback(
        (tile: TileData, onExitAnimation: () => void) => {
            if (
                animationLock.current ||
                isResettingRef.current ||
                heartsRef.current <= 0
            )
                return;

            // Guard: look up the tile in the authoritative board ref —
            // React state `board` used by handleTapCell may be stale after
            // an eager removal, so the caller might pass an already-removed tile.
            const liveTile = boardRef.current.find((t) => t.id === tile.id);
            if (!liveTile || liveTile.removed) return;

            animationLock.current = true;
            setErrorTileId(null);

            if (
                canMove(
                    tile,
                    boardRef.current,
                    levelDataRef.current.size,
                    levelDataRef.current.shape,
                    occupiedGridRef.current ?? undefined,
                )
            ) {
                haptic("light");
                playSfx("arrowout");
                onExitAnimation();
                boardRef.current = boardRef.current.map((t) =>
                    t.id === tile.id ? { ...t, removed: true } : t,
                );
                // Immediately update cached grid so next tap sees correct state
                if (occupiedGridRef.current) {
                    clearTileFromGrid(occupiedGridRef.current, tile);
                }
                animationLock.current = false;
                setTimeout(() => {
                    removeTileRef.current(tile.id);
                }, 600);
            } else {
                haptic("error");
                setErrorTileId(tile.id);
                setHearts((prev) => {
                    const next = prev - 1;
                    if (next <= 0) {
                        setTimeout(() => {
                            playSfx("gameover");
                            setIsGameOver(true);
                            animationLock.current = false;
                        }, 500);
                    } else {
                        setTimeout(() => {
                            animationLock.current = false;
                        }, 400);
                    }
                    return next;
                });
            }
        },
        [haptic, playSfx], // ← only haptic + playSfx in deps — board/hearts read from refs
    );

    const reviveGame = useCallback(() => {
        setIsGameOver(false);
        setHearts((prev) => prev + 1);
    }, []);

    return {
        board,
        hearts,
        levelData,
        handleTap,
        resetLevel,
        isResetting,
        errorTileId,
        elapsedSeconds,
        isComplete,
        isGameOver,
        reviveGame,
    };
}
