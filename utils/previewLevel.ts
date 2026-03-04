import { LevelData } from "../constants/levels";

/**
 * In-memory store for a preview level created in the Level Editor.
 * Used by the game engine when levelId === 0.
 */
let previewLevel: LevelData | null = null;
let previewPassed = false;

export function setPreviewLevel(level: LevelData) {
    previewLevel = level;
    previewPassed = false; // reset on new level
}

export function getPreviewLevel(): LevelData | null {
    return previewLevel;
}

export function clearPreviewLevel() {
    previewLevel = null;
    previewPassed = false;
}

export function markPreviewPassed() {
    previewPassed = true;
}

export function isPreviewPassed(): boolean {
    return previewPassed;
}

export function resetPreviewPassed() {
    previewPassed = false;
}
