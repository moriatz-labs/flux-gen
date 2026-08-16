import { AsyncEntry } from "@napi-rs/keyring";
import { envKeys } from "./constants.ts";
import type { ProviderId } from "./types.ts";

const service = "flux-gen";

function entry(provider: ProviderId) { return new AsyncEntry(service, provider); }

function isMissingCredential(error: unknown) {
  const message = (error as Error).message?.toLowerCase() ?? "";
  return message.includes("no entry") || message.includes("not found") || message.includes("element not found");
}

export function maskApiKey(value: string) {
  const firstCharacter = [...value.trim()][0];
  return firstCharacter ? `[${firstCharacter}${"*".repeat(16)}]` : "[*****************]";
}

export function resolveApiKeyEntry(current: string | null, entry: string) {
  const normalized = entry.trim();
  if (normalized) return { action: "replace" as const, value: normalized };
  if (current) return { action: "keep" as const };
  throw new Error("API key cannot be empty.");
}

export async function getApiKey(provider: ProviderId) {
  return (await getApiKeyDetails(provider)).value;
}

export async function getApiKeyDetails(provider: ProviderId): Promise<{
  value: string | null;
  source: "environment" | "keychain" | "missing";
}> {
  const environmentValue = process.env[envKeys[provider]]?.trim();
  if (environmentValue) return { value: environmentValue, source: "environment" };
  try {
    const value = (await entry(provider).getPassword())?.trim() || null;
    return { value, source: value ? "keychain" : "missing" };
  }
  catch (error) {
    if (isMissingCredential(error)) return { value: null, source: "missing" };
    throw error;
  }
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
