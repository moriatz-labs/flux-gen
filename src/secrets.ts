import { AsyncEntry } from "@napi-rs/keyring";
import { envKeys } from "./constants.ts";
import type { ProviderId } from "./types.ts";

const service = "flux-gen";

function entry(provider: ProviderId) { return new AsyncEntry(service, provider); }

function isMissingCredential(error: unknown) {
  const message = (error as Error).message?.toLowerCase() ?? "";
  return message.includes("no entry") || message.includes("not found") || message.includes("element not found");
}

export async function getApiKey(provider: ProviderId) {
  const environmentValue = process.env[envKeys[provider]]?.trim();
  if (environmentValue) return environmentValue;
  try { return (await entry(provider).getPassword()) ?? null; }
  catch (error) { if (isMissingCredential(error)) return null; throw error; }
}

export async function hasApiKey(provider: ProviderId) { return Boolean(await getApiKey(provider)); }

export async function setApiKey(provider: ProviderId, value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error("API key cannot be empty.");
  await entry(provider).setPassword(normalized);
}

export async function removeApiKey(provider: ProviderId) {
  try { await entry(provider).deleteCredential(); }
  catch (error) { if (!isMissingCredential(error)) throw error; }
}
