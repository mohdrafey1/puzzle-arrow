// Mobile ad SDKs are native-only. Web play never pretends to grant ad rewards.
export async function initializeAds(): Promise<void> {}
export async function preloadInterstitial(): Promise<void> {}
export async function preloadRewarded(): Promise<void> {}
export async function preloadAppOpen(): Promise<void> {}
export async function shouldShowInterstitialOnCompletion(): Promise<boolean> {
  return false;
}
export async function shouldShowInterstitialOnGameOver(): Promise<boolean> {
  return false;
}
export async function showInterstitial(): Promise<void> {}
export async function showRewarded(): Promise<boolean> {
  return false;
}
export function isRewardedReady(): boolean {
  return false;
}
export function showAppOpen(): void {}
