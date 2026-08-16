import { describe, expect, test } from "bun:test";
import { completePrompt, providerForModel } from "../src/prompt-providers.ts";

describe("prompt providers", () => {
  test("maps the curated models", () => {
    expect(providerForModel("gpt-5.6-luna")).toBe("openai");
    expect(providerForModel("gpt-5.6-terra")).toBe("openai");
    expect(providerForModel("gpt-5.6-sol")).toBe("openai");
    expect(providerForModel("gemini-3.6-flash")).toBe("google");
    expect(providerForModel("claude-haiku-4-5")).toBe("anthropic");
    expect(providerForModel("claude-sonnet-5")).toBe("anthropic");
    expect(providerForModel("claude-opus-5")).toBe("anthropic");
  });

  test("parses an OpenAI response", async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ output_text: "wide calm lake" }), { status: 200 });
    expect(await completePrompt("gpt-5.6-luna", "secret", "system", "lake", fakeFetch as unknown as typeof fetch)).toBe("wide calm lake");
  });

  test("uses Claude 5 without unsupported sampling overrides", async () => {
    let requestBody: Record<string, unknown> = {};
    const fakeFetch = async (_input: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ content: [{ type: "text", text: "soft atmospheric coast" }] }), { status: 200 });
    };
    expect(await completePrompt("claude-opus-5", "secret", "system", "coast", fakeFetch as unknown as typeof fetch)).toBe("soft atmospheric coast");
    expect(requestBody.temperature).toBeUndefined();
  });
});
