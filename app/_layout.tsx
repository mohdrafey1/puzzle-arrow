import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { setAudioModeAsync } from "expo-audio";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "nativewind";
import * as NavigationBar from "expo-navigation-bar";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { Alert, AppState, AppStateStatus, Platform } from "react-native";
import Toast from "react-native-toast-message";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { preloadAppOpen, showAppOpen } from "../utils/ads";
import { logger } from "../utils/logger";
import { getThemePreference } from "../utils/storage";

if (Platform.OS === "android") {
    NavigationBar.setPositionAsync("absolute");
    NavigationBar.setVisibilityAsync("hidden");
    NavigationBar.setBehaviorAsync("overlay-swipe");
}

export const unstable_settings = {
    anchor: "(tabs)",
};

export default function RootLayout() {
    const { colorScheme, setColorScheme } = useColorScheme();

    // Restore the user's saved theme preference on startup so a manual
    // light/dark choice persists across launches.
    useEffect(() => {
        getThemePreference().then((pref) => {
            setColorScheme(pref); // "light" | "dark" | "system"
        });
    }, [setColorScheme]);

    async function checkForUpdates() {
        try {
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                await Updates.fetchUpdateAsync();
                Alert.alert(
                    "Update Required",
                    "A new version of the app has been downloaded. The app must restart to apply the update.",
                    [
                        {
                            text: "Restart Now",
                            onPress: () => Updates.reloadAsync(),
                        },
                    ],
                    { cancelable: false },
                );
            }
        } catch (error) {
            logger.log(`Error fetching latest Expo update: ${error}`);
        }
    }

    useEffect(() => {
        // Only run OTA checks in production/preview builds to avoid dev interference
        if (!__DEV__) {
            checkForUpdates();
        }
    }, []);

    useEffect(() => {
        // Configure audio mode once at app startup.
        // Calling setAudioModeAsync (which triggers requestAudioFocus) per-component
        // causes a slow binder call on the Android main thread → ANR.
        // shouldDuckAndroid:true makes the OS focus request much lighter.
        setAudioModeAsync({
            playsInSilentMode: true,
            // 'duckOthers' = request audio focus with ducking, not full exclusive focus.
            // This makes the Android requestAudioFocus binder call lighter → prevents ANR.
            interruptionMode: 'duckOthers',
            allowsRecording: false,
            shouldPlayInBackground: false,
            shouldRouteThroughEarpiece: false,
        }).catch(() => {
            // Non-fatal: audio will still work, just may not duck other media
        });
    }, []);

    useEffect(() => {
        preloadAppOpen();

        const subscription = AppState.addEventListener(
            "change",
            (nextAppState: AppStateStatus) => {
                if (nextAppState === "active") {
                    showAppOpen();
                    preloadAppOpen();
                }
            },
        );

        return () => {
            subscription.remove();
        };
    }, []);

    return (
        <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <ErrorBoundary>
                <ThemeProvider
                    value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
                >
                    <Stack>
                        <Stack.Screen
                            name="(tabs)"
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="game/[level]"
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="completed-levels"
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="level-editor"
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="achievements"
                            options={{ headerShown: false }}
                        />
                    </Stack>
                    <StatusBar style="auto" />
                </ThemeProvider>
                </ErrorBoundary>
                {/* Single Toast root for the whole app. */}
                <Toast />
            </GestureHandlerRootView>
        </SafeAreaProvider>
    );
}
