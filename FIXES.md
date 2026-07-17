# Remediation Summary

This document maps the fixes implemented in response to `analysis.md`. Issue
numbers correspond to that report.

## 🔴 Critical — all fixed
- **#1/#2 Community progression broken.** `isPreview` is now keyed on
  `source === 'editor'` instead of `levelId === 0`, so community completions are
  no longer swallowed. The real community level id is threaded through the route
  (`?source=community&cid=<id>`) and used for per-level dedup/tracking, so
  `communityLevelsBeaten` and the community achievements now work.
  (`app/game/[level].tsx`, `app/(tabs)/daily.tsx`)
- **#3 34 MB eager level import.** `assets/levels/index.ts` now lazy-loads chunks
  via cached thunks — only chunks actually reached are parsed/resident.
- **#4 Untrusted level data.** Added `isValidCommunityLevel()` validation on
  fetch (invalid levels are skipped), bounds guards in `canMove`, and non-square
  dimensions are preserved (`rows`/`cols`). (`utils/communityLevels.ts`,
  `utils/movement.ts`, `app/(tabs)/daily.tsx`, `app/level-editor.tsx`)
- **#5 Firebase trust.** Added `database.rules.json` (type/shape validation +
  required indexes) and switched voting to a Firebase `runTransaction`.
  ⚠️ Full anti-spoofing still needs Firebase Auth — see "Remaining" below.

## 🟠 High — all fixed
- **#6** Theme preference restored on startup (`getThemePreference` → NativeWind
  `setColorScheme`); nav theme now driven by the same source. (`app/_layout.tsx`)
- **#7** `resetProgress()` now clears all progress keys via `multiRemove`.
- **#8** `KeyboardAvoidingView` wraps both username modals.
- **#9** `SafeAreaProvider` added; game, editor, and home use `useSafeAreaInsets`.
- **#10** App Open ad now has a 4h cooldown + post-ad suppression window.
- **#11** Voting is optimistic (no full re-download) with revert-on-failure.
- **#12** `fetchCommunityLevels` uses `orderByChild('score')` + `limitToLast`.
- **#13** Home screen is a `ScrollView`; ad moved into normal flow.
- **#14** Overlay card animation moved into a `useEffect` (fires once).

## 🟡 Medium — fixed
- **#15** Version string reads from `expo-constants`.
- **#16** Editor tag picker moved above the Share button.
- **#17** Editor board colors are theme-aware.
- **#18** Duplicate `<Toast />` removed (single root).
- **#21** Community levels persist real `rows`/`cols`.
- **#22** Atomic `purchaseItem()` replaces the two-step debit/unlock.
- **#23/#24** `hitSlop` + `accessibilityLabel`/`accessibilityRole` added to
  icon-only controls (back, vote, close, volume, replay).
- **#25** `errorTileId` cleared after the bump animation and on revive.
- **#26** `.env.example` added; README documents setup; dev warning if config
  missing.
- **#27** Ad calls guarded behind `Platform.OS === 'android'`.
- **#28** Production `console.*` replaced with a `__DEV__`-gated `logger`.
- **#29** "Change Username" control added to Settings (`clearLeaderboardUsername`).
- **#30** Editor zoom/pan reset moved into a `useEffect`.
- **#31** Community feed distinguishes error state from empty (with Retry).

## ⚪ Low — fixed
- **#32** `HapticTab` wired into the tab bar (`tabBarButton`).
- **#33** Dead `subscribeLeaderboard` removed.
- **#35** Unused Expo-template files removed (`use-theme-color.ts`, `theme.ts`,
  `themes.ts`) and the unused `@layer` block removed from `global.css`.
- **#38** `Achievement.requiredStat` narrowed to numeric stats; dead branch removed.
- **#40** `LevelDraft.arrows` and `statUpdates` typed; removed `any`s.
- **#41** LevelHeader timer uses flex layout (no absolute overlap).
- **#42** Confetti particles now drift horizontally and spin.
- **#43** `getStaticLevel` simplified to a computed chunk lookup.
- **#44** `useSfx` lazily creates a missing player so the first sound isn't dropped.
- **#47** Root `ErrorBoundary` added.
- **#48** Firebase config failure now warns in dev.
- Replay button now preserves community/editor context.

## Remaining (product / backend — intentionally not code-patched here)
- **#5 (full)** Firebase **Anonymous Auth** to bind usernames to a UID for true
  anti-spoofing (rules file lays the groundwork).
- **#49** Offline leaderboard-submit queue with reconnect flush.
- **#50** Time-based star scoring.
- **#37** Rename the `daily` route to `community` (route rename touches deep
  links; deferred to avoid breakage).
- Larger product features from the report's "Recommended Future Features"
  (Daily Challenges, IAP remove-ads, onboarding tutorial, cloud save,
  moderation/reporting, localization).

> Note: the project's `node_modules` is not installed in this environment, so a
> full `tsc`/lint pass couldn't be run here. Changes were verified for syntax
> (no TS1xxx errors) and internal consistency; run `npm install && npx tsc
> --noEmit && npm run lint` before shipping.
