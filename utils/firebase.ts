import { initializeApp } from "firebase/app";
import { Database, getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let database: Database | undefined;

/** Campaign and editor remain available without community service configuration. */
export function getFirebaseDatabase(): Database {
    if (!firebaseConfig.databaseURL || !firebaseConfig.projectId) {
        throw new Error(
            "Community services are not configured. You can still play the campaign offline.",
        );
    }
    if (!database) database = getDatabase(initializeApp(firebaseConfig));
    return database;
}
