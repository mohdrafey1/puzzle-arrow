# Puzzle Arrow: Research and Improvement Roadmap

Research reviewed on 7 October 2026. This document separates published evidence,
findings from the repository, and design hypotheses that still need player testing.
Competitor product descriptions verify advertised features; they do not establish
that copying a feature improves retention. Store reviews are anecdotal and are not
used here as population-level evidence.

The priority is stronger reasoning within readable boards. Larger boards, smaller
touch targets, and additional punishment can make play harder without making the
puzzle more interesting.

## Implemented in this revision

The campaign now contains 1,500 rebuilt version-2 boards with a calm tutorial,
progressively deeper dependencies, relief levels, and ten-level checkpoints. All
boards pass actual movement, geometry, and alternate removal-order checks.

| Structural measurement | Original | Rebuilt |
| --- | ---: | ---: |
| First 40 levels: initially removable arrows | 76.9% | 32.8% |
| First 40 levels: blocking depth | 2.23 | 5.25 |
| Final 500 levels: initially removable arrows | 59.4% | 28.2% |
| Final 500 levels: blocking depth | 4.05 | 12.20 |
| Final 500 levels: average board width | 25 cells | 16.61 cells |

Depth counts rounds of clearing every currently available arrow, not required
moves or measured human effort. See the [complete audit](docs/campaign-audit.json)
for baseline revision, comparison groups, and validation methodology.

The interface includes free exit guides, blocker feedback, zoom buttons, Fit,
contrast-adjusted arrows, a once-per-attempt hint, contextual instructions, and a
reworked home screen. Daily selections and streaks work offline. Campaign records
keep old and new boards separate; replay achievements, community identity,
active timers, and recoverable save failures have been corrected. Retries no
longer trigger interstitials, and returning to an active puzzle does not show an
app-open ad. Optional rewarded revives remain.

Validation includes 18 progression/storage regression tests, eight browser
scenarios, daily/calendar and color checks, TypeScript, lint, and successful
Android/web bundle exports. The browser suite covers complete solves, assisted
replays, free retries, daily isolation, zoomed clicks, drags, failed-save recovery,
small-screen help, and legacy records. Native touch, audio, haptics, and real ads
still need device QA. No human difficulty or retention improvements have yet
been measured.

## What the research supports

| Evidence | Implication for this game |
| --- | --- |
| Easybrain documents a free, unlimited grid helper that displays exit directions and highlights the blocked path after an error. [Official grid help](https://arrowpuzzleios.easybrain.com/hc/en-us/articles/10064643577754-What-is-the-grid-booster) | Offer optional lane guides and explain blocked moves. Keep readability aids available without spending currency or watching ads. |
| Easybrain hints highlight a safely removable arrow, which the player then taps. [Official hint help](https://arrowpuzzleios.easybrain.com/hc/en-us/articles/10064660631706-How-do-I-get-a-hint) | A hint should identify a move while leaving the interaction to the player. Prefer a useful move that opens another route when possible. |
| Easybrain documents pinch zoom and navigation for inspecting the board. [Official zoom help](https://arrowpuzzleios.easybrain.com/hc/en-us/articles/10064643370778-How-do-I-zoom-in) | Preserve zoom and add accessible controls for zooming and fitting the board. |
| Lessmore and Easybrain advertise increasing puzzle complexity, hints, and play without time limits. [Lessmore listing](https://play.google.com/store/apps/details?id=com.ecffri.arrows&hl=en-ZA), [Easybrain listing](https://play.google.com/store/apps/details?id=com.easybrain.arrow.puzzle.game&hl=en_GB) | Keep campaign completion untimed. Optional personal time records can coexist with relaxed play. These claims are product positioning, not experimental results. |
| Pelánek evaluated difficulty measures against more than 1,700 Sudoku puzzles and hundreds of solvers; both the complexity of individual steps and dependencies between steps matter. [Research paper](https://arxiv.org/abs/1403.7373) | Measure blocking relationships rather than choosing levels only by board fullness. Applying these findings to arrow puzzles remains an inference, not a validated arrow-difficulty formula. |
| Shen and Sturtevant model puzzle difficulty using player knowledge and inference policies, evaluating the approach on The Witness. [Research paper](https://ojs.aaai.org/index.php/AIIDE/article/view/31872) | A structural solver score needs calibration against people. What initially requires searching can become an obvious pattern after practice. |
| Apple recommends interactive, contextual teaching, brief instructions, and demonstrating competency before advanced objectives. [Game onboarding guidance](https://developer.apple.com/app-store/onboarding-for-games/) | Teach free exits, blockers, chains, and combined patterns through play. Make a short refresher available. Introduce ancillary systems after the core loop. |
| Microsoft distinguishes puzzle difficulty from motor and visual barriers. [Game difficulty guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/108) | Keep cognitive challenge separate from zoom, contrast, grid visibility, and input assistance. Helpful display settings should not cost stars. |
| Microsoft recommends alternatives to multipoint gestures, release activation, spaced touch targets, and ways to cancel or undo mistakes. [Input guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) | Provide zoom buttons and Fit; prevent a drag or pinch from becoming a penalized tap. Use release activation and forgiving feedback. |
| Google recommends placing interstitials at natural transitions and warns against excessive or surprising interruptions. [AdMob guidance](https://support.google.com/admob/answer/6066980?hl=en) | Protect the solving flow. Prefer completion transitions and voluntary rewarded help; assess frequency against real session lengths. |

## Findings from the original implementation

These findings describe the implementation reviewed before the current revamp.

- The generator selected candidates by fill ratio and strongly favored edge heads.
  It did not select for dependency depth or the proportion of immediately free
  arrows. Board size reached its cap while later levels retained the same basic
  construction. Increasing arrow length alone does not ensure interesting blockers.
- Existing campaign JSON takes precedence over dynamic generation. A generator
  change must be accompanied by regenerated, validated bundled levels.
- A legal removal only removes occupied cells. It can never block another arrow.
  Thus any legal move is safe, and the current puzzle primarily tests recognition
  of clear exit lanes rather than choosing between risky strategic branches.
- At a 360-pixel window width, a 25-by-25 board had approximately 12-pixel cells,
  a 0.96-pixel line, and a 3-pixel arrowhead length. These are calculations from
  layout code, not measured device screenshots. Readability needs explicit limits.
- Pinch/pan existed, but there was no Fit control and pan was unbounded. A player
  could move the board out of view. A gesture should never accidentally cost a life.
- Revive timing, best-result merging, and community completion identity required
  attention before increasing difficulty. Completion accounting should preserve
  independent best times and stars, count unique wins, and retain mistakes across
  revives.
- The route named `daily.tsx` was the community browser, not a daily challenge.
  Sounds, haptics, animated exits, customization, and achievements already existed;
  they should be refined rather than listed as entirely new features.

## Current revamp priorities

### 1. Rebuild and validate the campaign

Select levels by several structural measures: opening free-arrow fraction,
availability throughout a solve, dependency depth, multiple distinct blockers,
arrows that release other arrows, isolated arrows, and pattern variety. Guarantee
valid geometry and solvability using the actual movement rules. Keep campaign
records versioned when replacing board content so old best times are not presented
as results for a different puzzle.

Teach one idea at a time in the opening boards, then combine them. Interleave
chains, converging blockers, and branching releases. Allow occasional relief
boards and identifiable milestone challenges. A single very long chain can score
high for depth and still feel repetitive.

**Hypotheses:** precise metric weights, opening-exit targets, and a ten-level
challenge cadence are initial tuning choices. The cited research establishes no
universal arrow-game target. Do not describe structural scores as player-tested
difficulty or proof that later levels are more enjoyable.

### 2. Add tools that make the rules legible

Provide a free lane guide, a hint that highlights one available arrow, thicker
minimum strokes/heads, Fit and zoom controls, and clear blocked-arrow feedback.
Keep error feedback visual even with sound/haptics off. Test every available
arrow-color/board-theme combination for readability. Dark mode is already a useful
strength; Easybrain's current help reports it unavailable in its game, although
that can change. [Official dark-mode help](https://arrowpuzzleios.easybrain.com/hc/en-us/articles/10796435131546-Do-you-have-Dark-Mode)

Retain untimed completion. Consider an optional practice setting with unlimited
mistakes. Exact mistake allowances and retry behavior should be tested with novice
players and players using touch assistance.

### 3. Add a clear daily reason to return

`utils/dailyChallenge.ts` implements an offline UTC rotation through campaign
milestone levels 40, 50, ... 1500. It visits all 147 choices before repeating. These
are selected campaign boards, **not newly generated or globally unique daily
puzzles**. Everyone with the same campaign version and UTC date receives the same
selection. The device clock controls the date; this is not a competitive or
anti-cheat system.

Daily results use a separate version-2 storage key, preserve fastest time and best
stars independently, count each date once, and track current/best streaks. They do
not unlock campaign levels, grant campaign achievements, or submit leaderboard
scores. A run started before midnight saves against its captured start date.
Yesterday's streak remains active until the current UTC day expires. Display the
UTC reset clearly to players in other timezones.

Easybrain documents a daily puzzle and monthly completion trophies, establishing
this as a comparable product feature, not proof of a retention benefit.
[Daily challenge help](https://arrowpuzzleios.easybrain.com/hc/en-us/articles/10198138769818-What-is-a-daily-challenge)

Later, consider a calendar/archive and optional completion badges. Keep a future
competitive daily leaderboard separate from local clock-based results.

### 4. Improve first-session focus and store accuracy

Show the current chapter or challenge, Continue, and concise help prominently.
De-emphasize share/rating requests until the player has experienced a successful
session. Use a neutral rating action instead of requesting a specific star rating.
Avoid claiming thousands of community levels without checking actual availability.

The [published Puzzle Arrow listing](https://play.google.com/store/apps/details?id=com.mohdrafey1.puzzlearrow&hl=en)
describes guiding arrows to correct targets, whereas the objective is clearing
the board. Its release notes still describe 1,000 levels. Suggested opening copy:

> Find a clear path, tap an arrow, and untangle the board one move at a time.
> Play offline challenges, create your own puzzles, and explore community levels.

Update the campaign count and feature list to match the shipped release. Do not
call procedural boards handcrafted or describe the offline daily rotation as
freshly generated puzzles. Publishing store changes is a separate release step.

## Validation and follow-up experiments

Automated validation should verify geometry, shape masks, self-collision, full
solvability, deterministic generation, and representative difficulty progression.
The daily test exercises UTC/leap-year/year rollover, equivalent timezone instants,
the complete board rotation, streak gaps, concurrent and repeated completions,
independent best results, storage failures, corrupt records, and campaign isolation:

```sh
node -r ./scripts/register-typescript.cjs scripts/test-daily.ts
```

Run short supervised playtests on small and large phones. Include new players and
experienced puzzle players; ask them to explain why an arrow can or cannot move.
Check whether mistakes reflect reasoning, mis-taps, unclear direction, or gesture
conflicts. Test light/dark themes, zoomed boards, returning from background, and
completion across a daily reset.

For a future analytics implementation, track level version, active solving time,
completion/abandonment, mistakes, hints, retries, and viewport class. Separate ads
and background time from active play. Compare median and upper-percentile times
and first-attempt success by experience cohort. Optionally sample “Too easy / Just
right / Too hard” after completion. No new analytics backend is required for the
current offline revamp, and no retention improvements have yet been measured.

## Mechanics to prototype later

Rotating arrows or toggled gates could introduce meaningful state changes and
planning choices. Prototype them in a separate advanced mode, with undo and a
state-space solver that checks for dead ends. They need a different generation
and validation model from monotonic arrow removal. Adding keys or locks that only
remove constraints may add visual variety while retaining the same strategic
ceiling; evaluate that distinction before expanding the campaign rules.
