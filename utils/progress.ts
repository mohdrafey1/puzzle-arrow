export interface CompletionRun {
  time: number;
  /** Total mistakes in the attempt, including mistakes before a revive. */
  heartsUsed: number;
  stars: number;
  hintsUsed?: number;
  revivesUsed?: number;
}

export interface CompletionRecord extends CompletionRun {
  levelId: number;
  /** Missing on original campaign records, which belong to version 1. */
  version?: number;
  /** Coherent run details; top-level time/stars/mistakes are independent bests. */
  fastestRun?: CompletionRun;
}

export interface UserStats {
  levelsCompleted: number;
  communityLevelsBeaten: number;
  levelsCreated: number;
  completedCommunityLevelIds: string[];
  completedCampaignLevelIds: number[];
}

export type LevelCompletionIdentity =
  | { source: "campaign"; levelId: number }
  | { source: "community"; communityId: string };

export function completionVersion(record: CompletionRecord): number {
  return record.version ?? 1;
}

function runDetails(record: CompletionRecord): CompletionRun {
  return {
    time: record.time,
    heartsUsed: record.heartsUsed,
    stars: record.stars,
    hintsUsed: record.hintsUsed ?? 0,
    revivesUsed: record.revivesUsed ?? 0,
  };
}

/** A faster assisted replay must not overwrite a previous perfect result. */
export function mergeCompletionRecords(
  records: CompletionRecord[],
  incoming: CompletionRecord,
): CompletionRecord[] {
  const result = [...records];
  const index = result.findIndex(
    (record) =>
      record.levelId === incoming.levelId &&
      completionVersion(record) === completionVersion(incoming),
  );
  if (index === -1) {
    result.push({ ...incoming, fastestRun: runDetails(incoming) });
  } else {
    const previous = result[index];
    const faster = incoming.time < previous.time;
    result[index] = {
      ...previous,
      time: Math.min(previous.time, incoming.time),
      stars: Math.max(previous.stars, incoming.stars),
      heartsUsed: Math.min(previous.heartsUsed, incoming.heartsUsed),
      hintsUsed: Math.min(previous.hintsUsed ?? 0, incoming.hintsUsed ?? 0),
      revivesUsed: Math.min(
        previous.revivesUsed ?? 0,
        incoming.revivesUsed ?? 0,
      ),
      fastestRun: faster
        ? runDetails(incoming)
        : (previous.fastestRun ?? runDetails(previous)),
    };
  }
  return result.sort(
    (a, b) =>
      a.levelId - b.levelId || completionVersion(b) - completionVersion(a),
  );
}

export function normalizeUserStats(
  stored: Partial<UserStats> | null,
  completions: CompletionRecord[] = [],
  unlockedLevel = 1,
): UserStats {
  const knownIds = new Set(
    (stored?.completedCampaignLevelIds ?? []).filter(
      (id) => Number.isInteger(id) && id > 0,
    ),
  );
  for (const record of completions) {
    if (Number.isInteger(record.levelId) && record.levelId > 0) {
      knownIds.add(record.levelId);
    }
  }
  // The old app unlocked campaign levels sequentially; retain that progress even
  // if an earlier completion was not saved (for example a sub-second clear).
  for (let id = 1; id < Math.min(unlockedLevel, 100_001); id += 1)
    knownIds.add(id);
  const communityIds = [
    ...new Set(stored?.completedCommunityLevelIds ?? []),
  ].filter(Boolean);
  return {
    // Historical versions counted replays. Keep earned achievement progress
    // as a floor; only previously unseen IDs will increment it from now on.
    levelsCompleted: Math.max(stored?.levelsCompleted ?? 0, knownIds.size),
    communityLevelsBeaten: Math.max(
      stored?.communityLevelsBeaten ?? 0,
      communityIds.length,
    ),
    levelsCreated: stored?.levelsCreated ?? 0,
    completedCampaignLevelIds: [...knownIds].sort((a, b) => a - b),
    completedCommunityLevelIds: communityIds,
  };
}

export function applyLevelCompletion(
  current: UserStats,
  identity: LevelCompletionIdentity,
): { stats: UserStats; isFirstCompletion: boolean } {
  if (identity.source === "community") {
    const id = identity.communityId.trim();
    if (!id || current.completedCommunityLevelIds.includes(id)) {
      return { stats: current, isFirstCompletion: false };
    }
    return {
      isFirstCompletion: true,
      stats: {
        ...current,
        communityLevelsBeaten: current.communityLevelsBeaten + 1,
        completedCommunityLevelIds: [...current.completedCommunityLevelIds, id],
      },
    };
  }
  const id = identity.levelId;
  if (
    !Number.isInteger(id) ||
    id < 1 ||
    current.completedCampaignLevelIds.includes(id)
  ) {
    return { stats: current, isFirstCompletion: false };
  }
  return {
    isFirstCompletion: true,
    stats: {
      ...current,
      levelsCompleted: current.levelsCompleted + 1,
      completedCampaignLevelIds: [
        ...current.completedCampaignLevelIds,
        id,
      ].sort((a, b) => a - b),
    },
  };
}
