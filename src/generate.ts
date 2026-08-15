import { downloadImage, submitImage, waitForImage } from "./deapi.ts";
import { enhancePrompt } from "./enhance.ts";
import { providerForModel } from "./prompt-providers.ts";
import { getApiKey } from "./secrets.ts";
import { discoverSkills } from "./skills.ts";
import type { FluxConfig } from "./types.ts";

export async function generateWallpaper(
  request: string,
  config: FluxConfig,
  callbacks: {
    onPhase?: (message: string) => void;
    onProgress?: (progress?: number) => void;
  } = {}
) {
  const deapiKey = await getApiKey("deapi");
  if (!deapiKey) throw new Error("DEAPI key missing. Run `flux config key` or set DEAPI_API_KEY.");
  let finalPrompt = request;
  let selectedSkills: string[] = [];
  if (config.enhancement) {
    const promptProvider = providerForModel(config.promptModel);
    const promptKey = await getApiKey(promptProvider);
    if (!promptKey) throw new Error(`${promptProvider} key missing for ${config.promptModel}. Run \`flux config key\` or disable enhancement.`);
    callbacks.onPhase?.(`Enhancing with ${config.promptModel}…`);
    const catalogue = await discoverSkills();
    const enhanced = await enhancePrompt({ request, model: config.promptModel, apiKey: promptKey, skills: catalogue.skills });
    finalPrompt = enhanced.prompt;
    selectedSkills = enhanced.skills;
  }
  callbacks.onPhase?.(`Generating with ${config.imageModel}…`);
  const requestId = await submitImage({ apiKey: deapiKey, prompt: finalPrompt, model: config.imageModel });
  const url = await waitForImage({ apiKey: deapiKey, requestId, onProgress: callbacks.onProgress });
  callbacks.onPhase?.("Saving wallpaper…");
  const path = await downloadImage({ url, outputDirectory: config.outputDirectory, request });
  return { path, prompt: finalPrompt, skills: selectedSkills, requestId };
}
