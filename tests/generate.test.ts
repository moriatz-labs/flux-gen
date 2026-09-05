import { describe, expect, test } from "bun:test";
import { defaultConfig } from "../src/config.ts";
import { generateWallpaper } from "../src/generate.ts";
import { HttpError } from "../src/http.ts";

describe("generation fallback", () => {
  test("builds a wallpaper-directed prompt when the prompt-provider key is missing", async () => {
    const notices: string[] = [];
    let submittedPrompt = "";
    const result = await generateWallpaper("quiet coast", { ...defaultConfig(), promptModel: "gpt-5.6-luna" }, {
      onNotice: (message) => notices.push(message)
    }, {
      getApiKey: async (provider) => provider === "deapi" ? "deapi-key" : null,
      submitImage: async ({ prompt }) => { submittedPrompt = prompt; return "request-1"; },
      waitForImage: async () => "https://example.com/wallpaper.png",
      downloadImage: async () => "/tmp/wallpaper.png"
    });
    expect(submittedPrompt).toContain("quiet coast");
    expect(submittedPrompt).toContain("full-bleed 16:9");
    expect(submittedPrompt).toContain("calm low-contrast side edges");
    expect(result.enhanced).toBe(true);
    expect(notices[0]).toContain("built-in wallpaper direction");
  });

  test("falls back to DEAPI when the prompt provider rejects its key", async () => {
    let submittedPrompt = "";
    const result = await generateWallpaper("quiet coast", { ...defaultConfig(), promptModel: "gpt-5.6-luna" }, {}, {
      getApiKey: async () => "configured-key",
      discoverSkills: async () => ({ skills: [], warnings: [] }),
      enhancePrompt: async () => { throw new HttpError(401, "https://api.openai.com/v1/responses", "Unauthorized"); },
      submitImage: async ({ prompt }) => { submittedPrompt = prompt; return "request-1"; },
      waitForImage: async () => "https://example.com/wallpaper.png",
      downloadImage: async () => "/tmp/wallpaper.png"
    });
    expect(submittedPrompt).toContain("quiet coast");
    expect(submittedPrompt).toContain("full-bleed 16:9");
    expect(result.enhanced).toBe(true);
  });
});
