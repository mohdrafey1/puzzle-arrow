import assert from "node:assert/strict";
import { getReadableArrowColor } from "../utils/colors";
import { ARROW_COLORS } from "../utils/customizations";

// Independent WCAG luminance oracle; verify its known black/white reference pair.
function brightness(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const linear = [value >> 16, (value >> 8) & 255, value & 255].map((byte) => {
    const component = byte / 255;
    return component > 0.04045
      ? Math.pow((component + 0.055) / 1.055, 2.4)
      : component / 12.92;
  });
  return linear.reduce(
    (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
    0,
  );
}
function contrast(a: string, b: string): number {
  const values = [brightness(a), brightness(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function hue(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [value >> 16, (value >> 8) & 255, value & 255];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    range = max - min;
  if (range === 0) return 0;
  return (
    ((max === r
      ? (g - b) / range
      : max === g
        ? (b - r) / range + 2
        : (r - g) / range + 4) *
      60 +
      360) %
    360
  );
}

assert.equal(contrast("#000000", "#FFFFFF"), 21);
assert.equal(contrast("#777777", "#777777"), 1);
// Actual GameBoard opaque fills: default light/dark, ocean, forest, midnight.
const backgrounds = [
  "#FFFFFF",
  "#172033",
  "#ECFEFF",
  "#12333E",
  "#ECFDF5",
  "#12382C",
  "#0F172A",
];
for (const background of backgrounds) {
  for (const { value: preferred, name } of ARROW_COLORS) {
    const result = getReadableArrowColor(preferred, background);
    assert.match(result, /^#[\dA-F]{6}$/);
    assert.ok(
      contrast(result, background) >= 3,
      `${name} on ${background} must reach 3:1 after integer rounding`,
    );
    if (contrast(preferred, background) >= 3)
      assert.equal(
        result,
        preferred,
        "Readable custom colors must remain unchanged",
      );
    const difference = Math.abs(hue(result) - hue(preferred));
    assert.ok(
      Math.min(difference, 360 - difference) < 2,
      "Shading should preserve the purchased color hue",
    );
    assert.equal(
      getReadableArrowColor(result, background),
      result,
      "Applying the adjustment twice must be stable",
    );
  }
  for (const missing of [undefined, "", "red", "#GGGGGG", "#FFFFFFFF"]) {
    assert.ok(
      contrast(getReadableArrowColor(missing, background), background) >= 3,
      "Invalid customization must retain readable ink",
    );
  }
}
assert.equal(
  getReadableArrowColor("#abc", "#fff"),
  getReadableArrowColor("#AABBCC", "#FFFFFF"),
);
assert.equal(
  getReadableArrowColor("#3b82f6", "broken"),
  getReadableArrowColor("#3B82F6", "#FFFFFF"),
);
// Dark-on-dark and light-on-light must both be recoverable, including midtones.
for (const background of ["#000000", "#777777", "#808080", "#FFFFFF"]) {
  for (const foreground of [background, "#000000", "#FFFFFF"]) {
    assert.ok(
      contrast(getReadableArrowColor(foreground, background), background) >= 3,
    );
  }
}
console.log(
  "Color checks passed: all 35 customization/theme pairs, invalid inputs, hue preservation, contrast thresholds.",
);
