# Puzzle Arrow

Welcome to **Puzzle Arrow**, an open-source, mind-bending puzzle game where players guide arrows to their correct positions to complete increasingly difficult levels! With a built-in level editor, community levels, and a ton of unlockable customizations, the possibilities are infinite.

We are proudly **Open Source** and **accepting contributions**! Whether it's adding a new feature, fixing a bug, or tweaking the UI, we welcome all pull requests.

---

## 🚀 Features

- **Infinite Levels:** Play the built-in campaign or explore endless community-created levels.
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

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- Expo Go app on your iOS or Android device (for quick testing)

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

3. **Configure environment variables:**

    Community levels and the leaderboard use Firebase. Copy the example file
    and fill in your Firebase project's config:

    ```bash
    cp .env.example .env
    # then edit .env with your EXPO_PUBLIC_FIREBASE_* values
    ```

    Deploy the included database security rules to your project:

    ```bash
    firebase deploy --only database   # uses database.rules.json
    ```

    Without a valid `.env`, the app still runs but community/leaderboard
    features will be unavailable.

4. **Start the development server:**

    ```bash
    npx expo start --clear
    ```

5. **Run the App:**
    - Press **`a`** to open on an Android Emulator.
    - Or, simply scan the QR code displayed in the terminal using the **Expo Go** app on your physical phone!

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
