import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fetchJson } from "./http.ts";
import type { DeapiModel } from "./types.ts";

const apiBase = "https://api.deapi.ai/api/v2";

function headers(apiKey: string) {
  return { accept: "application/json", authorization: `Bearer ${apiKey}` };
}

export async function listImageModels(apiKey: string, fetchImplementation: typeof fetch = fetch) {
  const models: DeapiModel[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const url = new URL(`${apiBase}/models`);
    url.searchParams.set("filter[inference_types]", "txt2img");
    url.searchParams.set("page", String(page));
    const payload = await fetchJson<{
      data?: DeapiModel[];
      meta?: { current_page?: number; last_page?: number };
    }>(url.toString(), { headers: headers(apiKey) }, fetchImplementation);
    models.push(...(payload.data ?? []));
    lastPage = Math.max(1, payload.meta?.last_page ?? 1);
    page = (payload.meta?.current_page ?? page) + 1;
  } while (page <= lastPage);
  return models.sort((a, b) => a.name.localeCompare(b.name));
}

export async function submitImage({
  apiKey,
  prompt,
  model,
  fetchImplementation = fetch
}: {
  apiKey: string;
  prompt: string;
  model: string;
  fetchImplementation?: typeof fetch;
}) {
  const payload = await fetchJson<{ data?: { request_id?: string } }>(`${apiBase}/images/generations`, {
    method: "POST",
    headers: { ...headers(apiKey), "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      model,
      width: 1536,
      height: 864,
      guidance: 7.5,
      steps: 4,
      seed: Math.floor(Math.random() * 2_147_483_647),
      quality: "medium",
      enhance_prompt: false
    })
  }, fetchImplementation);
  const requestId = payload.data?.request_id;
  if (!requestId) throw new Error("DEAPI accepted the request but returned no request ID.");
  return requestId;
}

export async function waitForImage({
  apiKey,
  requestId,
  fetchImplementation = fetch,
  pollIntervalMs = 2_500,
  timeoutMs = 300_000,
  onProgress
}: {
  apiKey: string;
  requestId: string;
  fetchImplementation?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onProgress?: (progress?: number) => void;
}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (pollIntervalMs) await Bun.sleep(pollIntervalMs);
    const payload = await fetchJson<{
      data?: {
        result_url?: string;
        result?: string;
        progress?: number;
        error_message?: string;
        error_reason?: string;
      };
    }>(`${apiBase}/jobs/${encodeURIComponent(requestId)}`, { headers: headers(apiKey) }, fetchImplementation);
    const data = payload.data ?? {};
    const result = data.result_url ?? data.result;
    if (result) return result;
    if (data.error_message || data.error_reason) throw new Error(`DEAPI generation failed: ${data.error_message ?? data.error_reason}`);
    onProgress?.(data.progress);
  }
  throw new Error(`DEAPI generation timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
}

function safeSlug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "wallpaper";
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

export async function downloadImage({
  url,
  outputDirectory,
  request,
  fetchImplementation = fetch
}: {
  url: string;
  outputDirectory: string;
  request: string;
  fetchImplementation?: typeof fetch;
}) {
  const response = await fetchImplementation(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Could not download generated image (${response.status}).`);
  const contentType = response.headers.get("content-type") ?? "";
  const fromUrl = extname(new URL(url).pathname).toLowerCase();
  const extension = contentType.includes("webp") ? ".webp" : contentType.includes("jpeg") ? ".jpg" : [".png", ".jpg", ".jpeg", ".webp"].includes(fromUrl) ? fromUrl : ".png";
  await mkdir(outputDirectory, { recursive: true });
  const path = join(outputDirectory, `${timestamp()}-${safeSlug(request)}${extension}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  return path;
}
