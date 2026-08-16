import { downloadImage, submitImage, waitForImage } from "./deapi.ts";
import { enhancePrompt } from "./enhance.ts";
import { providerForModel } from "./prompt-providers.ts";
import { getApiKey } from "./secrets.ts";
import { discoverSkills } from "./skills.ts";
import { isAuthenticationError } from "./http.ts";
import type { FluxConfig } from "./types.ts";

export async function generateWallpaper(
  request: string,
  config: FluxConfig,
  callbacks: {
    onPhase?: (message: string) => void;
    onProgress?: (progress?: number) => void;
    onNotice?: (message: string) => void;
  } = {},
  dependencies: {
    getApiKey?: typeof getApiKey;
    discoverSkills?: typeof discoverSkills;
    enhancePrompt?: typeof enhancePrompt;
    submitImage?: typeof submitImage;
    waitForImage?: typeof waitForImage;
    downloadImage?: typeof downloadImage;
  } = {}
) {
  const readKey = dependencies.getApiKey ?? getApiKey;
  const loadSkills = dependencies.discoverSkills ?? discoverSkills;
  const improvePrompt = dependencies.enhancePrompt ?? enhancePrompt;
  const submit = dependencies.submitImage ?? submitImage;
  const wait = dependencies.waitForImage ?? waitForImage;
  const download = dependencies.downloadImage ?? downloadImage;
  const deapiKey = await readKey("deapi");
  if (!deapiKey) throw new Error("DEAPI key missing. Run `flux config key` or set DEAPI_API_KEY.");
  let finalPrompt = request;
  let selectedSkills: string[] = [];
  if (config.enhancement) {
    const promptProvider = providerForModel(config.promptModel);
    const promptKey = await readKey(promptProvider);
    if (!promptKey) {
      callbacks.onNotice?.(`No ${promptProvider} key is configured. Sending your original prompt directly to DEAPI.`);
    } else {
      callbacks.onPhase?.(`Enhancing with ${config.promptModel}…`);
      try {
        const catalogue = await loadSkills();
        const enhanced = await improvePrompt({ request, model: config.promptModel, apiKey: promptKey, skills: catalogue.skills });
        finalPrompt = enhanced.prompt;
        selectedSkills = enhanced.skills;
      } catch (error) {
        if (!isAuthenticationError(error)) throw error;
        callbacks.onNotice?.(`${config.promptModel} rejected its API key (${error.status}). Sending your original prompt directly to DEAPI.`);
      }
    }
  }
  callbacks.onPhase?.(`Generating with ${config.imageModel}…`);
  const requestId = await submit({ apiKey: deapiKey, prompt: finalPrompt, model: config.imageModel });
  const url = await wait({ apiKey: deapiKey, requestId, onProgress: callbacks.onProgress });
  callbacks.onPhase?.("Saving wallpaper…");
  const path = await download({ url, outputDirectory: config.outputDirectory, request });
  return { path, prompt: finalPrompt, skills: selectedSkills, requestId, enhanced: selectedSkills.length > 0 };
}
