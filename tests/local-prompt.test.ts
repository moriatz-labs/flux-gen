import { describe, expect, test } from "bun:test";
import { completeLocalPrompt } from "../src/local-prompt.ts";
import { enhancePrompt, selectLocalSkills } from "../src/enhance.ts";
import { generateWallpaper } from "../src/generate.ts";
import { defaultConfig } from "../src/config.ts";
import type { WallpaperSkill } from "../src/types.ts";

const skills: WallpaperSkill[] = [
  { name: "wallpaper-foundation", description: "base", instructions: "base", source: "bundled" },
  { name: "wallpaper-art-direction", description: "art", instructions: "art", source: "project" },
  { name: "photography", description: "photographic coast photography", instructions: "photo", source: "personal" },
  { name: "color", description: "color palette", instructions: "color", source: "bundled" }
];
const prompt = "A quiet embroidered coastline curves beneath a broad ivory sky, with dark green stitched cliffs above turquoise water. Individual yarn strands follow the waves and rock contours, while soft side lighting reveals gentle textile shadows and a restrained handmade texture. Leave generous calm space along the horizon and keep the composition free of lettering and borders.";
const reply = (content: string, finish_reason = "stop") => Response.json({ choices: [{ message: { content }, finish_reason }] });

describe("local prompt writer", () => {
  test("uses loopback without authorization and makes no remote selection call", async () => {
    const calls: string[] = [];
    const fake = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url));
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("flux-local");
      expect(body.max_tokens).toBe(512);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.redirect).toBe("error");
      return reply(prompt);
    };
    const result = await enhancePrompt({ request: "coast", model: "flux-local", apiKey: "", skills, fetchImplementation: fake as unknown as typeof fetch });
    expect(calls).toEqual(["http://127.0.0.1:8080/v1/chat/completions"]);
    expect(result.skills).toEqual(["wallpaper-foundation", "wallpaper-art-direction", "photography"]);
  });
  test("ranks only relevant skills deterministically", () => {
    expect(selectLocalSkills("photographic coast", skills)).toEqual(["photography"]);
    expect(selectLocalSkills("spaceship", skills)).toEqual([]);
  });
  test.each(["length", "invalid-json", "heading"])("retries malformed output once: %s", async (kind) => {
    let count = 0;
    const fake = async () => ++count > 1 ? reply(prompt) : kind === "length" ? reply(prompt, "length") : kind === "heading" ? reply(`Prompt: ${prompt}`) : new Response("not json");
    expect((await enhancePrompt({ request: "coast", model: "flux-local", apiKey: "", skills, fetchImplementation: fake as unknown as typeof fetch })).prompt).toBe(prompt);
    expect(count).toBe(2);
  });
  test("fails after two invalid completions", async () => {
    let count = 0;
    await expect(enhancePrompt({ request: "coast", model: "flux-local", apiKey: "", skills, fetchImplementation: (async () => { count++; return reply("short"); }) as unknown as typeof fetch })).rejects.toThrow("20–250");
    expect(count).toBe(2);
  });
  test("accepts detailed prompts above the previous 120-word ceiling", async () => {
    const detailed = `${prompt} ${prompt} ${prompt}`;
    expect(detailed.split(/\s+/).length).toBeGreaterThan(120);
    expect((await enhancePrompt({ request: "coast", model: "flux-local", apiKey: "", skills, fetchImplementation: (async () => reply(detailed)) as unknown as typeof fetch })).prompt).toBe(detailed);
  });
  test.each(["connection refused", "TimeoutError"])("reports server failure without fallback: %s", async (message) => {
    await expect(completeLocalPrompt("system", "coast", (async () => { throw new Error(message); }) as unknown as typeof fetch)).rejects.toThrow("flux local start");
  });
  test("does not expose server error bodies", async () => {
    await expect(completeLocalPrompt("system", "coast", (async () => new Response("private data", { status: 500 })) as unknown as typeof fetch)).rejects.toThrow("HTTP 500");
  });
  test("reports a timeout while reading the response body", async () => {
    const response = new Response();
    response.json = async () => { throw new DOMException("Body interrupted", "TimeoutError"); };
    await expect(completeLocalPrompt("system", "coast", (async () => response) as unknown as typeof fetch)).rejects.toThrow("timed out");
  });
  test("wallpaper generation reads only the image-provider key in local mode", async () => {
    const keys: string[] = [];
    const result = await generateWallpaper("coast", { ...defaultConfig(), promptModel: "flux-local" }, {}, {
      getApiKey: async (provider) => { keys.push(provider); return "image-key"; },
      discoverSkills: async () => ({ skills, warnings: [] }),
      enhancePrompt: async (input) => { expect(input.apiKey).toBe(""); return { prompt, skills: ["wallpaper-foundation"] }; },
      submitImage: async (input) => { expect(input.prompt).toBe(prompt); return "id"; },
      waitForImage: async () => "https://example.test/image.png",
      downloadImage: async () => "wallpaper.png"
    });
    expect(keys).toEqual(["deapi"]);
    expect(result.prompt).toBe(prompt);
  });
});

