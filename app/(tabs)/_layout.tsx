import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useColorScheme } from "nativewind";
import React from "react";

export default function TabLayout() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
                    borderTopColor: isDark ? "#374151" : "#E5E7EB",
                    elevation: 0,
                    shadowOpacity: 0,
                    borderTopWidth: 1,
                    height: 70,
                },
                tabBarActiveTintColor: "#3B82F6",
                tabBarInactiveTintColor: isDark ? "#9CA3AF" : "#6B7280",
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color }) => (
                        <Ionicons size={24} name="play" color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="daily"
                options={{
                    title: "Daily",
                    tabBarIcon: ({ color }) => (
                        <Ionicons size={24} name="calendar" color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="me"
                options={{
                    title: "Me",
                    tabBarIcon: ({ color }) => (
                        <Ionicons size={24} name="person" color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
