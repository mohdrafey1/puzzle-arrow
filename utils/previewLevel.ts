import { LevelData } from "../constants/levels";

/**
 * In-memory store for a preview level created in the Level Editor.
 * Used by the game engine when levelId === 0.
 */
let previewLevel: LevelData | null = null;
let previewPassed = false;
let previewIdentity: string = "editor";

export function setPreviewLevel(level: LevelData, identity = "editor") {
    previewLevel = level;
    previewIdentity = identity;
    previewPassed = false; // reset on new level
}

export function getPreviewLevel(identity?: string): LevelData | null {
    return identity === undefined || identity === previewIdentity
        ? previewLevel
        : null;
}

export function clearPreviewLevel() {
    previewLevel = null;
    previewPassed = false;
    previewIdentity = "editor";
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
