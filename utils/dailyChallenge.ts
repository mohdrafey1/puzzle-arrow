import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@daily_challenge_progress_v2";
const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_LEVEL = 40;
const LAST_LEVEL = 1500;
const LEVEL_STEP = 10;
const CHALLENGE_COUNT = (LAST_LEVEL - FIRST_LEVEL) / LEVEL_STEP + 1;

export interface DailyChallenge {
  /** A UTC calendar date shared by every player. */
  dateKey: string;
  levelId: number;
  nextResetAt: Date;
}

export interface DailyCompletion {
  dateKey: string;
  levelId: number;
  time: number;
  stars: number;
}

export interface DailyRecord extends DailyCompletion {
  /** First completion time; replays keep this and improve independent bests. */
  completedAt: string;
}

export interface DailyProgress {
  completedDates: string[];
  totalCompleted: number;
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
}

type DailyRecords = Record<string, DailyRecord>;
let pendingWrite: Promise<unknown> = Promise.resolve();

function dateOrdinal(date: Date): number {
  if (!Number.isFinite(date.getTime()))
    throw new RangeError("Invalid daily challenge date");
  return Math.floor(date.getTime() / DAY_MS);
}

function dateFromKey(dateKey: string): Date {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateKey
  ) {
    throw new RangeError("Invalid daily challenge date key");
  }
  return date;
}

/**
 * Offline rotation through the campaign's milestone challenges, not newly
 * generated daily boards. 67 is coprime to 147, so a cycle visits every level.
 * UTC avoids timezone-dependent boards and daylight-saving reset errors.
 */
export function getDailyChallenge(date = new Date()): DailyChallenge {
  const day = dateOrdinal(date);
  const index =
    (((day * 67 + 23) % CHALLENGE_COUNT) + CHALLENGE_COUNT) % CHALLENGE_COUNT;
  return {
    dateKey: date.toISOString().slice(0, 10),
    levelId: FIRST_LEVEL + index * LEVEL_STEP,
    nextResetAt: new Date((day + 1) * DAY_MS),
  };
}

function validateCompletion(record: DailyCompletion): void {
  const challenge = getDailyChallenge(dateFromKey(record.dateKey));
  if (record.levelId !== challenge.levelId)
    throw new RangeError("Daily challenge level does not match date");
  if (!Number.isFinite(record.time) || record.time < 0)
    throw new RangeError("Invalid daily completion time");
  if (!Number.isInteger(record.stars) || record.stars < 1 || record.stars > 3) {
    throw new RangeError("Invalid daily completion stars");
  }
}

async function readRecords(): Promise<DailyRecords> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  let stored: { version?: number; records?: DailyRecords };
  try {
    stored = JSON.parse(raw);
  } catch {
    return {};
  }
  if (
    !stored ||
    stored.version !== 2 ||
    !stored.records ||
    typeof stored.records !== "object"
  )
    return {};
  const records: DailyRecords = {};
  for (const [dateKey, record] of Object.entries(stored.records)) {
    try {
      if (
        !record ||
        dateKey !== record.dateKey ||
        typeof record.completedAt !== "string"
      )
        continue;
      validateCompletion(record);
      dateOrdinal(new Date(record.completedAt));
      records[dateKey] = record;
    } catch {
      // One malformed result must not discard other valid completed days.
    }
  }
  return records;
}

async function getRecords(): Promise<DailyRecords> {
  await pendingWrite;
  try {
    return await readRecords();
  } catch {
    return {};
  }
}

export async function getDailyRecord(
  dateKey = getDailyChallenge().dateKey,
): Promise<DailyRecord | null> {
  dateFromKey(dateKey);
  return (await getRecords())[dateKey] ?? null;
}

export async function getDailyProgress(
  date = new Date(),
): Promise<DailyProgress> {
  const today = dateOrdinal(date);
  const records = await getRecords();
  const completedDates = Object.keys(records).sort();
  const days = completedDates.map((key) => dateOrdinal(dateFromKey(key)));
  let bestStreak = 0;
  let running = 0;
  let previous: number | undefined;
  for (const day of days) {
    running = previous !== undefined && day === previous + 1 ? running + 1 : 1;
    bestStreak = Math.max(bestStreak, running);
    previous = day;
  }
  const completed = new Set(days);
  // Yesterday's streak remains alive until today's UTC challenge expires.
  let cursor = completed.has(today) ? today : today - 1;
  let currentStreak = 0;
  while (completed.has(cursor)) {
    currentStreak += 1;
    cursor -= 1;
  }
  return {
    completedDates,
    totalCompleted: completedDates.length,
    currentStreak,
    bestStreak,
    lastCompletedDate: completedDates.at(-1) ?? null,
  };
}

/**
 * Save the date captured when play started, even if completion crosses midnight.
 * Daily records never write campaign unlocks, achievements, currency, or scores.
 */
export async function recordDailyCompletion(
  completion: DailyCompletion,
  completedAt = new Date(),
): Promise<DailyRecord> {
  validateCompletion(completion);
  dateOrdinal(completedAt);
  const incoming: DailyRecord = {
    ...completion,
    completedAt: completedAt.toISOString(),
  };
  const write = pendingWrite.then(async () => {
    const records = await readRecords();
    const previous = records[incoming.dateKey];
    const record = previous
      ? {
          ...previous,
          time: Math.min(previous.time, incoming.time),
          stars: Math.max(previous.stars, incoming.stars),
        }
      : incoming;
    records[record.dateKey] = record;
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, records }),
    );
    return record;
  });
  // A failed write must not block all future results. The caller still receives
  // the original rejection and can surface/retry a persistence failure.
  pendingWrite = write.catch(() => undefined);
  return write;
}

/** Clear daily history after any already requested saves have finished. */
export async function clearDailyProgress(): Promise<void> {
  const clear = pendingWrite.then(() => AsyncStorage.removeItem(STORAGE_KEY));
  pendingWrite = clear.catch(() => undefined);
  return clear;
}
