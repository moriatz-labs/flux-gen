import { promptModels } from "./constants.ts";
import { fetchJson } from "./http.ts";
import { completeLocalPrompt } from "./local-prompt.ts";
import type { PromptModelId } from "./types.ts";

export function providerForModel(model: PromptModelId) {
  const entry = promptModels.find((candidate) => candidate.id === model);
  if (!entry) throw new Error(`Unsupported prompt model: ${model}`);
  return entry.provider;
}

function requireText(value: unknown, provider: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${provider} returned an empty response.`);
  return value.trim();
}

export async function completePrompt(
  model: PromptModelId,
  apiKey: string,
  system: string,
  user: string,
  fetchImplementation: typeof fetch = fetch
) {
  const provider = providerForModel(model);
  if (provider === "local") return completeLocalPrompt(system, user, fetchImplementation);
  if (provider === "openai") {
    const payload = await fetchJson<{
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    }>("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, instructions: system, input: user, max_output_tokens: 1_200 })
    }, fetchImplementation);
    const fallback = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    return requireText(payload.output_text ?? fallback, "OpenAI");
  }
  if (provider === "google") {
    const payload = await fetchJson<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }>(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.55, maxOutputTokens: 2_048 }
      })
    }, fetchImplementation);
    return requireText(payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join(""), "Google");
  }
  const payload = await fetchJson<{
    content?: Array<{ type?: string; text?: string }>;
  }>("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({ model, system, messages: [{ role: "user", content: user }], max_tokens: 500 })
  }, fetchImplementation);
  return requireText(payload.content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join(""), "Anthropic");
}
