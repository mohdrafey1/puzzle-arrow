import assert from "node:assert/strict";
import test from "node:test";
import {
  ActivePlayClock,
  AttemptScheduler,
  findHintTile,
  getAttemptStars,
} from "../utils/attempt";
import { canMove, TileData } from "../utils/movement";
import {
  applyLevelCompletion,
  CompletionRecord,
  mergeCompletionRecords,
  normalizeUserStats,
} from "../utils/progress";

test("active play time survives a revive and excludes ads, background and blur", () => {
  const clock = new ActivePlayClock();
  clock.start(0);
  clock.pause(2_700);
  assert.equal(clock.seconds(100_000), 2);
  clock.start(100_000);
  clock.start(101_000); // repeated focus events must not reset the clock
  clock.pause(102_800);
  assert.equal(clock.seconds(300_000), 5);
  clock.start(300_000);
  assert.equal(clock.seconds(300_600), 6); // retain partial seconds at each pause
  clock.pause(300_600);
  assert.equal(clock.seconds(400_000), 6); // completed attempt is frozen
  clock.reset();
  clock.start(500_000);
  assert.equal(clock.seconds(500_900), 0); // retry starts a genuinely new attempt
});

test("reset and route changes invalidate all stale animation and completion callbacks", () => {
  const callbacks: (() => void)[] = [];
  const cancelled: unknown[] = [];
  const scheduler = new AttemptScheduler(
    ((callback: () => void) => {
      callbacks.push(callback);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout,
    ((handle: unknown) => {
      cancelled.push(handle);
    }) as unknown as typeof clearTimeout,
  );
  let removals = 0;
  let completions = 0;
  scheduler.after(350, () => {
    removals += 1;
  });
  scheduler.after(500, () => {
    completions += 1;
  });
  scheduler.cancelAll();
  assert.equal(cancelled.length, 2);
  // A platform callback already in the task queue can still run after clearTimeout.
  callbacks[0]();
  callbacks[1]();
  assert.equal(removals, 0);
  assert.equal(completions, 0);
  scheduler.after(350, () => {
    removals += 1;
  });
  callbacks[2]();
  assert.equal(removals, 1);
});

test("default scheduler timers preserve the browser global receiver", () => {
  const originalSchedule = globalThis.setTimeout;
  const originalCancel = globalThis.clearTimeout;
  let scheduled = false;
  let cancelled = false;
  const handle = 42 as unknown as ReturnType<typeof setTimeout>;
  try {
    globalThis.setTimeout = function (this: unknown) {
      assert.equal(
        this,
        globalThis,
        "Browser timers reject an incorrect receiver",
      );
      scheduled = true;
      return handle;
    } as unknown as typeof setTimeout;
    globalThis.clearTimeout = function (this: unknown, received: unknown) {
      assert.equal(
        this,
        globalThis,
        "Browser cancellation needs the global receiver",
      );
      assert.equal(received, handle);
      cancelled = true;
    } as unknown as typeof clearTimeout;
    const scheduler = new AttemptScheduler();
    scheduler.after(350, () => undefined);
    scheduler.cancelAll();
    assert.equal(scheduled, true);
    assert.equal(cancelled, true);
  } finally {
    globalThis.setTimeout = originalSchedule;
    globalThis.clearTimeout = originalCancel;
  }
});

test("mistakes and assistance determine stars even after hearts are replenished", () => {
  assert.equal(getAttemptStars(0), 3);
  assert.equal(getAttemptStars(1), 2);
  assert.equal(getAttemptStars(2), 1);
  assert.equal(getAttemptStars(0, 1), 2);
  assert.equal(getAttemptStars(3, 0, 1), 1);
  assert.equal(getAttemptStars(6, 1, 4), 1);
});

test("a hint selects a legal arrow that unlocks more arrows without removing anything", () => {
  const board: TileData[] = [
    {
      id: "independent",
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ],
      direction: "up",
    },
    {
      id: "key",
      path: [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      direction: "right",
    },
    {
      id: "blocked-one",
      path: [
        { x: 2, y: 2 },
        { x: 2, y: 1 },
      ],
      direction: "up",
    },
    {
      id: "blocked-two",
      path: [
        { x: 3, y: 2 },
        { x: 3, y: 1 },
      ],
      direction: "up",
    },
  ];
  const before = JSON.stringify(board);
  const hint = findHintTile(board, 5);
  assert.equal(hint?.id, "key");
  assert.equal(canMove(hint!, board, 5), true);
  assert.equal(JSON.stringify(board), before);
  assert.equal(
    findHintTile(
      board.map((tile) => ({ ...tile, removed: true })),
      5,
    ),
    null,
  );
});

test("hints honor shape exits using the same rules as taps", () => {
  const shape = Array.from({ length: 5 }, () => Array<boolean>(5).fill(true));
  shape[2][3] = false;
  const board: TileData[] = [
    {
      id: "shape-exit",
      path: [
        { x: 1, y: 2 },
        { x: 2, y: 2 },
      ],
      direction: "right",
    },
    {
      id: "outside-ray",
      path: [
        { x: 4, y: 3 },
        { x: 4, y: 2 },
      ],
      direction: "up",
    },
  ];
  assert.equal(canMove(board[0], board, 5), false);
  assert.equal(findHintTile(board, 5, shape)?.id, "shape-exit");
});

const original: CompletionRecord = {
  levelId: 12,
  version: 2,
  time: 60,
  heartsUsed: 0,
  stars: 3,
};

test("a faster assisted replay preserves perfect stars and independent best mistakes", () => {
  const faster = {
    ...original,
    time: 30,
    heartsUsed: 4,
    stars: 1,
    hintsUsed: 1,
    revivesUsed: 2,
  };
  const [merged] = mergeCompletionRecords([original], faster);
  assert.equal(merged.time, 30);
  assert.equal(merged.stars, 3);
  assert.equal(merged.heartsUsed, 0);
  assert.deepEqual(merged.fastestRun, {
    time: 30,
    heartsUsed: 4,
    stars: 1,
    hintsUsed: 1,
    revivesUsed: 2,
  });
  assert.equal(original.time, 60); // incoming and existing records are immutable
});

test("a slower perfect run improves stars while preserving the fastest actual run", () => {
  const faster = { ...original, time: 30, heartsUsed: 1, stars: 2 };
  const [merged] = mergeCompletionRecords([faster], original);
  assert.equal(merged.time, 30);
  assert.equal(merged.stars, 3);
  assert.equal(merged.fastestRun?.stars, 2);
  assert.equal(merged.fastestRun?.heartsUsed, 1);
});

test("new campaign boards never compete against old board times", () => {
  const legacy = { levelId: 12, time: 5, heartsUsed: 0, stars: 3 };
  const records = mergeCompletionRecords([legacy], original);
  assert.equal(records.length, 2);
  assert.equal(records[0].version, 2);
  assert.equal(records[0].time, 60);
  assert.equal(records[1].version, undefined);
  assert.equal(records[1].time, 5);
  const again = mergeCompletionRecords(records, { ...original, time: 45 });
  assert.equal(again.length, 2);
  assert.equal(again[0].time, 45);
  assert.equal(again[1].time, 5);
});

test("legacy progression migrates once and campaign replays do not farm achievements", () => {
  const migrated = normalizeUserStats({ levelsCompleted: 9 }, [original], 4);
  assert.deepEqual(migrated.completedCampaignLevelIds, [1, 2, 3, 12]);
  assert.equal(migrated.levelsCompleted, 9); // preserve previously earned progress
  const replay = applyLevelCompletion(migrated, {
    source: "campaign",
    levelId: 12,
  });
  assert.equal(replay.isFirstCompletion, false);
  assert.equal(replay.stats.levelsCompleted, 9);
  const first = applyLevelCompletion(migrated, {
    source: "campaign",
    levelId: 4,
  });
  assert.equal(first.isFirstCompletion, true);
  assert.equal(first.stats.levelsCompleted, 10);
  const replayNew = applyLevelCompletion(first.stats, {
    source: "campaign",
    levelId: 4,
  });
  assert.equal(replayNew.stats.levelsCompleted, 10);
});

test("community achievements use the unique document identity and remain separate from campaign", () => {
  let stats = normalizeUserStats(null);
  for (const communityId of ["doc-one", "doc-two", "doc-one"]) {
    stats = applyLevelCompletion(stats, {
      source: "community",
      communityId,
    }).stats;
  }
  assert.equal(stats.communityLevelsBeaten, 2);
  assert.equal(stats.levelsCompleted, 0);
  assert.deepEqual(stats.completedCommunityLevelIds, ["doc-one", "doc-two"]);
  assert.equal(
    applyLevelCompletion(stats, { source: "community", communityId: "" })
      .isFirstCompletion,
    false,
  );
  assert.equal(
    applyLevelCompletion(stats, { source: "campaign", levelId: 0 })
      .isFirstCompletion,
    false,
  );
});
