import { describe, expect, test } from "bun:test";
import { defaultConfig } from "../src/config.ts";
import { generateWallpaper } from "../src/generate.ts";
import { HttpError } from "../src/http.ts";

describe("generation fallback", () => {
  test("sends the original prompt to DEAPI when the prompt-provider key is missing", async () => {
    const notices: string[] = [];
    let submittedPrompt = "";
    const result = await generateWallpaper("quiet coast", defaultConfig(), {
      onNotice: (message) => notices.push(message)
    }, {
      getApiKey: async (provider) => provider === "deapi" ? "deapi-key" : null,
      submitImage: async ({ prompt }) => { submittedPrompt = prompt; return "request-1"; },
      waitForImage: async () => "https://example.com/wallpaper.png",
      downloadImage: async () => "/tmp/wallpaper.png"
    });
    expect(submittedPrompt).toBe("quiet coast");
    expect(result.enhanced).toBe(false);
    expect(notices[0]).toContain("directly to DEAPI");
  });

  test("falls back to DEAPI when the prompt provider rejects its key", async () => {
    let submittedPrompt = "";
    const result = await generateWallpaper("quiet coast", defaultConfig(), {}, {
      getApiKey: async () => "configured-key",
      discoverSkills: async () => ({ skills: [], warnings: [] }),
      enhancePrompt: async () => { throw new HttpError(401, "https://api.openai.com/v1/responses", "Unauthorized"); },
      submitImage: async ({ prompt }) => { submittedPrompt = prompt; return "request-1"; },
      waitForImage: async () => "https://example.com/wallpaper.png",
      downloadImage: async () => "/tmp/wallpaper.png"
    });
    expect(submittedPrompt).toBe("quiet coast");
    expect(result.enhanced).toBe(false);
  });
});
