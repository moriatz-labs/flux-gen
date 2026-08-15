import { describe, expect, test } from "bun:test";
import { enhancePrompt, parseSelectedSkills } from "../src/enhance.ts";
import type { WallpaperSkill } from "../src/types.ts";

const skills: WallpaperSkill[] = [
  { name: "wallpaper-foundation", description: "base", instructions: "base", source: "bundled" },
  { name: "cinematic-lighting", description: "light", instructions: "light", source: "bundled" },
  { name: "color-direction", description: "color", instructions: "color", source: "bundled" }
];

describe("skill selection", () => {
  test("accepts only available specialist names", () => {
    expect(parseSelectedSkills('{"skills":["cinematic-lighting","invented","wallpaper-foundation"]}', skills)).toEqual(["cinematic-lighting"]);
  });
  test("falls back safely on malformed JSON", () => {
    expect(parseSelectedSkills("not json", skills)).toEqual([]);
  });

  test("retries a truncated final prompt", async () => {
    const responses = [
      '{"skills":[]}',
      "A quiet lake above,",
      "A quiet alpine lake reflects a pale blue dawn beneath distant snow peaks, composed as a balanced widescreen photograph with calm edges, crisp natural detail, soft atmospheric depth, gentle silver light, and an uninterrupted visual field suitable for a serene desktop wallpaper."
    ];
    const fakeFetch = async () => Response.json({ output_text: responses.shift() });
    const result = await enhancePrompt({ request: "quiet lake", model: "gpt-5.6-luna", apiKey: "secret", skills, fetchImplementation: fakeFetch as unknown as typeof fetch });
    expect(result.prompt).toContain("alpine lake");
    expect(responses).toHaveLength(0);
  });
});
