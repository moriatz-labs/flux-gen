import { describe, expect, test } from "bun:test";
import { completePrompt, providerForModel } from "../src/prompt-providers.ts";

describe("prompt providers", () => {
  test("maps the curated models", () => {
    expect(providerForModel("gpt-5.6-luna")).toBe("openai");
    expect(providerForModel("gemini-3.6-flash")).toBe("google");
    expect(providerForModel("claude-sonnet-5")).toBe("anthropic");
  });

  test("parses an OpenAI response", async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ output_text: "wide calm lake" }), { status: 200 });
    expect(await completePrompt("gpt-5.6-luna", "secret", "system", "lake", fakeFetch as unknown as typeof fetch)).toBe("wide calm lake");
  });
});
