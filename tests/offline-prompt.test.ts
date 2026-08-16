import { describe, expect, test } from "bun:test";
import { buildOfflineWallpaperPrompt } from "../src/offline-prompt.ts";

describe("offline wallpaper direction", () => {
  test("adds universal wallpaper composition and image-only constraints", () => {
    const prompt = buildOfflineWallpaperPrompt("a lighthouse in fog");
    expect(prompt).toContain("a lighthouse in fog");
    expect(prompt).toContain("full-bleed 16:9");
    expect(prompt).toContain("calm low-contrast side edges");
    expect(prompt).toContain("clean unlettered field");
  });

  test("infers pixel art and fire lighting from a sparse request", () => {
    const prompt = buildOfflineWallpaperPrompt("pixel game castle surrounded by fire");
    expect(prompt).toContain("detailed pixel art");
    expect(prompt).toContain("directional firelight");
  });

  test("uses guided choices when supplied", () => {
    const prompt = buildOfflineWallpaperPrompt("a mountain lake", {
      style: "photographic",
      lighting: "golden",
      composition: "off-center",
      palette: "earthy"
    });
    expect(prompt).toContain("environmental photography");
    expect(prompt).toContain("golden-hour");
    expect(prompt).toContain("placed on a third");
    expect(prompt).toContain("moss, clay");
  });
});
