import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { restoreShape, LevelData } from "../constants/levels";
import {
  analyzeLevel,
  CAMPAIGN_LEVEL_COUNT,
  CAMPAIGN_VERSION,
  DifficultyMetrics,
  DifficultyProfile,
  getDifficultyProfile,
} from "../constants/levelDifficulty";
import { validateLevel } from "./level-validation";

const rows: (DifficultyMetrics & {
  id: number;
  size: number;
  kind: DifficultyProfile["kind"];
})[] = [];
for (let chunk = 0; chunk < Math.ceil(CAMPAIGN_LEVEL_COUNT / 50); chunk++) {
  const levels = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `../assets/levels/chunk-${chunk}.json`),
      "utf8",
    ),
  ) as LevelData[];
  assert.equal(levels.length, 50, `Chunk ${chunk} is incomplete`);
  for (const [offset, raw] of levels.entries()) {
    assert.equal(raw.id, chunk * 50 + offset + 1, "Chunk order mismatch");
    const level = {
      ...raw,
      shape: raw.shape ?? restoreShape(raw.id, raw.size),
    };
    validateLevel(level);
    assert.equal(
      level.version,
      CAMPAIGN_VERSION,
      `Level ${level.id}: stale campaign version`,
    );
    assert.deepEqual(
      level.difficulty?.profile,
      getDifficultyProfile(level.id),
      `Level ${level.id}: stale profile`,
    );
    assert(
      level.size <= 20,
      `Level ${level.id}: exceeds phone readability limit`,
    );
    const metrics = analyzeLevel(level);
    if (level.id > 5) {
      assert(
        metrics.dependencyDepth >= 3,
        `Level ${level.id}: trivial blocking structure`,
      );
      assert(
        metrics.startingMoveRatio <= 0.6,
        `Level ${level.id}: too many immediate exits`,
      );
      assert.equal(
        metrics.independentTiles,
        0,
        `Level ${level.id}: isolated filler arrow`,
      );
    }
    rows.push({
      id: level.id,
      size: level.size,
      kind: level.difficulty!.profile.kind,
      ...metrics,
    });
  }
}
const keys = [
  "size",
  "tileCount",
  "startingMoveRatio",
  "dependencyDepth",
  "multiBlockerTiles",
  "meanAvailableRatio",
] as const;
const ranges = [
  [1, 40],
  [41, 80],
  [81, 160],
  [161, 500],
  [501, 1000],
  [1001, 1500],
];
const summary = ranges.map(([from, to]) => {
  const subset = rows.filter((row) => row.id >= from && row.id <= to);
  return {
    levels: `${from}–${to}`,
    ...Object.fromEntries(
      keys.map((key) => [
        key,
        Number(
          (
            subset.reduce((sum, row) => sum + row[key], 0) / subset.length
          ).toFixed(4),
        ),
      ]),
    ),
  };
});
console.table(summary);
const cadence = ["learn", "breather", "build", "challenge"].map((kind) => {
  const subset = rows.filter((row) => row.kind === kind);
  return {
    kind,
    levels: subset.length,
    ...Object.fromEntries(
      keys.map((key) => [
        key,
        Number(
          (
            subset.reduce((sum, row) => sum + row[key], 0) / subset.length
          ).toFixed(4),
        ),
      ]),
    ),
  };
});
console.table(cadence);
console.log(
  `PASS: ${rows.length} boards; real movement rules, shape/path invariants, solvability, metrics, campaign version and difficulty floors.`,
);
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0) {
  assert(process.argv[outputIndex + 1], "--output requires a filename");
  fs.writeFileSync(
    process.argv[outputIndex + 1],
    `${JSON.stringify({ campaignVersion: CAMPAIGN_VERSION, levels: rows.length, summary, cadence, rows }, null, 2)}\n`,
  );
}
