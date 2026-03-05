export type CustomizationType = "arrowColor" | "boardTheme" | "confettiStyle";

export interface CustomizationItem {
    id: string;
    type: CustomizationType;
    name: string;
    price: number;
    value: string; // The CSS color or theme identifier
}

export const ARROW_COLORS: CustomizationItem[] = [
    {
        id: "arrow_blue",
        type: "arrowColor",
        name: "Classic Blue",
        price: 0,
        value: "#3B82F6",
    },
    {
        id: "arrow_red",
        type: "arrowColor",
        name: "Ruby Red",
        price: 100,
        value: "#EF4444",
    },
    {
        id: "arrow_green",
        type: "arrowColor",
        name: "Emerald",
        price: 500,
        value: "#10B981",
    },
    {
        id: "arrow_purple",
        type: "arrowColor",
        name: "Amethyst",
        price: 1000,
        value: "#8B5CF6",
    },
    {
        id: "arrow_gold",
        type: "arrowColor",
        name: "Solid Gold",
        price: 2000,
        value: "#F59E0B",
    },
];

export const BOARD_THEMES: CustomizationItem[] = [
    {
        id: "theme_default",
        type: "boardTheme",
        name: "Default Light/Dark",
        price: 0,
        value: "default",
    },
    {
        id: "theme_ocean",
        type: "boardTheme",
        name: "Ocean Breeze",
        price: 1000,
        value: "ocean",
    },
    {
        id: "theme_forest",
        type: "boardTheme",
        name: "Deep Forest",
        price: 2000,
        value: "forest",
    },
    {
        id: "theme_midnight",
        type: "boardTheme",
        name: "Midnight Void",
        price: 5000,
        value: "midnight",
    },
];

export const CONFETTI_STYLES: CustomizationItem[] = [
    {
        id: "confetti_default",
        type: "confettiStyle",
        name: "Classic Party",
        price: 0,
        value: "default",
    },
    {
        id: "confetti_gold",
        type: "confettiStyle",
        name: "Golden Rain",
        price: 1000,
        value: "gold",
    },
    {
        id: "confetti_neon",
        type: "confettiStyle",
        name: "Cyber Neon",
        price: 2000,
        value: "neon",
    },
];

export const ALL_CUSTOMIZATIONS = [
    ...ARROW_COLORS,
    ...BOARD_THEMES,
    ...CONFETTI_STYLES,
];

// Provide easy lookup arrays for pre-unlocked defaults
export const DEFAULT_UNLOCKED_ITEMS = [
    "arrow_blue",
    "theme_default",
    "confetti_default",
];
