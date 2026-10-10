import assert from "node:assert/strict";
import Module from "node:module";
import type { DailyCompletion } from "../utils/dailyChallenge";

// Exercise the real storage functions with an in-memory native storage adapter.
const data = new Map<string, string>();
let failWrite = false;
const storagePath =
  require.resolve("@react-native-async-storage/async-storage");
const storageModule = new Module(storagePath);
storageModule.exports = {
  getItem: async (key: string) => data.get(key) ?? null,
  removeItem: async (key: string) => {
    data.delete(key);
  },
  setItem: async (key: string, value: string) => {
    if (failWrite) throw new Error("Storage temporarily unavailable");
    // Give overlapping saves a chance to race if serialization is removed.
    await new Promise((resolve) => setImmediate(resolve));
    data.set(key, value);
  },
};
require.cache[storagePath] = storageModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Install the native adapter before loading the implementation.
const daily: typeof import("../utils/dailyChallenge") = require("../utils/dailyChallenge");
const {
  getDailyChallenge,
  getDailyRecord,
  getDailyProgress,
  recordDailyCompletion,
  clearDailyProgress,
} = daily;

function completion(dateKey: string, time = 90, stars = 3): DailyCompletion {
  return {
    dateKey,
    levelId: getDailyChallenge(new Date(`${dateKey}T12:00:00Z`)).levelId,
    time,
    stars,
  };
}

async function run() {
  const before = getDailyChallenge(new Date("2026-10-07T23:59:59.999Z"));
  const after = getDailyChallenge(new Date("2026-10-08T00:00:00.000Z"));
  assert.equal(before.dateKey, "2026-10-07");
  assert.equal(before.nextResetAt.toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal(after.dateKey, "2026-10-08");
  assert.notEqual(before.levelId, after.levelId);
  assert.deepEqual(
    getDailyChallenge(new Date("2026-10-08T05:29:59.999+05:30")),
    before,
    "Equivalent instants must select the same board regardless of timezone",
  );
  assert.equal(
    getDailyChallenge(
      new Date("2028-02-28T23:00:00Z"),
    ).nextResetAt.toISOString(),
    "2028-02-29T00:00:00.000Z",
  );
  assert.equal(
    getDailyChallenge(
      new Date("2028-02-29T23:00:00Z"),
    ).nextResetAt.toISOString(),
    "2028-03-01T00:00:00.000Z",
  );
  assert.equal(
    getDailyChallenge(
      new Date("2026-12-31T23:00:00Z"),
    ).nextResetAt.toISOString(),
    "2027-01-01T00:00:00.000Z",
  );
  assert.equal(
    getDailyChallenge(
      new Date("2026-03-08T01:30:00-05:00"),
    ).nextResetAt.toISOString(),
    "2026-03-09T00:00:00.000Z",
  );
  assert.throws(() => getDailyChallenge(new Date("invalid")), RangeError);

  const cycle = Array.from(
    { length: 147 },
    (_, offset) =>
      getDailyChallenge(new Date(Date.UTC(2026, 0, 1 + offset))).levelId,
  );
  assert.equal(
    new Set(cycle).size,
    147,
    "Rotation should visit every milestone before repeating",
  );
  assert.ok(
    cycle.every((level) => level >= 40 && level <= 1500 && level % 10 === 0),
  );

  data.set("@unlocked_level", "8");
  data.set("@completed_levels", "[]");
  data.set("@user_stats", '{"levelsCompleted":7}');
  assert.equal(await getDailyRecord("2026-10-07"), null);
  assert.equal(
    (await getDailyProgress(new Date("2026-10-07T12:00:00Z"))).currentStreak,
    0,
  );
  const first = await recordDailyCompletion(
    completion("2026-10-07", 90, 3),
    new Date("2026-10-08T00:01:00Z"),
  );
  await recordDailyCompletion(completion("2026-10-07", 40, 1));
  await recordDailyCompletion(completion("2026-10-07", 120, 2));
  const replay = await getDailyRecord("2026-10-07");
  assert.equal(replay?.time, 40, "Fastest time survives a slower replay");
  assert.equal(
    replay?.stars,
    3,
    "Faster imperfect replay must preserve perfect stars",
  );
  assert.equal(
    replay?.completedAt,
    first.completedAt,
    "Replay must keep first completion",
  );
  assert.equal(
    (await getDailyProgress(new Date("2026-10-08T12:00:00Z"))).totalCompleted,
    1,
  );
  assert.equal(
    (await getDailyProgress(new Date("2026-10-08T12:00:00Z"))).currentStreak,
    1,
    "Yesterday remains eligible until midnight",
  );
  assert.equal(
    (await getDailyProgress(new Date("2026-10-09T12:00:00Z"))).currentStreak,
    0,
    "Missing an entire day resets current streak",
  );

  await Promise.all([
    recordDailyCompletion(completion("2026-10-08")),
    recordDailyCompletion(completion("2026-10-09", 30, 1)),
    recordDailyCompletion(completion("2026-10-09", 70, 3)),
  ]);
  const streak = await getDailyProgress(new Date("2026-10-09T12:00:00Z"));
  assert.equal(
    streak.totalCompleted,
    3,
    "Concurrent duplicate completions count once",
  );
  assert.equal(streak.currentStreak, 3);
  assert.equal(streak.bestStreak, 3);
  assert.equal((await getDailyRecord("2026-10-09"))?.time, 30);
  assert.equal((await getDailyRecord("2026-10-09"))?.stars, 3);
  await recordDailyCompletion(completion("2026-10-11"));
  const gap = await getDailyProgress(new Date("2026-10-11T12:00:00Z"));
  assert.equal(gap.currentStreak, 1);
  assert.equal(gap.bestStreak, 3);
  assert.equal(gap.lastCompletedDate, "2026-10-11");

  assert.equal(data.get("@unlocked_level"), "8");
  assert.equal(data.get("@completed_levels"), "[]");
  assert.equal(data.get("@user_stats"), '{"levelsCompleted":7}');
  assert.equal(
    data.size,
    4,
    "Daily saves only touch their own versioned storage key",
  );
  await assert.rejects(
    recordDailyCompletion({ ...completion("2026-10-12"), levelId: 1 }),
    RangeError,
  );
  await assert.rejects(
    recordDailyCompletion({
      ...completion("2026-10-12"),
      dateKey: "2026-02-30",
    }),
    RangeError,
  );
  await assert.rejects(
    recordDailyCompletion(completion("2026-10-12", -1)),
    RangeError,
  );
  await assert.rejects(
    recordDailyCompletion(completion("2026-10-12", 1, 4)),
    RangeError,
  );

  failWrite = true;
  await assert.rejects(recordDailyCompletion(completion("2026-10-12")));
  failWrite = false;
  await recordDailyCompletion(completion("2026-10-12"));
  assert.equal(
    (await getDailyProgress(new Date("2026-10-12T12:00:00Z"))).currentStreak,
    2,
    "Write queue recovers after temporary failure",
  );

  const storageKey = [...data.keys()].find((key) => key.startsWith("@daily_"))!;
  const stored = JSON.parse(data.get(storageKey)!);
  stored.records["2026-02-30"] = {
    ...completion("2026-10-12"),
    dateKey: "2026-02-30",
  };
  data.set(storageKey, JSON.stringify(stored));
  assert.equal(
    (await getDailyProgress()).totalCompleted,
    5,
    "Malformed records must not discard valid history",
  );
  data.set(storageKey, "{broken json");
  assert.equal(
    (await getDailyProgress()).totalCompleted,
    0,
    "Corrupt local data should not break the home screen",
  );
  const pending = recordDailyCompletion(completion("2026-10-12"));
  await clearDailyProgress();
  await pending;
  assert.equal(
    (await getDailyProgress()).totalCompleted,
    0,
    "Reset must wait for outstanding saves before removing history",
  );
  assert.equal(
    data.get("@unlocked_level"),
    "8",
    "Daily reset must leave campaign data alone",
  );
  await recordDailyCompletion(completion("2026-10-13"));
  assert.equal(
    (await getDailyProgress()).totalCompleted,
    1,
    "New daily saves must remain available after reset",
  );
  console.log(
    "Daily challenge checks passed: UTC rollover, rotation, replay bests, streaks, concurrency, isolation, recovery.",
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
