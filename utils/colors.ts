type RGB = [number, number, number];

function parseHex(value: string | undefined): RGB | null {
  if (typeof value !== "string") return null;
  const hex = value.trim();
  if (/^#[\da-f]{3}$/i.test(hex)) {
    return hex
      .slice(1)
      .split("")
      .map((digit) => Number.parseInt(digit + digit, 16)) as RGB;
  }
  if (!/^#[\da-f]{6}$/i.test(hex)) return null;
  return [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  ) as RGB;
}

function luminance(rgb: RGB): number {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: RGB, b: RGB): number {
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function toHex(rgb: RGB): string {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * Keep the chosen hue and minimally shade/tint it until the actual rounded RGB
 * color reaches 3:1 against its board. Invalid backgrounds fall back to white;
 * invalid/missing preferences use contrasting default ink.
 *
 * This applies W3C's meaningful-graphic contrast target to our opaque SVG arrows,
 * not a claim that the entire native application meets WCAG:
 * https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
 */
export function getReadableArrowColor(
  preferredHex: string | undefined,
  backgroundHex: string,
): string {
  const background = parseHex(backgroundHex) ?? [255, 255, 255];
  const dark: RGB = [23, 32, 51];
  const light: RGB = [249, 250, 251];
  const preferred =
    parseHex(preferredHex) ??
    (contrast(dark, background) >= contrast(light, background) ? dark : light);
  if (contrast(preferred, background) >= 3) return toHex(preferred);

  // Equal channel interpolation toward black/white preserves hue apart from
  // 8-bit rounding. Test rendered integer channels, never a rounded ratio.
  for (let step = 1; step <= 255; step += 1) {
    const amount = step / 255;
    for (const target of [0, 255]) {
      const candidate = preferred.map((channel) =>
        Math.round(channel + (target - channel) * amount),
      ) as RGB;
      if (contrast(candidate, background) >= 3) return toHex(candidate);
    }
  }
  // Black or white always exceeds 3:1 for an opaque RGB background.
  return contrast([0, 0, 0], background) >=
    contrast([255, 255, 255], background)
    ? "#000000"
    : "#FFFFFF";
}
