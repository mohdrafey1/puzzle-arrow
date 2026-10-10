# Puzzle Arrow

**Puzzle Arrow** is an open-source arrow escape puzzle. Tap an arrow when the path ahead of its head is clear, remove its blockers when it is not, and untangle the whole board. Play an offline campaign, try the daily challenge, or create and share your own puzzles.

We are proudly **Open Source** and **accepting contributions**! Whether it's adding a new feature, fixing a bug, or tweaking the UI, we welcome all pull requests.

---

## 🚀 Features

- **Balanced campaign:** 1,500 bundled, solver-validated levels with tutorials, growing blocking chains, easier breaks, and checkpoint challenges. Further levels generate locally.
- **Daily challenge:** An offline, shared daily pick from campaign checkpoints with streaks and personal bests. The selection changes at 00:00 UTC and rotates through 147 boards.
- **Clearer solving:** Free exit guides, zoom buttons, Fit, readable arrow colors, blocker feedback, and one optional hint per attempt. No time limit.
- **Level Editor:** Create, test, and publish your own custom puzzles!
- **Progression & Achievements:** Track your stats, unlock milestones, and earn the in-game currency, **Arrows**.
- **Shop & Customizations:** Use your Arrows to unlock stylish arrow colors, vibrant board themes, and new confetti effects.
- **Leaderboards & Community:** Share levels, rate others’ creations, and compete on the global leaderboard.
- **Offline Mode:** Campaign gameplay, level editing, and store purchases work completely offline!

---

## 🛠️ Built With

- **[Expo](https://expo.dev/)** & **[React Native](https://reactnative.dev/)**
- **[NativeWind](https://www.nativewind.dev/)** (Tailwind CSS for React Native)
- **[React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)** & **[Gesture Handler](https://docs.swmansion.com/react-native-gesture-handler/)** (for smooth 60fps animations and gestures)
- **Firebase** (for Community Levels & Leaderboards)
- **AsyncStorage** (for robust local saving of drafts, settings, and progress)

---

## 💻 How to Run Locally

Follow these steps to get a copy of the project up and running on your local machine for development and testing.

### Prerequisites

You need to have the following installed to run the app:

- [Node.js](https://nodejs.org/) 22 LTS (used for the generation and test scripts)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- An Android development build for native testing; the mobile ads SDK requires a development build and does not run in Expo Go. The web preview works without native ad SDKs.

### Installation Steps

1. **Clone the repository:**

    ```bash
    git clone https://github.com/mohdrafey1/puzzle-arrow.git
    cd puzzle-arrow
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Start the development server:**

    ```bash
    npx expo start --clear
    ```

4. **Run the App:**
    - Press **`a`** to open on an Android Emulator.
    - Use `npm run android` to build locally or open an existing development build on your phone.
    - Use `npm run web` for a browser preview. Campaign, editor, and daily play work without Firebase configuration.
    - Community and leaderboard services need the `EXPO_PUBLIC_FIREBASE_*` settings used in `utils/firebase.ts`. Configure a real iOS AdMob app ID before building an iOS release; the repository currently configures Android ads.

---

## Campaign development and verification

```sh
npm run typecheck
npm run lint
npm test                 # generation, timer, progress, daily and color checks
npm run levels:audit      # validate all 1,500 bundled boards with actual movement rules
npm run levels:generate   # rebuild the full campaign deterministically
npm run levels:generate -- --from 1 --to 40
npx playwright install chromium
npm run test:ui           # starts/reuses a local Expo web server
```

Difficulty settings live in `constants/levelDifficulty.ts`. Levels are chosen by
blocking relationships, multiple blockers, and opening exits; board fullness is
secondary. Every level is solvable, but these structural metrics still require
human playtesting to calibrate perceived difficulty. Generation is offline and
idempotent; its failure path never publishes an unvalidated random board.

Campaign version 2 keeps original best records separately and preserves unlocked
progress. Replaying an original record opens the new edition. Best time, best
stars, and fewest mistakes are independent personal bests. A hint caps an attempt
at two stars; a revived attempt earns one. Guides and zoom do not affect stars.
Retries are free, while an optional rewarded ad can revive a failed attempt.

See [research and roadmap](future_improvements.md) for primary sources and design
tradeoffs, and [campaign audit](docs/campaign-audit.json) for the measured before/after
comparison. Browser tests cover the shared gameplay logic and interface; native
multi-touch, audio, haptics, and actual ads still need device QA before release.

---

## 🤝 Contributing

We love contributions from the community! If you're looking to help out, here is how you can get started:

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally: `git clone https://github.com/YOUR_USERNAME/puzzle-arrow.git`
3. **Create a new branch** for your feature or bug fix: `git checkout -b feature/my-awesome-feature`
4. **Make your changes** and commit them: `git commit -m "Add some awesome feature"`
5. **Push to the branch**: `git push origin feature/my-awesome-feature`
6. **Open a Pull Request** against the main repository!

---

<div align="center">
  <h1>✨ Made by <strong>Mohd Rafey</strong> ✨</h1>
</div>
