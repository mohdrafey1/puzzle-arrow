import { expect, test, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { canMove, TileData } from "../../utils/movement";
import { restoreShape } from "../../constants/levels";

type BoardLevel = {
  id: number;
  size: number;
  tiles: Omit<TileData, "id">[];
  shape?: boolean[][];
};
function levelData(id: number): BoardLevel {
  const chunk = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        `assets/levels/chunk-${Math.floor((id - 1) / 50)}.json`,
      ),
      "utf8",
    ),
  );
  return chunk.find((level: BoardLevel) => level.id === id);
}
async function tapArrow(page: Page, level: BoardLevel, tile: TileData) {
  await expect(page.getByTestId("game-board")).toBeVisible();
  const box = await page.getByTestId("game-board").boundingBox();
  if (!box) throw new Error("Missing board");
  const head = tile.path[tile.path.length - 1];
  await page.mouse.click(
    box.x + ((head.x + 0.5) * box.width) / level.size,
    box.y + ((head.y + 0.5) * box.height) / level.size,
  );
}
async function clearLevel(page: Page, id: number, useHint = false) {
  const data = levelData(id),
    shape = data.shape || restoreShape(id, data.size);
  const board = data.tiles.map((tile, i) => ({ ...tile, id: String(i) }));
  if (useHint)
    await page
      .getByRole("button", { name: "Show a hint", exact: true })
      .click();
  for (let n = 0; n < board.length; n++) {
    const tile = board.find(
      (tile) => !tile.removed && canMove(tile, board, data.size, shape),
    );
    if (!tile) throw new Error("No legal move");
    await tapArrow(page, data, tile);
    tile.removed = true;
    await expect(
      page.getByText(`${board.length - n - 1} arrows left`, { exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: /Beautifully cleared|Daily complete/ }),
  ).toBeVisible();
}

test("campaign can be solved, replayed, and saved without farming completion counts", async ({
  page,
}) => {
  await page.goto("/game/1");
  await expect(
    page.getByRole("heading", { name: "Level 1", exact: true }),
  ).toBeVisible();
  await clearLevel(page, 1);
  await expect(
    page.getByRole("button", { name: "Next Level", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Level 1", exact: true }),
  ).toBeVisible();
  await clearLevel(page, 1, true);
  await expect(
    page.getByText("Hint-assisted clear. Try again for three stars.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next Level", exact: true }),
  ).toBeEnabled();
  const saved = await page.evaluate(() => ({
    stats: JSON.parse(localStorage.getItem("@user_stats") || "{}"),
    records: JSON.parse(localStorage.getItem("@completed_levels") || "[]"),
  }));
  expect(saved.stats.levelsCompleted).toBe(1);
  expect(saved.records).toHaveLength(1);
  expect(saved.records[0].stars).toBe(3);
  expect(saved.records[0].version).toBe(2);
  await page.getByRole("button", { name: "Next Level", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Level 2", exact: true }),
  ).toBeVisible();
});

test("blocked taps explain the error, retry restores the board, and helpers remain available", async ({
  page,
}) => {
  await page.goto("/game/10");
  const data = levelData(10),
    board = data.tiles.map((tile, i) => ({ ...tile, id: String(i) })),
    shape = data.shape || restoreShape(10, data.size);
  await expect(page.getByTestId("game-board")).toBeVisible();
  await page.getByRole("button", { name: "Toggle exit guides" }).click();
  await expect(page.getByText("Guides on", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Fit board", exact: true }).click();
  const blocked = board.find(
    (tile) => !canMove(tile, board, data.size, shape),
  )!;
  for (let i = 0; i < 3; i++) {
    await tapArrow(page, data, blocked);
    if (i < 2) {
      await expect(
        page.getByText(
          "That path is blocked. Follow the red line to the blocker.",
          { exact: true },
        ),
      ).toBeVisible();
      await page.waitForTimeout(650); // Wait through blocked-tap protection before intentional retry.
    }
  }
  await expect(
    page.getByRole("heading", { name: "Try a fresh approach", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry for free", exact: true })
    .click();
  await expect(
    page.getByText(`${board.length} arrows left`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show a hint", exact: true }),
  ).toBeEnabled();
});

test("daily completion stays separate from campaign progress", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play daily challenge", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Daily Challenge", exact: true }),
  ).toBeVisible();
  const id = Number(new URL(page.url()).pathname.split("/").pop());
  await clearLevel(page, id);
  await page.getByRole("button", { name: "Back to Home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Replay daily challenge", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue level 1", exact: true }),
  ).toBeVisible();
  const campaign = await page.evaluate(() =>
    localStorage.getItem("@completed_levels"),
  );
  expect(campaign).toBeNull();
});

test("missing preview links recover without generating an invalid board", async ({
  page,
}) => {
  await page.goto("/game/0?source=community&communityId=missing");
  await expect(
    page.getByText("This puzzle is unavailable", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to Home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue level 1", exact: true }),
  ).toBeVisible();
});

test("zoomed taps select the correct arrow and dragging does not cost a heart", async ({
  page,
}) => {
  await page.goto("/game/1");
  await expect(page.getByTestId("game-board")).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const data = levelData(1),
    board = data.tiles.map((tile, i) => ({ ...tile, id: String(i) }));
  await expect
    .poll(
      async () => (await page.getByTestId("game-board").boundingBox())?.width,
    )
    .toBeGreaterThan(400);
  const tile = board.find((tile) =>
    canMove(tile, board, data.size, restoreShape(1, data.size)),
  )!;
  await tapArrow(page, data, tile);
  await expect(page.getByText("2 arrows left", { exact: true })).toBeVisible();
  const box = (await page.getByTestId("game-board").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 55,
    box.y + box.height / 2 + 35,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(
    page.getByLabel("3 of 3 hearts remaining", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 arrows left", { exact: true })).toBeVisible();
});

test("a failed daily save can be retried without replaying the board", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === "@daily_challenge_progress_v2" && fail) {
        fail = false;
        throw new Error("Test quota failure");
      }
      return original.call(this, key, value);
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play daily challenge", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Daily Challenge", exact: true }),
  ).toBeVisible();
  const id = Number(new URL(page.url()).pathname.split("/").pop());
  await clearLevel(page, id);
  await expect(
    page.getByRole("button", { name: "Retry saving", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry saving", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Back to Home", exact: true }),
  ).toBeEnabled();
  const records = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("@daily_challenge_progress_v2") || "{}")
        .records,
  );
  expect(Object.keys(records)).toHaveLength(1);
});

test("help fits a small screen and pauses active solving time", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/game/1");
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  const paused = await page.getByTestId("elapsed-time").textContent();
  await page.waitForTimeout(1200); // Verify that real elapsed wall time is excluded while help is open.
  expect(await page.getByTestId("elapsed-time").textContent()).toBe(paused);
  await page.getByRole("button", { name: "Let’s play", exact: true }).click();
  await expect(page.getByTestId("game-board")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show a hint", exact: true }),
  ).toBeVisible();
});

test("legacy records remain separate when replaying a rebuilt level", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "@completed_levels",
      JSON.stringify([{ levelId: 1, time: 1, heartsUsed: 0, stars: 3 }]),
    );
    localStorage.setItem("@unlocked_level", "2");
  });
  await page.goto("/completed-levels");
  await expect(
    page.getByText("Original campaign record", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play new edition of level 1", exact: true })
    .click();
  await clearLevel(page, 1);
  await page
    .getByRole("button", { name: "Completed Levels", exact: true })
    .click();
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("@completed_levels") || "[]"),
  );
  expect(records).toHaveLength(2);
  expect(
    records.find((r: { version?: number }) => !r.version || r.version === 1)
      .time,
  ).toBe(1);
});
