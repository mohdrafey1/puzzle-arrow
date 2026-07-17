import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { logger } from "./logger";

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Fail loudly in development so a missing .env doesn't silently break the
// community/leaderboard features (see .env.example).
if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
    logger.warn(
        "[Firebase] Missing configuration. Copy .env.example to .env and fill " +
            "in EXPO_PUBLIC_FIREBASE_* values — community & leaderboard will not work.",
    );
}

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
