/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,jsx,ts,tsx}",
        "./components/**/*.{js,jsx,ts,tsx}",
    ],
    presets: [require("nativewind/preset")],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                puzzle: {
                    bg: {
                        light: "#F3F4F6", // gray-100
                        dark: "#111827", // gray-900
                    },
                    board: {
                        light: "#E5E7EB", // gray-200
                        dark: "#1F2937", // gray-800
                    },
                    tile: {
                        light: "#FFFFFF",
                        dark: "#374151", // gray-700
                    },
                    arrow: {
                        light: "#3B82F6", // blue-500
                        dark: "#60A5FA", // blue-400
                    },
                    text: {
                        light: "#1F2937",
                        dark: "#F9FAFB",
                    },
                    textMuted: {
                        light: "#6B7280",
                        dark: "#9CA3AF",
                    },
                    heart: {
                        active: "#EF4444", // red-500
                        inactive: "#D1D5DB", // gray-300
                        inactiveDark: "#4B5563", // gray-600
                    },
                },
            },
        },
    },
    plugins: [],
};
