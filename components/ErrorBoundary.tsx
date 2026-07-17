import React from "react";
import { Pressable, Text, View } from "react-native";
import { logger } from "../utils/logger";

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
}

/**
 * Top-level error boundary. Catches render-time throws (e.g. malformed level
 * data) and shows a recoverable fallback instead of unmounting to a blank/native
 * crash screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        logger.error("[ErrorBoundary]", error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View className="flex-1 items-center justify-center bg-gray-100 dark:bg-gray-900 p-8">
                    <Text className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2 text-center">
                        Something went wrong
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
                        An unexpected error occurred. You can try again.
                    </Text>
                    <Pressable
                        onPress={this.handleReset}
                        accessibilityRole="button"
                        accessibilityLabel="Try again"
                        className="bg-indigo-500 active:bg-indigo-600 px-8 py-4 rounded-2xl"
                    >
                        <Text className="text-white text-lg font-bold">
                            Try Again
                        </Text>
                    </Pressable>
                </View>
            );
        }

        return this.props.children;
    }
}
