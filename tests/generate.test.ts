import { describe, expect, test } from "bun:test";
import { defaultConfig } from "../src/config.ts";
import { generateWallpaper } from "../src/generate.ts";
import { HttpError } from "../src/http.ts";

describe("generation fallback", () => {
  test("subscription images require neither DEAPI nor OpenAI keys and never contact DEAPI", async () => {
    const result = await generateWallpaper("magical forest", { ...defaultConfig(), promptModel: "codex", imageModel: "codex-image" }, {}, {
      getApiKey: async () => { throw new Error("Must not read a provider key"); },
      discoverSkills: async () => ({ skills: [], warnings: [] }),
      enhancePrompt: async (input) => { expect(input.apiKey).toBe(""); return { prompt: "A moonlit magical forest with silver mist and turquoise pools.", skills: ["wallpaper-foundation"] }; },
      generateCodexImage: async (prompt, directory, request, options) => {
        expect(prompt).toContain("moonlit"); expect(request).toBe("magical forest"); expect(options?.model).toBe("gpt-6-astra");
        return { path: `${directory}/forest.png`, requestId: "codex-test", width: 1672, height: 941 };
      },
      submitImage: async () => { throw new Error("Must not submit a paid DEAPI request"); }
    });
    expect(result.requestId).toBe("codex-test"); expect(result.enhanced).toBe(true);
  });

  test("subscription image failures stop without a paid fallback", async () => {
    let deapi = false;
    await expect(generateWallpaper("forest", { ...defaultConfig(), enhancement: false, imageModel: "codex-image" }, {}, {
      getApiKey: async () => { throw new Error("Must not read keys"); },
      generateCodexImage: async () => { throw new Error("Image limit reached"); },
      submitImage: async () => { deapi = true; return "id"; }
    })).rejects.toThrow("Image limit reached");
    expect(deapi).toBe(false);
  });
  test("Codex generation reads only the DEAPI key", async () => {
    const keys: string[] = [];
    const result = await generateWallpaper("embroidered coast", { ...defaultConfig(), promptModel: "codex" }, {}, {
      getApiKey: async (provider) => { keys.push(provider); return "image-key"; },
      discoverSkills: async () => ({ skills: [], warnings: [] }),
      enhancePrompt: async (input) => {
        expect(input.model).toBe("codex");
        expect(input.apiKey).toBe("");
        return { prompt: "A detailed embroidered coastline.", skills: ["wallpaper-foundation"] };
      },
      submitImage: async ({ prompt }) => { expect(prompt).toBe("A detailed embroidered coastline."); return "id"; },
      waitForImage: async () => "https://example.test/image.png",
      downloadImage: async () => "wallpaper.png"
    });
    expect(keys).toEqual(["deapi"]);
    expect(result.enhanced).toBe(true);
  });

  test("Codex failures stop before submitting a paid image request", async () => {
    let submitted = false;
    await expect(generateWallpaper("coast", { ...defaultConfig(), promptModel: "codex" }, {}, {
      getApiKey: async () => "image-key",
      discoverSkills: async () => ({ skills: [], warnings: [] }),
      enhancePrompt: async () => { throw new Error("Codex failed"); },
      submitImage: async () => { submitted = true; return "id"; }
    })).rejects.toThrow("Codex failed");
    expect(submitted).toBe(false);
  });

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
