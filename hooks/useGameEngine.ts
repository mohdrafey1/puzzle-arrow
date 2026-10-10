import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getStaticLevel } from "../assets/levels";
import { generateLevel, LevelData, restoreShape } from "../constants/levels";
import {
    ActivePlayClock,
    AttemptScheduler,
    findHintTile,
    getAttemptStars,
} from "../utils/attempt";
import { canMove, TileData } from "../utils/movement";
import { getPreviewLevel } from "../utils/previewLevel";
import { getHapticsEnabled } from "../utils/storage";
import { useSfx } from "./useSfx";

function buildBoard(tiles: Omit<TileData, "id">[], key: string): TileData[] {
    return tiles
        .map((tile, index) => ({
            ...tile,
            removed: false,
            id: `${key}_${index}`,
        }))
        .reverse();
}

function getLevelData(levelId: number): LevelData {
    if (levelId === 0) {
        const preview = getPreviewLevel();
        if (preview) return preview;
    }
    const raw = getStaticLevel(levelId);
    if (raw)
        return { ...raw, shape: raw.shape ?? restoreShape(levelId, raw.size) };
    return generateLevel(levelId);
}

interface AttemptState {
    hearts: number;
    mistakes: number;
    revivesUsed: number;
    hintsUsed: number;
    resetting: boolean;
    complete: boolean;
    gameOver: boolean;
}

const initialAttempt = (): AttemptState => ({
    hearts: 3,
    mistakes: 0,
    revivesUsed: 0,
    hintsUsed: 0,
    resetting: false,
    complete: false,
    gameOver: false,
});

const now = () => performance.now();

export interface GameEngineOptions {
    /** Screen focus and ad visibility; native/background visibility is handled here. */
    isActive?: boolean;
    /** Distinguishes community boards that all use the editor's route ID of zero. */
    levelKey?: string;
}

export function useGameEngine(
    levelId: number,
    onLevelComplete: () => void,
    { isActive = true, levelKey = String(levelId) }: GameEngineOptions = {},
) {
    const [levelData, setLevelData] = useState<LevelData>(() =>
        getLevelData(levelId),
    );
    const [board, setBoard] = useState<TileData[]>(() =>
        buildBoard(levelData.tiles, `${levelKey}_0`),
    );
    const [attempt, setAttempt] = useState(initialAttempt);
    const [attemptCount, setAttemptCount] = useState(0);
    const [errorTileId, setErrorTileId] = useState<string | null>(null);
    const [hintTileId, setHintTileId] = useState<string | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);

    const attemptRef = useRef(attempt);
    const attemptCountRef = useRef(0);
    const boardRef = useRef(board);
    const visibleBoardRef = useRef(board);
    const levelDataRef = useRef(levelData);
    const levelKeyRef = useRef(levelKey);
    const epochRef = useRef(0);
    const activeRef = useRef(isActive);
    activeRef.current = isActive;
    const appActiveRef = useRef(
        AppState.currentState !== "background" &&
            AppState.currentState !== "inactive",
    );
    const callbackRef = useRef(onLevelComplete);
    callbackRef.current = onLevelComplete;
    const animationLock = useRef(false);
    const hapticsEnabled = useRef(true);
    const completionShown = useRef(false);
    const scheduler = useRef(new AttemptScheduler()).current;
    const playClock = useRef(new ActivePlayClock()).current;
    const pendingRemovals = useRef(new Set<string>());
    const flushScheduled = useRef(false);
    const { playSfx } = useSfx();
    const playSfxRef = useRef(playSfx);
    playSfxRef.current = playSfx;

    const updateAttempt = useCallback((patch: Partial<AttemptState>) => {
        const next = { ...attemptRef.current, ...patch };
        attemptRef.current = next;
        setAttempt(next);
    }, []);

    const reconcileClock = useCallback(() => {
        const state = attemptRef.current;
        if (
            activeRef.current &&
            appActiveRef.current &&
            !state.resetting &&
            !state.gameOver &&
            !state.complete
        ) {
            playClock.start(now());
        } else {
            playClock.pause(now());
        }
        setElapsedSeconds(playClock.seconds(now()));
    }, [playClock]);

    const haptic = useCallback((type: "light" | "error" | "success") => {
        if (!hapticsEnabled.current) return;
        const feedback =
            type === "light"
                ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                : Haptics.notificationAsync(
                      type === "success"
                          ? Haptics.NotificationFeedbackType.Success
                          : Haptics.NotificationFeedbackType.Error,
                  );
        void feedback.catch(() => undefined);
    }, []);

    const playSfxDeferred = useCallback(
        (name: Parameters<typeof playSfx>[0]) => {
            scheduler.after(16, () => {
                if (activeRef.current && appActiveRef.current)
                    playSfxRef.current(name);
            });
        },
        [scheduler],
    );

    // Invalidate every deferred animation, failed-tap unlock and completion when
    // the board identity changes. IDs also include the epoch to reject stale taps.
    useEffect(() => {
        scheduler.cancelAll();
        pendingRemovals.current.clear();
        flushScheduled.current = false;
        epochRef.current += 1;
        levelKeyRef.current = levelKey;
        animationLock.current = false;
        completionShown.current = false;
        const data = getLevelData(levelId);
        levelDataRef.current = data;
        setLevelData(data);
        const nextBoard = buildBoard(
            data.tiles,
            `${levelKey}_${epochRef.current}_0`,
        );
        boardRef.current = nextBoard;
        visibleBoardRef.current = nextBoard;
        setBoard(nextBoard);
        attemptRef.current = initialAttempt();
        setAttempt(attemptRef.current);
        attemptCountRef.current = 0;
        setAttemptCount(0);
        setIsComplete(false);
        setIsGameOver(false);
        setErrorTileId(null);
        setHintTileId(null);
        playClock.reset();
        reconcileClock();
        return () => {
            scheduler.cancelAll();
            playClock.pause(now());
        };
    }, [levelId, levelKey, playClock, reconcileClock, scheduler]);

    useEffect(() => {
        void getHapticsEnabled().then((enabled) => {
            hapticsEnabled.current = enabled;
        });
    }, []);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) => {
            appActiveRef.current = state === "active";
            reconcileClock();
        });
        return () => subscription.remove();
    }, [reconcileClock]);

    useEffect(reconcileClock, [isActive, reconcileClock]);

    useEffect(() => {
        const interval = setInterval(
            () => setElapsedSeconds(playClock.seconds(now())),
            250,
        );
        return () => clearInterval(interval);
    }, [playClock]);

    const flushRemovals = useCallback(() => {
        flushScheduled.current = false;
        if (pendingRemovals.current.size === 0) return;
        const ids = new Set(pendingRemovals.current);
        pendingRemovals.current.clear();
        const next = visibleBoardRef.current.map((tile) =>
            ids.has(tile.id) ? { ...tile, removed: true } : tile,
        );
        visibleBoardRef.current = next;
        setBoard(next);
        if (
            next.length > 0 &&
            next.every((tile) => tile.removed) &&
            !completionShown.current
        ) {
            completionShown.current = true;
            setIsComplete(true);
            haptic("success");
            playSfxDeferred("gamewin");
            // Persist the win as soon as the result appears. Delaying this again
            // allows a quick Next press to leave before progression is recorded.
            callbackRef.current();
        }
    }, [haptic, playSfxDeferred]);

    const handleTap = useCallback(
        (tile: TileData, onExitAnimation: () => void) => {
            const state = attemptRef.current;
            if (
                !activeRef.current ||
                !appActiveRef.current ||
                animationLock.current ||
                state.resetting ||
                state.complete ||
                state.gameOver ||
                state.hearts <= 0
            )
                return;
            const liveTile = boardRef.current.find(
                (candidate) => candidate.id === tile.id,
            );
            if (!liveTile || liveTile.removed) return;
            const data = levelDataRef.current;
            setErrorTileId(null);
            if (canMove(liveTile, boardRef.current, data.size, data.shape)) {
                haptic("light");
                playSfxDeferred("arrowout");
                boardRef.current = boardRef.current.map((candidate) =>
                    candidate.id === liveTile.id
                        ? { ...candidate, removed: true }
                        : candidate,
                );
                setHintTileId((current) =>
                    current === liveTile.id ? null : current,
                );
                if (boardRef.current.every((candidate) => candidate.removed)) {
                    updateAttempt({ complete: true });
                    reconcileClock();
                }
                onExitAnimation();
                // Each arrow receives its full exit animation even during rapid taps.
                scheduler.after(350, () => {
                    pendingRemovals.current.add(liveTile.id);
                    if (!flushScheduled.current) {
                        flushScheduled.current = true;
                        scheduler.after(16, flushRemovals);
                    }
                });
            } else {
                animationLock.current = true;
                haptic("error");
                setErrorTileId(liveTile.id);
                const hearts = state.hearts - 1;
                updateAttempt({
                    hearts,
                    mistakes: state.mistakes + 1,
                    gameOver: hearts === 0,
                });
                reconcileClock();
                scheduler.after(hearts === 0 ? 500 : 550, () => {
                    animationLock.current = false;
                    if (hearts === 0) {
                        setIsGameOver(true);
                        playSfxDeferred("gameover");
                    }
                });
            }
        },
        [
            flushRemovals,
            haptic,
            playSfxDeferred,
            reconcileClock,
            scheduler,
            updateAttempt,
        ],
    );

    const resetLevel = useCallback(() => {
        scheduler.cancelAll();
        pendingRemovals.current.clear();
        flushScheduled.current = false;
        animationLock.current = false;
        completionShown.current = false;
        updateAttempt({ resetting: true, complete: false, gameOver: false });
        reconcileClock();
        setIsComplete(false);
        setIsGameOver(false);
        setErrorTileId(null);
        setHintTileId(null);
        scheduler.after(500, () => {
            attemptCountRef.current += 1;
            setAttemptCount(attemptCountRef.current);
            const nextBoard = buildBoard(
                levelDataRef.current.tiles,
                `${levelKeyRef.current}_${epochRef.current}_${attemptCountRef.current}`,
            );
            boardRef.current = nextBoard;
            visibleBoardRef.current = nextBoard;
            setBoard(nextBoard);
            attemptRef.current = initialAttempt();
            setAttempt(attemptRef.current);
            playClock.reset();
            reconcileClock();
        });
    }, [playClock, reconcileClock, scheduler, updateAttempt]);

    const reviveGame = useCallback(() => {
        const state = attemptRef.current;
        if (!state.gameOver || state.resetting || state.complete) return;
        animationLock.current = false;
        setIsGameOver(false);
        setErrorTileId(null);
        updateAttempt({
            gameOver: false,
            hearts: 1,
            revivesUsed: state.revivesUsed + 1,
        });
        reconcileClock();
    }, [reconcileClock, updateAttempt]);

    const requestHint = useCallback((): string | null => {
        const state = attemptRef.current;
        if (
            !activeRef.current ||
            !appActiveRef.current ||
            state.resetting ||
            state.complete ||
            state.gameOver ||
            state.hintsUsed > 0
        )
            return null;
        const data = levelDataRef.current;
        const tile = findHintTile(boardRef.current, data.size, data.shape);
        if (!tile) return null;
        updateAttempt({ hintsUsed: state.hintsUsed + 1 });
        setHintTileId(tile.id);
        haptic("light");
        return tile.id;
    }, [haptic, updateAttempt]);

    return {
        board,
        hearts: attempt.hearts,
        mistakes: attempt.mistakes,
        revivesUsed: attempt.revivesUsed,
        hintsUsed: attempt.hintsUsed,
        stars: getAttemptStars(
            attempt.mistakes,
            attempt.hintsUsed,
            attempt.revivesUsed,
        ),
        hintTileId,
        requestHint,
        attemptCount,
        levelData,
        handleTap,
        resetLevel,
        isResetting: attempt.resetting,
        errorTileId,
        elapsedSeconds,
        isComplete,
        isGameOver,
        reviveGame,
    };
}
