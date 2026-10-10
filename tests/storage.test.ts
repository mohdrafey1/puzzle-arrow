import assert from "node:assert/strict";
import Module from "node:module";
import { beforeEach, test } from "node:test";

const values = new Map<string, string>();
let failReadKey: string | null = null;
let failWriteKey: string | null = null;
const memoryStorage = {
  async getItem(key: string): Promise<string | null> {
    // Yield at each IO boundary, exposing lost-update races in concurrent calls.
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (failReadKey === key) {
      failReadKey = null;
      throw new Error("Storage read unavailable");
    }
    return values.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (failWriteKey === key) {
      failWriteKey = null;
      throw new Error("Storage write unavailable");
    }
    values.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    values.delete(key);
  },
  async multiRemove(keys: string[]): Promise<void> {
    keys.forEach((key) => values.delete(key));
  },
};

// Replace the native storage boundary only; exercise the real production functions.
const loader = Module as unknown as {
  _load: (request: string, ...rest: unknown[]) => unknown;
};
const originalLoad = loader._load;
loader._load = function (request, ...rest) {
  return request === "@react-native-async-storage/async-storage"
    ? memoryStorage
    : originalLoad.call(this, request, ...rest);
};
let storage: typeof import("../utils/storage");
try {
  storage = Module.createRequire(__filename)("../utils/storage");
} finally {
  loader._load = originalLoad;
}

beforeEach(() => {
  values.clear();
  failReadKey = null;
  failWriteKey = null;
});

test("saving a fresh result before the achievement callback still counts a first completion", async () => {
  await storage.saveCompletedLevel({
    levelId: 1,
    version: 2,
    time: 0,
    heartsUsed: 0,
    stars: 3,
  });
  const result = await storage.recordLevelCompletion({
    source: "campaign",
    levelId: 1,
  });
  assert.equal(result.isFirstCompletion, true);
  assert.equal(result.stats.levelsCompleted, 1);
  assert.equal((await storage.getCompletedLevels())[0].time, 0);
  const replay = await storage.recordLevelCompletion({
    source: "campaign",
    levelId: 1,
  });
  assert.equal(replay.isFirstCompletion, false);
  assert.equal(replay.stats.levelsCompleted, 1);
});

test("concurrent wins and duplicate callbacks cannot lose or double-count campaign/community progress", async () => {
  await Promise.all([
    storage.recordLevelCompletion({ source: "campaign", levelId: 1 }),
    storage.recordLevelCompletion({ source: "campaign", levelId: 1 }),
    storage.recordLevelCompletion({ source: "campaign", levelId: 2 }),
    storage.recordLevelCompletion({
      source: "community",
      communityId: "alpha",
    }),
    storage.recordLevelCompletion({ source: "community", communityId: "beta" }),
    storage.recordLevelCompletion({
      source: "community",
      communityId: "alpha",
    }),
  ]);
  const stats = await storage.getUserStats();
  assert.equal(stats.levelsCompleted, 2);
  assert.equal(stats.communityLevelsBeaten, 2);
  assert.deepEqual(stats.completedCampaignLevelIds, [1, 2]);
  assert.deepEqual(stats.completedCommunityLevelIds, ["alpha", "beta"]);
});

test("concurrent replay saves preserve best stars, fastest time and original campaign history", async () => {
  values.set(
    "@completed_levels",
    JSON.stringify([{ levelId: 1, time: 3, heartsUsed: 0, stars: 3 }]),
  );
  await Promise.all([
    storage.saveCompletedLevel({
      levelId: 1,
      version: 2,
      time: 20,
      heartsUsed: 0,
      stars: 3,
    }),
    storage.saveCompletedLevel({
      levelId: 1,
      version: 2,
      time: 10,
      heartsUsed: 3,
      stars: 1,
      revivesUsed: 1,
    }),
    storage.saveCompletedLevel({
      levelId: 2,
      version: 2,
      time: 25,
      heartsUsed: 1,
      stars: 2,
    }),
  ]);
  const records = await storage.getCompletedLevels();
  assert.equal(records.length, 3);
  assert.equal(records[0].time, 10);
  assert.equal(records[0].stars, 3);
  assert.equal(records[0].fastestRun?.revivesUsed, 1);
  assert.equal(records[1].version, undefined);
  assert.equal(records[1].time, 3);
  assert.equal(records[2].levelId, 2);
});

test("unlock writes never move progression backwards and reset clears campaign identity tracking", async () => {
  await Promise.all([storage.setUnlockedLevel(9), storage.setUnlockedLevel(3)]);
  assert.equal(await storage.getUnlockedLevel(), 9);
  await storage.recordLevelCompletion({
    source: "community",
    communityId: "alpha",
  });
  values.set(
    "@daily_challenge_progress_v2",
    JSON.stringify({ version: 2, records: {} }),
  );
  await storage.resetProgress();
  assert.equal(values.has("@daily_challenge_progress_v2"), false);
  assert.equal(await storage.getUnlockedLevel(), 1);
  const stats = await storage.getUserStats();
  assert.equal(stats.levelsCompleted, 0);
  assert.deepEqual(stats.completedCampaignLevelIds, []);
  assert.equal(stats.communityLevelsBeaten, 1);
  assert.deepEqual(await storage.getCompletedLevels(), []);
});

test("failed completion writes reject and a later retry recovers without duplicate wins", async () => {
  failWriteKey = "@user_stats";
  await assert.rejects(
    storage.recordLevelCompletion({ source: "campaign", levelId: 1 }),
    /unavailable/,
  );
  assert.equal((await storage.getUserStats()).levelsCompleted, 0);
  const recovered = await storage.recordLevelCompletion({
    source: "campaign",
    levelId: 1,
  });
  assert.equal(recovered.isFirstCompletion, true);
  const record = { levelId: 1, version: 2, time: 10, heartsUsed: 0, stars: 3 };
  failWriteKey = "@completed_levels";
  await assert.rejects(storage.saveCompletedLevel(record), /unavailable/);
  assert.deepEqual(await storage.getCompletedLevels(), []);
  await storage.saveCompletedLevel(record);
  assert.equal((await storage.getCompletedLevels()).length, 1);
  const retried = await storage.recordLevelCompletion({
    source: "campaign",
    levelId: 1,
  });
  assert.equal(retried.isFirstCompletion, false);
  assert.equal(retried.stats.levelsCompleted, 1);
  failWriteKey = "@unlocked_level";
  await assert.rejects(storage.setUnlockedLevel(2), /unavailable/);
  await storage.setUnlockedLevel(2);
  assert.equal(await storage.getUnlockedLevel(), 2);
});

test("temporary read failures never overwrite existing progress or completion history", async () => {
  await storage.recordLevelCompletion({ source: "campaign", levelId: 1 });
  const original = {
    levelId: 1,
    version: 2,
    time: 10,
    heartsUsed: 0,
    stars: 3,
  };
  await storage.saveCompletedLevel(original);
  await storage.setUnlockedLevel(2);
  failReadKey = "@user_stats";
  await assert.rejects(
    storage.recordLevelCompletion({ source: "campaign", levelId: 2 }),
    /unavailable/,
  );
  failReadKey = "@completed_levels";
  await assert.rejects(
    storage.saveCompletedLevel({ ...original, levelId: 2 }),
    /unavailable/,
  );
  failReadKey = "@unlocked_level";
  await assert.rejects(storage.setUnlockedLevel(3), /unavailable/);
  assert.equal((await storage.getUserStats()).levelsCompleted, 1);
  assert.equal((await storage.getCompletedLevels()).length, 1);
  assert.equal(await storage.getUnlockedLevel(), 2);
});

test("malformed saved history is preserved for recovery instead of being silently replaced", async () => {
  values.set("@completed_levels", "{broken");
  await assert.rejects(
    storage.saveCompletedLevel({
      levelId: 1,
      version: 2,
      time: 10,
      heartsUsed: 0,
      stars: 3,
    }),
  );
  assert.equal(values.get("@completed_levels"), "{broken");
});
