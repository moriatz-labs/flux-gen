import { downloadImage, submitImage, waitForImage } from "./deapi.ts";
import { enhancePrompt } from "./enhance.ts";
import { providerForModel } from "./prompt-providers.ts";
import { getApiKey } from "./secrets.ts";
import { discoverSkills } from "./skills.ts";
import { isAuthenticationError } from "./http.ts";
import { buildOfflineWallpaperPrompt, type OfflineWallpaperDirection } from "./offline-prompt.ts";
import type { FluxConfig } from "./types.ts";
import { CODEX_IMAGE_MODEL, generateCodexImage } from "./codex-image.ts";

export async function generateWallpaper(
  request: string,
  config: FluxConfig,
  callbacks: {
    onPhase?: (message: string) => void;
    onProgress?: (progress?: number) => void;
    onNotice?: (message: string) => void;
    offlineDirection?: OfflineWallpaperDirection;
  } = {},
  dependencies: {
    getApiKey?: typeof getApiKey;
    discoverSkills?: typeof discoverSkills;
    enhancePrompt?: typeof enhancePrompt;
    submitImage?: typeof submitImage;
    waitForImage?: typeof waitForImage;
    downloadImage?: typeof downloadImage;
    generateCodexImage?: typeof generateCodexImage;
  } = {}
) {
  const readKey = dependencies.getApiKey ?? getApiKey;
  const loadSkills = dependencies.discoverSkills ?? discoverSkills;
  const improvePrompt = dependencies.enhancePrompt ?? enhancePrompt;
  const submit = dependencies.submitImage ?? submitImage;
  const wait = dependencies.waitForImage ?? waitForImage;
  const download = dependencies.downloadImage ?? downloadImage;
  const subscriptionImage = config.imageModel === CODEX_IMAGE_MODEL;
  const deapiKey = subscriptionImage ? null : await readKey("deapi");
  if (!subscriptionImage && !deapiKey) throw new Error("DEAPI key missing. Run `flux config key` or set DEAPI_API_KEY, or select flux -im codex-image for subscription image generation.");
  let finalPrompt = request;
  let selectedSkills: string[] = [];
  if (config.enhancement) {
    const promptProvider = providerForModel(config.promptModel);
    const keyless = promptProvider === "local" || promptProvider === "codex";
    const promptKey = keyless ? "" : await readKey(promptProvider);
    if (!keyless && !promptKey) {
      finalPrompt = buildOfflineWallpaperPrompt(request, callbacks.offlineDirection);
      selectedSkills = ["wallpaper-foundation", "wallpaper-art-direction"];
      callbacks.onNotice?.(`No ${promptProvider} key is configured. Using Flux's built-in wallpaper direction before ${subscriptionImage ? "Codex image generation" : "DEAPI"}.`);
    } else {
      callbacks.onPhase?.(`Enhancing with ${config.promptModel}…`);
      try {
        const catalogue = await loadSkills();
        const enhanced = await improvePrompt({ request, model: config.promptModel, apiKey: promptKey ?? "", skills: catalogue.skills });
        finalPrompt = enhanced.prompt;
        selectedSkills = enhanced.skills;
      } catch (error) {
        if (keyless || !isAuthenticationError(error)) throw error;
        finalPrompt = buildOfflineWallpaperPrompt(request, callbacks.offlineDirection);
        selectedSkills = ["wallpaper-foundation", "wallpaper-art-direction"];
        callbacks.onNotice?.(`${config.promptModel} rejected its API key (${error.status}). Using Flux's built-in wallpaper direction before ${subscriptionImage ? "Codex image generation" : "DEAPI"}.`);
      }
    }
  }
  callbacks.onPhase?.(`Generating with ${config.imageModel}…`);
  if (subscriptionImage) {
    callbacks.onNotice?.("GPT Image 2 through your Codex login; uses included Codex image-generation limits. This can take a few minutes.");
    const image = await (dependencies.generateCodexImage ?? generateCodexImage)(finalPrompt, config.outputDirectory, request, { model: config.promptModel === "codex-sol" ? "gpt-6.1-sol" : "gpt-6-astra" });
    return { ...image, prompt: finalPrompt, skills: selectedSkills, enhanced: selectedSkills.length > 0 };
  }
  const requestId = await submit({ apiKey: deapiKey!, prompt: finalPrompt, model: config.imageModel });
  const url = await wait({ apiKey: deapiKey!, requestId, onProgress: callbacks.onProgress });
  callbacks.onPhase?.("Saving wallpaper…");
  const path = await download({ url, outputDirectory: config.outputDirectory, request });
  return { path, prompt: finalPrompt, skills: selectedSkills, requestId, enhanced: selectedSkills.length > 0 };
}
