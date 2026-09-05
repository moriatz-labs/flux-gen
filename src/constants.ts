import type { PromptModelId, ProviderId } from "./types.ts";

export const APP_NAME = "FluxGen";
export const VERSION = "0.10.0";
export const DEFAULT_IMAGE_MODEL = "Flux_2_Klein_4B_BF16";

export const promptModels: Array<{
  id: PromptModelId;
  provider: Exclude<ProviderId, "deapi"> | "local";
  label: string;
}> = [
  { id: "flux-local", provider: "local", label: "Flux local prompt writer" },
  { id: "gpt-5.6-luna", provider: "openai", label: "GPT-5.6 Luna" },
  { id: "gpt-5.6-terra", provider: "openai", label: "GPT-5.6 Terra" },
  { id: "gpt-5.6-sol", provider: "openai", label: "GPT-5.6 Sol" },
  { id: "gemini-3.6-flash", provider: "google", label: "Gemini 3.6 Flash" },
  { id: "claude-haiku-4-5", provider: "anthropic", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-5", provider: "anthropic", label: "Claude Sonnet 5" },
  { id: "claude-opus-5", provider: "anthropic", label: "Claude Opus 5" }
];

export const envKeys: Record<ProviderId, string> = {
  deapi: "DEAPI_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY"
};

export const providerKeyUrls: Record<ProviderId, string> = {
  deapi: "https://app.deapi.ai/settings/api-keys",
  openai: "https://platform.openai.com/api-keys",
  google: "https://aistudio.google.com/app/apikey",
  anthropic: "https://console.anthropic.com/settings/keys"
};
