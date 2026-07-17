# Application Analysis Report

**Project:** Puzzle Arrow (Expo / React Native mobile puzzle game)
**Version audited:** 1.1.3 (`app.json` / `package.json`)
**Stack:** Expo Router 6, React Native 0.81, React 19, NativeWind 4 (Tailwind), Reanimated 4, Firebase Realtime Database, AdMob, AsyncStorage
**Audit date:** 2026-07-17
**Scope:** Full source tree (`app/`, `components/`, `hooks/`, `utils/`, `constants/`, `assets/`, config). This is a static code + architecture audit — no device runtime/emulator was available, so visual observations are inferred from the JSX/styles and are flagged as such.

---

## Executive Summary

Puzzle Arrow is a feature-rich, thoughtfully engineered casual game. The core gameplay engine (`useGameEngine`, `movement.ts`, backward level generation) is genuinely well-designed: it uses ref-based state to avoid re-renders, coalesces removals, batches SVG drawing, and mathematically guarantees solvable generated levels. Offline handling, ad retry/backoff, and animation polish are all above average for a hobby project.

However, the audit surfaced **one class of critical, ship-blocking functional bugs** — the entire **Community levels progression + achievements system is dead code** because community levels and editor previews are both routed through `levelId = 0`, and a guard clause silently discards all community completions. In addition, the **entire ~34 MB static level dataset is eagerly imported at startup**, which is a serious memory/cold-start liability on low-end Android hardware. Several correctness, security (Firebase rules / unvalidated user content), persistence, keyboard/SafeArea, and accessibility gaps round out the list.

| Metric | Count |
|---|---|
| **Overall quality score** | **6.5 / 10** |
| Total issues found | 51 |
| 🔴 Critical | 5 |
| 🟠 High | 9 |
| 🟡 Medium | 14 |
| ⚪ Low | 23 |

**Top 3 things to fix first:**
1. Community progression is completely broken (Issue #1 / #2) — a core advertised feature does nothing.
2. 34 MB of level JSON is loaded into memory at boot (Issue #3).
3. Untrusted Firebase content can crash the game and is writable/spoofable without server rules (Issue #4 / #5).

---

# Critical Issues

## Issue #1 — Community level completions are never recorded (feature is dead)
- **Severity:** Critical
- **Category:** Feature / Logic / Data
- **Screen / File:** `app/game/[level].tsx` (lines 57, 85–90, 96–133), `app/(tabs)/daily.tsx:145`
- **Description:** Community levels are launched with `router.push("/game/0?source=community")`, so `levelId === 0`. In the game screen, `isPreview = levelId === 0` is therefore **true for every community level**. `handleComplete()` begins with `if (isPreview) { markPreviewPassed(); return; }`, which returns **before** the `if (isCommunity) { … }` block that increments `communityLevelsBeaten` and pushes to `completedCommunityLevelIds`.
- **Expected:** Beating a community level increments `communityLevelsBeaten`, records the level id, and can unlock the `community_10 / 50 / 100` achievements ("Community Explorer/Master/Legend").
- **Actual:** The community-progression branch is unreachable. `communityLevelsBeaten` stays `0` forever, and the three community achievements (worth 1,850 Arrows) **can never be earned**. The completion overlay still shows "Community Level — Cleared!", so the failure is invisible to the user.
- **Suggested Fix:** Distinguish preview from community by source, not by id. E.g. `const isPreview = levelId === 0 && !isCommunity;` and evaluate `isCommunity` first in `handleComplete`. Better: give community play its own route/param carrying the real Firebase level id (see Issue #2) instead of overloading `0`.

## Issue #2 — All community levels share `levelId = 0`, so they can't be de-duplicated
- **Severity:** Critical
- **Category:** Logic / Data model
- **Screen / File:** `app/(tabs)/daily.tsx:132–146`, `app/game/[level].tsx:98–109`
- **Description:** `handlePlayLevel` hard-codes `id: 0` and navigates to `/game/0`. The community level's actual Firebase key (`item.id`, a string) is never passed to the game screen. Even if Issue #1 were fixed, the completion logic does `completedCommunityLevelIds.includes(levelId.toString())` → always `"0"`, so **every** distinct community level would be treated as the same level. `communityLevelsBeaten` would cap at 1.
- **Expected:** Each community level is tracked by its unique id; beating 10 different community levels counts as 10.
- **Actual:** No per-level identity survives the navigation; deduping is impossible.
- **Suggested Fix:** Pass the real community id through the route (`/game/community?cid=<firebaseKey>` or a param) and store that key in `completedCommunityLevelIds`. Keep the in-memory `previewLevel` mechanism only for editor previews.

## Issue #3 — Entire 34 MB static level dataset is eagerly imported at startup
- **Severity:** Critical (performance / memory)
- **Category:** Performance / Architecture
- **Screen / File:** `assets/levels/index.ts:1–30`
- **Description:** `index.ts` statically `import`s all 30 JSON chunks (chunk-0 … chunk-29), totaling **~34 MB** of level data (`du -sh assets/levels` = 34M). Metro bundles and the JS engine parses/retains **all 1,500 levels in memory** the moment the module is first referenced (which happens on the very first game load), regardless of which level the player is on.
- **Expected:** Only the chunk containing the current level is loaded/parsed, lazily.
- **Actual:** A single continuous ~34 MB allocation of parsed objects sits in the JS heap for the whole session. On low-RAM Android devices this materially raises cold-start time, increases GC pressure, and risks OOM/jank. It also bloats the JS bundle and hydration cost.
- **Suggested Fix:** Lazy-load chunks on demand (e.g. dynamic `import()` / `require` inside `getStaticLevel`, or ship chunks as bundled `Asset`s fetched via `expo-asset` and `JSON.parse`d per range and cached in an LRU). Only keep the active chunk (±1) resident. The existing `getCachedLevel`/`setCachedLevel` AsyncStorage helpers suggest this was intended but is unused.

## Issue #4 — Untrusted community level data is used unvalidated (crash + solvability)
- **Severity:** Critical
- **Category:** Security / Robustness / Correctness
- **Screen / File:** `app/(tabs)/daily.tsx:132–146`, `utils/movement.ts:27–40`, `utils/communityLevels.ts`
- **Description:** Community levels come straight from Firebase and are fed into the engine with no schema/bounds validation. `canMove` indexes `occupied[p.y][p.x] = true` directly from tile paths. A level whose `tiles[*].path` contains a coordinate `>= size` (malformed, corrupted, or maliciously crafted via direct DB write — see Issue #5) will throw `TypeError: Cannot set properties of undefined` and crash the game screen. Separately, the editor allows **non-square** grids (rows ≠ cols, up to 50 rows), but community levels persist only a single `size` (= `max(cols, rows)`), and `handlePlayLevel` rebuilds the shape as a fully-`true` `size × size` square. A non-square level therefore plays on a different board than it was designed/play-tested on, potentially making it **unsolvable or trivially different**.
- **Expected:** Level data is validated (size in range, every path cell in-bounds, directions valid) before play; a level's true row/col dimensions are preserved.
- **Actual:** No validation; malformed data crashes; non-square levels are silently reshaped.
- **Suggested Fix:** Add a `validateCommunityLevel()` guard on fetch and before play (reject/skip invalid). Persist `rows`/`cols` (and the real shape) with the level; rebuild the exact shape mask when playing. Wrap the game screen in an error boundary.

## Issue #5 — Firebase writes are client-trusted; no evidence of security rules or server validation
- **Severity:** Critical
- **Category:** Security
- **Screen / File:** `utils/firebase.ts`, `utils/leaderboard.ts`, `utils/communityLevels.ts`
- **Description:** All leaderboard and community writes go directly from the unauthenticated client to Realtime Database. `submitScore` writes `leaderboard/<username>` with an arbitrary `level`; `voteCommunityLevel` and `submitCommunityLevel` write vote counts and level payloads. There is no authentication (anonymous or otherwise) and the repo contains no `database.rules.json`. Without strict server-side rules, **anyone can spoof any username's score, overwrite others' entries, inflate/deflate vote counts, or inject malformed levels** (feeding Issue #4). Username "ownership" is only enforced by a client-side `checkUsernameAvailable` read-then-write, which is racy and trivially bypassed. Vote integrity relies on a client read-modify-write (`get` then `update`) that is **not a transaction**, so concurrent voters corrupt totals.
- **Expected:** Server-enforced rules validating shape/ownership; transactional vote counters; auth-scoped writes.
- **Actual:** Trust boundary is entirely on the client.
- **Suggested Fix:** Add Realtime Database security rules (validate types, bounds, that a user can only write their own leaderboard node, that votes are append-only per user). Use Firebase `runTransaction` for vote counters. Consider Firebase Anonymous Auth to bind usernames to UIDs. Note: `apiKey` etc. being `EXPO_PUBLIC_*` is expected (public), so the exposure risk is the **rules**, not the key.

---

# High Priority Issues

## Issue #6 — Dark Mode preference is saved but never restored
- **Severity:** High · **Category:** Feature / State · **File:** `app/_layout.tsx`, `app/(tabs)/me.tsx:107–111`, `utils/storage.ts:56–71`
- **Description:** Toggling Dark Mode calls `setColorScheme(next)` (NativeWind, in-memory) and `setThemePreference(next)` (persisted). But `getThemePreference()` is **never called anywhere** (`grep` confirms zero call sites). On next app launch NativeWind falls back to the system scheme. Also, the root `ThemeProvider` uses React Native's *system* `useColorScheme`, which does **not** follow the manual NativeWind override, so navigation chrome and NativeWind classes can disagree.
- **Expected:** The chosen theme persists across restarts and drives both NativeWind and the navigation theme.
- **Actual:** Manual theme choice is lost on restart; two theme sources can diverge.
- **Fix:** On startup, read `getThemePreference()` and call `setColorScheme(...)`; feed the same value to `ThemeProvider`. Persist "system" as a real option.

## Issue #7 — "Reset Progress" only clears two keys (misleading, incomplete)
- **Severity:** High · **Category:** Feature / Data · **File:** `utils/storage.ts:73–80`, `app/(tabs)/me.tsx:89–105`
- **Description:** The dialog says "Are you sure you want to lose **all** your progress?" but `resetProgress()` removes only `@unlocked_level` and `@completed_levels`. It leaves `@user_stats`, `@unlocked_achievements`, `@arrows_balance`, `@active_customization`, `@unlocked_items`, `@level_draft`, and `@leaderboard_username` intact.
- **Expected:** All player progress is cleared (or the copy is scoped honestly).
- **Actual:** Stats, achievements, currency, purchases, username survive — inconsistent, and confusing if a user resets to "start fresh."
- **Fix:** Either clear the full set of keys, or reword the confirmation to state exactly what resets. Consider `AsyncStorage.multiRemove([...])`.

## Issue #8 — No keyboard avoidance on any text input (inputs can be hidden)
- **Severity:** High · **Category:** UI/Keyboard · **File:** `app/(tabs)/daily.tsx` & `leaderboard.tsx` (username modals), `app/level-editor.tsx` (custom size inputs)
- **Description:** `grep` shows **zero** `KeyboardAvoidingView` usage. The username modals center a `TextInput` with `justify-center`; when the soft keyboard opens it can cover the input and the "Set Username" button, with no way to scroll. The editor's custom Cols/Rows inputs sit mid-screen with the same risk on small devices.
- **Expected:** Inputs stay visible above the keyboard.
- **Actual:** Likely-covered inputs, especially on small phones / landscape.
- **Fix:** Wrap modals/forms in `KeyboardAvoidingView` (behavior `padding` iOS / `height` Android) or use a keyboard-aware scroll container; test on a small device.

## Issue #9 — No SafeArea anywhere; immersive mode + hardcoded padding
- **Severity:** High · **Category:** Layout / Responsive · **File:** all screens; `app/_layout.tsx:21–25`
- **Description:** `react-native-safe-area-context` is a dependency but `grep` finds **no** `SafeArea`/`useSafeAreaInsets` usage. Every screen fakes top spacing with `pt-16`/`pt-12`/`mt-8`. Meanwhile `edgeToEdgeEnabled: true` and the Android nav bar is hidden with `overlay-swipe` immersive mode. On notch/Dynamic-Island/punch-hole devices and gesture-nav phones, headers may collide with the status bar and bottom content (ads, sticky footer) may sit under the gesture area.
- **Expected:** Insets-aware padding on all edges.
- **Actual:** Fixed magic paddings that only look right on a subset of devices.
- **Fix:** Adopt `SafeAreaProvider` + `useSafeAreaInsets()` (or `SafeAreaView`) and replace the fixed top/bottom paddings.

## Issue #10 — App Open ad shows on every foreground with no frequency cap
- **Severity:** High · **Category:** UX / Policy · **File:** `app/_layout.tsx:81–97`, `utils/ads.ts:299–314`
- **Description:** An `AppState` listener calls `showAppOpen()` **every** time the app becomes `active`. There is no cooldown or session cap. Combined with interstitials on completion/game-over and banners on nearly every screen, ad density is very high. Returning from a quick lock, a notification, or even from a rewarded/interstitial ad flow can trigger another full-screen App Open ad. This is both a UX friction point and an AdMob policy risk (App Open ads have frequency expectations).
- **Fix:** Add a minimum interval (e.g. ≥4 h or once per cold start) and suppress App Open ads immediately after showing another ad or when resuming within N seconds.

## Issue #11 — Voting: non-atomic counters + full list re-download per vote
- **Severity:** High · **Category:** Performance / Correctness · **File:** `app/(tabs)/daily.tsx:148–167`, `utils/communityLevels.ts:77–120`
- **Description:** `handleVote` awaits the vote write, then calls `fetchCommunityLevels()` which **re-downloads the entire `community_levels` collection** and re-sorts, causing the list to potentially reorder under the user's finger and adding latency with no optimistic UI. The vote itself is a `get`+`update` (read-modify-write), not a transaction, so concurrent votes drift counts (see Issue #5).
- **Fix:** Optimistically update the single item in local state; use a Firebase transaction for the counter; avoid full re-fetch (update just the voted level, or re-fetch that one node).

## Issue #12 — Community feed fetches the entire collection every focus (no pagination)
- **Severity:** High · **Category:** Performance / Scalability / Cost · **File:** `utils/communityLevels.ts:51–72`, `app/(tabs)/daily.tsx:86–109`
- **Description:** `fetchCommunityLevels()` does `get(ref(db, "community_levels"))` — the **whole** collection, sorted client-side — on every screen focus and every pull-to-refresh and after every vote. As the community grows this becomes an unbounded download (bandwidth, Firebase read cost, parse time, memory). The leaderboard, by contrast, correctly uses `limitToLast(100)`.
- **Fix:** Paginate with `orderByChild` + `limitToFirst/Last` + `startAfter`; add infinite scroll. Precompute a `score` field server-side (or via Cloud Function) so sorting/filtering can be indexed rather than client-side.

## Issue #13 — Home screen is not scrollable → content clipping on small phones
- **Severity:** High · **Category:** Layout / Responsive · **File:** `app/(tabs)/index.tsx:43–117`
- **Description:** The Home screen is a single `View` with `justify-center` (no `ScrollView`). It stacks: title, level card (7xl number), Community banner, Share button, Rate button, plus an **absolutely positioned** ad banner (`absolute bottom-4`). On small/short devices (or large font scaling / landscape), the centered column can exceed the viewport and clip, and the absolute ad can overlap the Rate button.
- **Fix:** Wrap content in a `ScrollView` (or reserve the ad's height with layout flow instead of `absolute`), and test at small heights and 200% font scale.

## Issue #14 — Result/Game-Over card animation is driven from render body (re-fires on unrelated re-renders)
- **Severity:** High · **Category:** Performance / Animation · **File:** `app/game/[level].tsx:251–260`
- **Description:** `cardScale.value = withSpring(...)` and `cardOpacity.value = withDelay(...)` are assigned **directly in the component body** inside `if (isComplete || isGameOver)`, not in a one-shot effect. Any re-render while the overlay is visible (e.g. `setRewardedLoaded`, `setIsWatchingAd`, toast updates) re-assigns the shared values and **restarts the spring/timing animation**, causing the card to visibly re-bounce/flicker.
- **Fix:** Move the trigger into a `useEffect` keyed on `isComplete`/`isGameOver` (fire once on transition), or use `withSpring` inside an animation callback guarded by a ref.

---

# Medium Priority Issues

## Issue #15 — Version string mismatch ("Version 1.0.0")
- **Severity:** Medium · **File:** `app/(tabs)/me.tsx:445` · The Settings footer hardcodes `Version 1.0.0` while `app.json`/`package.json` are `1.1.3`. **Fix:** read from `expo-constants` (`Constants.expoConfig.version`).

## Issue #16 — Level Editor: tag selection is placed *below* the Share button
- **Severity:** Medium · **Category:** UX / Layout · **File:** `app/level-editor.tsx:987–1229`
- The action buttons (Add Arrow → Clear → Play Test → **Share to Community**) render *above* the "Add Tags (Optional)" section. Users naturally hit Share before scrolling to tags, so most levels get published untagged (undermining the whole tag-filter feature on the Community screen). **Fix:** move the tag picker above the Share button, or into a pre-submit confirmation sheet.

## Issue #17 — Level Editor board ignores dark mode
- **Severity:** Medium · **Category:** UI consistency · **File:** `app/level-editor.tsx:879–943`
- The editor's SVG grid uses hardcoded light hex fills (`#F9FAFB`, `#E5E7EB`, `#DBEAFE`, `#FEF3C7`). In dark mode the surrounding UI is dark but the board stays bright white — jarring and inconsistent with the in-game `GameBoard`, which *does* theme itself. **Fix:** derive cell colors from `useColorScheme()` like `GameBoard.tsx` does.

## Issue #18 — Duplicate `<Toast />` roots
- **Severity:** Medium · **Category:** Code quality / Bug risk · **File:** `app/_layout.tsx:124` and `app/game/[level].tsx:555`
- Two `<Toast />` providers are mounted (root + game screen). `react-native-toast-message` expects a single root; duplicates can double-render or fight for z-index. Achievement toasts are fired from multiple screens. **Fix:** keep only the root `<Toast />`.

## Issue #19 — ~200 lines of duplicated username-modal logic
- **Severity:** Medium · **Category:** Code quality · **File:** `app/(tabs)/daily.tsx:169–215,614–708` vs `app/(tabs)/leaderboard.tsx:111–158,412–501`
- The username validation + modal JSX is copy-pasted between the two tabs with only cosmetic differences. **Fix:** extract a `<UsernameModal>` component + `useUsername()` hook.

## Issue #20 — Dynamic level generation runs 60 synchronous attempts on the JS thread
- **Severity:** Medium · **Category:** Performance · **File:** `constants/levels.ts:222–277`, `hooks/useGameEngine.ts:23–39`
- For levels > 1500 (beyond the static bundle), `generateLevel` loops up to **60** full backward-generation passes synchronously during `getLevelData`, which runs in `useState` initializer / the level-change effect — a potential multi-hundred-ms hitch and blank frame when entering such a level. **Fix:** memoize/precompute, cap attempts lower for large boards, or generate off the main thread / show a loading state.

## Issue #21 — Non-square community levels lose their dimensions
- **Severity:** Medium (overlaps #4) · **File:** `utils/communityLevels.ts`, `app/level-editor.tsx:454–475`
- Only `size = max(cols, rows)` is stored; `rows`/`cols`/shape are dropped. Any non-square creation is unplayable-as-designed. **Fix:** persist full dimensions/shape.

## Issue #22 — Purchase flow is non-atomic
- **Severity:** Medium · **Category:** Data integrity · **File:** `app/(tabs)/shop.tsx:73–79`, `utils/storage.ts:285–402`
- `handlePurchase` does `await addArrows(-price); await unlockItem(id);` as two independent AsyncStorage writes. If the process is killed between them, the user is charged without receiving the item. `addArrows` is also a read-modify-write with no locking. **Fix:** persist balance+unlocked-items in a single atomic write, or guard with an idempotent transaction.

## Issue #23 — Touch targets below 44×44 pt
- **Severity:** Medium · **Category:** Accessibility · **File:** `app/(tabs)/daily.tsx:559–606` (vote buttons ~32 px), `app/(tabs)/me.tsx:266–284` (volume ± are `w-8 h-8` = 32 px), modal close buttons
- Multiple interactive controls are ~32 px, under the 44 pt (iOS) / 48 dp (Android) minimum. **Fix:** enlarge hit areas or add `hitSlop`.

## Issue #24 — No accessibility labels on icon-only controls
- **Severity:** Medium · **Category:** Accessibility · **File:** app-wide (back buttons, vote thumbs, share/rate, volume ±, undo/redo, direction picker)
- `grep` finds no `accessibilityLabel`/`accessibilityRole`/`accessibilityHint`. Icon-only `Pressable`s are unlabeled, so VoiceOver/TalkBack users hear nothing meaningful. **Fix:** add labels/roles to every icon button and decorative-image `accessible={false}` where appropriate.

## Issue #25 — `errorTileId` is never cleared after a failed tap
- **Severity:** Medium · **Category:** Logic / Visual · **File:** `hooks/useGameEngine.ts:246,266`
- `setErrorTileId(tile.id)` is set on a blocked move and only reset on the *next* tap (`setErrorTileId(null)` at the start of `handleTap`). On game-over (last heart) there is no next tap, so the tile stays red; after `reviveGame()` the stale red tile persists. **Fix:** clear `errorTileId` after the bump animation (timeout) and on revive/reset.

## Issue #26 — `.env` required but undocumented (silent Firebase failure)
- **Severity:** Medium · **Category:** DX / Reliability · **File:** `utils/firebase.ts`, `.gitignore`
- Firebase reads seven `EXPO_PUBLIC_FIREBASE_*` env vars; `.env` is git-ignored and there is **no `.env.example`** and no mention in the README's setup steps. A fresh contributor gets `initializeApp` with all-`undefined` config → community/leaderboard silently fail (errors are swallowed by empty `catch`). **Fix:** add `.env.example` and document required vars; fail loudly in dev if config is missing.

## Issue #27 — Ads are Android-only but no platform guards; iOS declares tablet support
- **Severity:** Medium · **Category:** Platform · **File:** `utils/ads.ts:14–36`, `app.json` (`ios.supportsTablet: true`, only `androidAppId` configured)
- The ad unit IDs are labeled "ANDROID ONLY" and only an Android AdMob app id is configured, yet the ad code runs unconditionally and iOS is a declared target. On iOS these calls will error (caught silently) but the architecture assumes Android. **Fix:** guard ad calls with `Platform.OS === 'android'`, or add iOS ad units + `iosAppId`.

## Issue #28 — Production `console.log`/`console.error` left in ad + update paths
- **Severity:** Medium · **Category:** Code quality / Perf · **File:** `utils/ads.ts` (many), `app/_layout.tsx:52`, `app/(tabs)/index.tsx:39`
- Ad lifecycle logs run in production builds (bridge cost, log noise, minor info leak of ad flow). **Fix:** strip via a logger util gated on `__DEV__` or Babel `transform-remove-console`.

## Issue #29 — No way to change or clear the leaderboard username
- **Severity:** Medium · **Category:** Feature / UX · **File:** `app/(tabs)/leaderboard.tsx:447–450`, `utils/storage.ts`
- The modal states the username "cannot be changed later," and indeed there is no edit/clear path anywhere (and `resetProgress` doesn't clear it — Issue #7). A typo'd or unwanted name is permanent short of clearing app data. **Fix:** offer a "change username" flow (with the same availability check) or at least allow clearing.

## Issue #30 — Reanimated shared-value reset performed in render body (editor zoom)
- **Severity:** Medium · **Category:** Performance / Correctness · **File:** `app/level-editor.tsx:143–153`
- Grid-change zoom reset mutates six shared values directly during render (`if (currentGridKey !== prevGridKey.current) { zoomScale.value = 1; … }`). Writing shared values during render is discouraged and can race with the UI thread. **Fix:** do it in a `useEffect` keyed on `gridCols,gridRows`.

## Issue #31 — Empty/optimistic states missing feedback on slow networks
- **Severity:** Medium · **Category:** UX / Loading · **File:** `daily.tsx`, `leaderboard.tsx`
- On focus, a spinner shows until fetch resolves, but a *failed* fetch (caught and ignored) with `isOffline === false` (e.g. Firebase reachable-but-erroring, or empty rules) lands on the **empty state** ("No community levels yet") with no error/retry distinction. Users can't tell "empty" from "failed." **Fix:** track an error state separate from empty, with a retry affordance.

---

# Low Priority Issues

## Issue #32 — Dead code: `HapticTab`
- **Severity:** Low · **File:** `components/haptic-tab.tsx` — defined but never referenced (`(tabs)/_layout.tsx` doesn't set `tabBarButton`). The tab bar has no haptic feedback as a result. **Fix:** wire it up (`tabBarButton: (p) => <HapticTab {...p} />`) or delete.

## Issue #33 — Dead code: `subscribeLeaderboard`
- **Severity:** Low · **File:** `utils/leaderboard.ts:77–102` — a real-time subscription helper that is never imported. The leaderboard is *not* real-time despite the comment; it refetches on focus/pull. **Fix:** remove, or adopt it for live updates.

## Issue #34 — Dead code: `clearPreviewLevel`
- **Severity:** Low · **File:** `utils/previewLevel.ts:18` — never called. The module-global `previewLevel` is never cleared, so the last previewed/played community level lingers in memory. **Fix:** clear on unmount of the game screen when `levelId === 0`.

## Issue #35 — Dead code: Expo template leftovers
- **Severity:** Low · **File:** `hooks/use-theme-color.ts`, `constants/theme.ts` (`Colors`, `Fonts`), `constants/themes.ts` (`THEMES`), the `@layer utilities` block in `global.css` — none are imported anywhere. **Fix:** delete to reduce confusion (there are now three parallel "theme" definitions: Tailwind config, `theme.ts`, `themes.ts`).

## Issue #36 — Icon color set via `className` on `Ionicons` (unreliable)
- **Severity:** Low · **Category:** UI consistency · **File:** `components/LevelHeader.tsx:36,47`... , `app/(tabs)/me.tsx:196,216,236`
- Some icons use `color="#..."` while others rely on NativeWind `className="text-gray-…"` on `Ionicons`. Color-via-className on vector icons is inconsistent across NativeWind versions and may not apply, leaving default-black icons in dark mode. **Fix:** standardize on the `color` prop driven by `useColorScheme`.

## Issue #37 — Route/label naming: "daily" tab is actually "Community"
- **Severity:** Low · **Category:** Naming / Product · **File:** `app/(tabs)/daily.tsx`, `_layout.tsx:36–42`
- The file/route is `daily` but the tab title and content are "Community." The README and `future_improvements.md` advertise **Daily Challenges**, which are **not implemented**. Confusing for maintainers and slightly misleading in marketing copy. **Fix:** rename route to `community`, and either build Daily Challenges or drop the claim.

## Issue #38 — `checkNewAchievements` handles a stat no achievement uses
- **Severity:** Low · **File:** `utils/achievements.ts:130–145` — special-cases `requiredStat === "completedCommunityLevelIds"`, but every community achievement uses `communityLevelsBeaten`. Dead branch; also `keyof UserStats` allows a `string[]` stat to be compared as a number elsewhere. **Fix:** tighten the `requiredStat` type to numeric stats only.

## Issue #39 — Magic numbers / hardcoded values throughout
- **Severity:** Low · **Category:** Maintainability · e.g. `BannerAdWidget` reserved heights, ad frequencies (`5`, `2`), animation durations, `NUM_PARTICLES = 60`, board padding/`0.6` height factor, grid clamps (`4..25`, `4..50`) duplicated between UI copy and logic. **Fix:** centralize in a constants module; ensure UI copy ("W max 25, H max 50") stays in sync with `applyGridSize` clamps.

## Issue #40 — `any` types weaken safety in data layer
- **Severity:** Low · **File:** `utils/storage.ts:236` (`LevelDraft.arrows: any[]`), `app/game/[level].tsx:94` (`statUpdates: any`), `assets/levels/index.ts` (`as any[]`), several `as any` route pushes. **Fix:** type `arrows` as `PlacedArrow[]`, `statUpdates` as `Partial<UserStats>`, and type the level chunks.

## Issue #41 — Centered absolute timer can overlap header on small screens
- **Severity:** Low · **Category:** Layout · **File:** `components/LevelHeader.tsx:58–66` — the timer is `absolute left-0 right-0` centered over a row that also holds the back button + level id (left) and hearts (right). With a long `levelLabel` or narrow screens the timer can visually collide with the hearts. **Fix:** use a 3-column flor grid layout instead of an absolute overlay.

## Issue #42 — Confetti particles only fall vertically
- **Severity:** Low · **Category:** Polish · **File:** `components/ConfettiOverlay.tsx:37–63` — `x` is randomized once but never animated, so particles drop straight down with no horizontal drift/spin, looking less "confetti-like." **Fix:** animate slight x-drift and rotation.

## Issue #43 — `getStaticLevel` is a 30-branch `if` ladder
- **Severity:** Low · **Category:** Maintainability · **File:** `assets/levels/index.ts:32–64` — auto-generated but brittle; a computed `chunk = Math.floor((id-1)/50)` lookup into an array/map would be cleaner and pairs naturally with lazy loading (Issue #3).

## Issue #44 — `useSfx` preloads sounds that may lag the first playback
- **Severity:** Low · **File:** `hooks/useSfx.ts:41–98` — preferences load async; a tap before init completes silently drops the SFX (`if (!sound) return`). The first arrow-out of a session can be silent. **Fix:** await/guard, or preload synchronously with default selection.

## Issue #45 — `handleNextLevel` can push past the static/generated boundary without messaging
- **Severity:** Low · **File:** `app/game/[level].tsx:201` — "Next Level" always goes to `levelId + 1`. Beyond 1500 it silently switches to on-the-fly generation (Issue #20); there's no "campaign complete" acknowledgment or end screen. **Fix:** add an endgame/"infinite mode" indicator.

## Issue #46 — Web keyboard/`use-color-scheme.web` hydration returns 'light' first paint
- **Severity:** Low · **Category:** Web · **File:** `hooks/use-color-scheme.web.ts` — returns `'light'` until hydrated, causing a flash for dark-mode web users. Acceptable for a mobile-first app but worth noting given `web.output: "static"`. **Fix:** inline a pre-hydration theme script if web is a real target.

## Issue #47 — No error boundary; a render throw crashes to a blank/native error
- **Severity:** Low (raises to High in combination with #4) · **Category:** Error handling · No React error boundary exists anywhere. Any render-time throw (bad level data, undefined access) unmounts the tree. **Fix:** add a top-level `ErrorBoundary` with a friendly fallback + reload.

## Issue #48 — Silent `catch {}` blocks hide real failures
- **Severity:** Low · **Category:** Error handling · Pervasive `catch {}` / `catch { // skip }` in `storage.ts`, `ads.ts`, fetch handlers. Great for resilience, but genuine bugs (quota errors, malformed JSON, rules failures) are invisible even in dev. **Fix:** in `__DEV__`, at least `console.warn` the swallowed error.

## Issue #49 — `submitScore` fire-and-forget on completion may lose updates offline
- **Severity:** Low · **File:** `app/game/[level].tsx:142–149` — leaderboard submit is `.catch(() => {})` with no retry/queue; progress made offline never syncs later. **Fix:** queue pending score and flush on reconnect (NetInfo listener already exists elsewhere).

## Issue #50 — Star rating is coarse and time is unused in scoring
- **Severity:** Low · **Category:** Product · **File:** `app/game/[level].tsx:47–51` — stars derive only from hearts (`3→3★, 2→2★, else 1★`); completion time is recorded but never rewards the player. Two-hearts-lost always yields 2★ regardless of speed. **Fix:** factor time (or par time) into stars for more meaningful mastery.

## Issue #51 — Large launcher icon asset (325 KB) used everywhere
- **Severity:** Low · **Category:** Performance / Assets · **File:** `assets/icons/android-chrome-512x512.png` (325 KB) is reused as the app icon, adaptive foreground, and splash image. Fine, but the splash/adaptive uses could be a trimmed/optimized asset. `expo-image` is a dependency but the app renders no bitmap images in-UI (all vector), so image perf is otherwise a non-issue. **Fix:** optimize/resize per use.

---

# UI Improvements

- **Editor board dark-mode theming** (Issue #17) — the single most visible inconsistency.
- **Move the tag picker above Share** (Issue #16) so levels actually get tagged.
- **Home screen scroll + non-absolute ad** (Issue #13) to prevent clipping.
- **Standardize icon coloring** on the `color` prop, not `className` (Issue #36), to guarantee correct dark-mode icons in `LevelHeader`/`me`.
- **Sticky "My Score" footer** (`leaderboard.tsx:377`) overlaps the `FlatList`; the list `paddingBottom:24` doesn't reserve the footer's height, so the last row can hide behind it. Reserve bottom padding equal to footer height.
- **Community card wrapping**: `Play` + tags + score + two vote buttons share one row (`daily.tsx:509–607`); on narrow screens with 3 tags this will wrap awkwardly. Consider a two-row layout.
- **Consistent screen headers**: some screens use a bordered header bar (`achievements`, `shop`), others a bare `pt-16` title (`daily`, `leaderboard`, `completed-levels`, `me`). Unify into one `<ScreenHeader>` component.
- **Loading skeletons** instead of centered spinners for the community/leaderboard lists would reduce perceived latency.
- **Board pinch/pan** has no visible reset control; users who zoom in on a large board can't easily recenter — add a "reset view" button.

# UX Improvements

- **Fix community progression (Issues #1/#2)** — currently the biggest UX lie: the game celebrates community clears that count for nothing.
- **Honest reset copy or full reset (Issue #7).**
- **Change-username flow (Issue #29).**
- **Reduce ad density (Issue #10)** — cap App Open ads; consider not showing interstitials on the very first few levels to protect early retention.
- **Optimistic voting (Issue #11)** so taps feel instant.
- **Onboarding**: no tutorial for the core mechanic (arrows must have a clear exit ray). The rules are only implicit. Add a 1-screen interactive tutorial on first launch.
- **Editor discoverability**: the "auto-fill path via BFS" behavior is powerful but only explained in a small info box at the bottom. Surface a first-run hint.
- **Distinguish empty vs error states** (Issue #31) with retry.
- **"Next Level" past the campaign** should acknowledge campaign completion (Issue #45).
- **Confirmations**: equipping/purchasing has a confirm (good); but destructive **Clear All** in the editor has none — add a confirm since it wipes the whole draft.

# Performance Improvements

- **Lazy-load level chunks (Issue #3)** — highest-impact perf fix (~34 MB heap).
- **Paginate community fetch (Issue #12)** and **stop full re-fetch per vote (Issue #11).**
- **Move animation triggers out of render** (Issues #14, #30) to stop redundant animations.
- **Throttle/defer dynamic generation (Issue #20).**
- **`GameBoard`** already memoizes well; ensure `board` prop identity only changes on real board changes (it does via refs) — keep it that way.
- **`ConfettiOverlay`** spawns 60 independent animated views; acceptable since it's transient, but consider a single Skia/canvas or capping particles on low-end devices.
- **Strip production console logs (Issue #28).**
- **`useFocusEffect` refetches** on every focus for daily/leaderboard/shop/me — add a short TTL cache to avoid redundant AsyncStorage/Firebase round-trips when quickly switching tabs.

# Code Quality Improvements

- **Extract shared components/hooks**: `<UsernameModal>` + `useUsername()` (Issue #19), `<ScreenHeader>`, a `logger` util, a `constants/config.ts` for magic numbers (Issue #39).
- **Delete dead code** (Issues #32–35): `HapticTab` (or wire it), `subscribeLeaderboard`, `clearPreviewLevel`, `use-theme-color.ts`, `constants/theme.ts`, `constants/themes.ts`.
- **Single source of theme truth** — collapse the three theme definitions into the Tailwind config + one typed palette.
- **Tighten types** (Issue #40): remove `any` in storage/stats/routing.
- **Atomic persistence** for currency+inventory (Issue #22); consider a tiny wrapper that batches related keys.
- **Data-layer validation module** for anything read from Firebase (Issue #4).
- **Error boundary** at the root (Issue #47).
- **Consistent quotes/formatting**: `game/[level].tsx` uses single quotes while the rest uses double; run Prettier uniformly.

# Accessibility Improvements

- **Add `accessibilityLabel`/`accessibilityRole` to all icon-only controls** (Issue #24).
- **Enlarge sub-44 pt touch targets** (vote, volume, close) (Issue #23).
- **Dynamic font scaling**: heavy use of fixed `text-xs`/`text-[10px]` and tight rows will overflow at large system font sizes; test at 200% and allow wrapping/`adjustsFontSizeToFit`.
- **Contrast**: `text-gray-400` on light gray backgrounds (hints, tags, "Version") is below WCAG AA; darken muted text.
- **Focus/keyboard**: on web, ensure modals trap focus and inputs have proper `autoComplete`/`textContentType`.
- **Screen-reader flow** for the SVG game board: expose a summary (e.g. "Board, N arrows remaining") since the canvas itself is opaque to TalkBack/VoiceOver.
- **Reduce-motion**: honor `AccessibilityInfo.isReduceMotionEnabled` for confetti/springs.

# Security Findings

- **Firebase security rules / server validation (Issue #5)** — Critical. Without rules, scores/votes/levels are spoofable and overwritable by anyone; add rules + transactions, consider Anonymous Auth.
- **Unvalidated user-generated level content (Issue #4)** — can crash clients and is a vector for abuse; validate on read and before play.
- **No content moderation** for community levels/usernames — no profanity/abuse filtering or reporting mechanism. Add a report/flag button and a moderation queue.
- **Client-trusted currency/progress** — Arrows balance, unlocked items, and unlocked level live in plain AsyncStorage and are trivially editable on rooted devices. Acceptable for a single-player economy, but do **not** extend this trust to anything server-authoritative (e.g. don't let the client set leaderboard level to an arbitrary value — it currently can).
- **`EXPO_PUBLIC_*` Firebase keys** are embedded in the bundle by design (not a leak) — the mitigation is rules, not secrecy.
- **AdMob publisher IDs** are public (expected). `app-ads.txt` is correctly published on the website.
- **Positive:** No hardcoded secrets, keystores, or tokens found in-repo; `.gitignore` correctly excludes `.env`, `*.jks`, `*.p8/p12`, `*.pem`.

---

# Recommended Future Features

### Must Have
- **Fix + finish Community progression** (real per-level tracking, community achievements) — Issues #1/#2.
- **Firebase security rules + level validation** — Issues #4/#5.
- **Lazy level loading** — Issue #3.
- **Change/clear username** and **honest/complete reset** — Issues #29/#7.
- **Keyboard-safe + SafeArea layouts** — Issues #8/#9.

### Should Have
- **Daily Challenges** (advertised but missing) — one curated level/day with a best-time race.
- **Level search & better filtering/pagination** on Community (creator search, difficulty, size, solved/unsolved) — pairs with Issue #12.
- **Onboarding tutorial** for the core exit-ray mechanic.
- **Ad frequency management + optional "remove ads" IAP** — improves retention and monetization quality (Issue #10).
- **Cloud save / account sync** so progress survives reinstalls (currently 100% local).
- **Report/flag community levels** (moderation).
- **Time-based star scoring / par times** — Issue #50.

### Nice to Have
- **Hints / undo-a-move in gameplay** (spend Arrows) — new currency sink.
- **Themed board dark-mode in editor + live preview thumbnails** on community cards.
- **Streaks, daily rewards, friend leaderboards.**
- **Haptic feedback on tab bar** (wire up `HapticTab`).
- **Reduce-motion + high-contrast accessibility modes.**
- **iOS ad units / full iOS parity** if iOS ships.
- **Localization** (all strings are hardcoded English).

---

# Overall Rating

| Dimension | Score | Notes |
|---|---:|---|
| **Code Quality** | 6.5/10 | Clean engine, but dead code, duplication, `any`s, three theme systems, no error boundary. |
| **Architecture** | 6/10 | Solid gameplay/state design; undermined by 34 MB eager import, `levelId 0` overloading, and client-trusted Firebase. |
| **UI** | 7/10 | Attractive, consistent Tailwind design language; let down by editor dark-mode, non-scroll Home, overlap edge cases. |
| **UX** | 5.5/10 | Good animations/offline UX, but a broken core loop (community), heavy ads, no onboarding, permanent username. |
| **Performance** | 5/10 | Excellent micro-optimizations in the engine, negated by macro problems (level heap, full-collection fetches, render-body animations). |
| **Accessibility** | 3/10 | Essentially no a11y support: no labels, small targets, fixed fonts, opaque game canvas. |
| **Security** | 4/10 | No hardcoded secrets, but no DB rules, unvalidated UGC, client-trusted writes. |
| **Maintainability** | 6/10 | Readable and commented, but scattered constants, dead files, and duplicated modals raise long-term cost. |

### Final Score: **6.5 / 10**

A capable, polished-looking game with a genuinely clever core engine, held back by a handful of high-impact defects — most importantly a **completely non-functional Community progression system** and a **34 MB startup memory footprint** — plus systemic gaps in **security (Firebase rules), accessibility, and keyboard/SafeArea handling**. Addressing the 5 Critical and 9 High issues would move this from "impressive hobby build" to "store-ready," likely lifting the score to the 8+ range.

---

## Categories Reviewed With No Additional Findings
Every category in the brief surfaced at least one issue, so none is reported as fully clean. The **closest to clean** areas — worth acknowledging as genuine strengths — are:
- **Offline detection & retry** (NetInfo listeners, retry buttons, banner-ad backoff) — well implemented.
- **Core gameplay correctness** (`movement.ts` exit-ray logic, backward-generation solvability guarantee) — no logic defects found in the algorithm itself.
- **Secret management in-repo** (no committed keys/keystores; `.gitignore` is correct).
