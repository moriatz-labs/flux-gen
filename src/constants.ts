import type { PromptModelId, ProviderId } from "./types.ts";

export const APP_NAME = "FluxGen";
export const VERSION = "0.8.1";
export const DEFAULT_IMAGE_MODEL = "Flux_2_Klein_4B_BF16";

export const promptModels: Array<{
  id: PromptModelId;
  provider: Exclude<ProviderId, "deapi">;
  label: string;
}> = [
  { id: "gpt-5.6-luna", provider: "openai", label: "GPT-5.6 Luna" },
  { id: "gemini-3.6-flash", provider: "google", label: "Gemini 3.6 Flash" },
  { id: "claude-sonnet-5", provider: "anthropic", label: "Claude Sonnet 5" }
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
