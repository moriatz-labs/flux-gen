import { confirm, input, password, select } from "@inquirer/prompts";
import { envKeys, promptModels, providerKeyUrls, VERSION } from "./constants.ts";
import { loadConfig, saveConfig } from "./config.ts";
import { listImageModels } from "./deapi.ts";
import { generateWallpaper } from "./generate.ts";
import { getApiKey, hasApiKey, removeApiKey, setApiKey } from "./secrets.ts";
import { discoverSkills } from "./skills.ts";
import { applyNextWallpaper, applyWallpaper, configureSlideshow } from "./slideshow.ts";
import type { PromptModelId, ProviderId } from "./types.ts";

const providers: Array<{ name: string; value: ProviderId }> = [
  { name: "DEAPI", value: "deapi" },
  { name: "OpenAI", value: "openai" },
  { name: "Google Gemini", value: "google" },
  { name: "Anthropic", value: "anthropic" }
];

const help = `FluxGen — describe a wallpaper in plain English

Usage:
  flux <description>       Generate and save a wallpaper
  flux                     Prompt for a description
  flux setup               Set up keys, models, and the wallpaper slideshow
  flux config              View configuration and key status
  flux config key          Add, replace, or remove an API key
  flux config enhancement  Turn prompt enhancement on or off
  flux config slideshow    Turn the wallpaper slideshow on or off
  flux prompt-model, -pm   Select the prompt model
  flux image-model, -im    Select a DEAPI image model
  flux models              List supported prompt and image models
  flux skills              List bundled and user SKILL.md packages
  flux wallpaper next      Apply another image from Pictures/FluxGen
  flux --help, -h          Show help
  flux --version, -v       Show version`;

async function safeKeyStatus(provider: ProviderId) {
  try { return await hasApiKey(provider) ? "configured" : "missing"; }
  catch { return "keychain unavailable"; }
}

async function showConfig() {
  const config = await loadConfig();
  console.log("Flux configuration\n");
  console.log(`  Output            ${config.outputDirectory}`);
  console.log(`  Enhancement       ${config.enhancement ? "on" : "off"}`);
  console.log(`  Slideshow         ${config.slideshow ? "on · every 30 minutes" : "off"}`);
  console.log(`  Prompt model      ${config.promptModel}`);
  console.log(`  Image model       ${config.imageModel}`);
  console.log("\nAPI keys");
  for (const provider of providers) {
    const source = process.env[envKeys[provider.value]] ? "environment" : await safeKeyStatus(provider.value);
    console.log(`  ${provider.name.padEnd(18)} ${source}`);
  }
}

async function configureKey() {
  const provider = await select({ message: "API provider", choices: providers });
  const action = await select({
    message: `${providers.find((item) => item.value === provider)?.name} key`,
    choices: [
      { name: "Add or replace", value: "set" },
      { name: "Remove", value: "remove" }
    ]
  });
  if (action === "remove") {
    await removeApiKey(provider);
    console.log(process.env[envKeys[provider]] ? `Removed stored key. ${envKeys[provider]} is still active.` : "Stored key removed.");
    return;
  }
  console.log(`Create or manage the key here:\n${providerKeyUrls[provider]}\n`);
  const value = await password({ message: `Paste ${providers.find((item) => item.value === provider)?.name} API key`, mask: "•" });
  await setApiKey(provider, value);
  console.log("Key saved in the operating system credential store.");
}

async function requestKey(provider: ProviderId) {
  const label = providers.find((item) => item.value === provider)?.name ?? provider;
  if (await hasApiKey(provider)) {
    console.log(`${label} key already configured.`);
    return;
  }
  console.log(`\nCreate your ${label} key here:\n${providerKeyUrls[provider]}\n`);
  const value = await password({ message: `Paste ${label} API key`, mask: "•" });
  await setApiKey(provider, value);
  console.log(`${label} key saved securely.`);
}

async function configureEnhancement() {
  const config = await loadConfig();
  config.enhancement = await confirm({ message: "Enhance wallpaper prompts?", default: config.enhancement });
  await saveConfig(config);
  console.log(`Prompt enhancement ${config.enhancement ? "enabled" : "disabled"}.`);
}

async function setSlideshow(enabled: boolean) {
  const config = await loadConfig();
  await configureSlideshow(enabled);
  config.slideshow = enabled;
  await saveConfig(config);
  console.log(enabled
    ? `Wallpaper slideshow enabled. ${config.outputDirectory} rotates every 30 minutes.`
    : "Wallpaper slideshow disabled.");
}

async function configureSlideshowPrompt() {
  const config = await loadConfig();
  const enabled = await confirm({ message: "Use Pictures/FluxGen as a rotating desktop slideshow?", default: config.slideshow });
  await setSlideshow(enabled);
}

async function configurePromptModel() {
  const config = await loadConfig();
  config.promptModel = await select<PromptModelId>({
    message: "Prompt model",
    default: config.promptModel,
    choices: promptModels.map((model) => ({ name: `${model.label} · ${model.provider}`, value: model.id }))
  });
  await saveConfig(config);
  console.log(`Prompt model set to ${config.promptModel}.`);
}

async function fetchModelsOrExplain() {
  const key = await getApiKey("deapi");
  if (!key) throw new Error("DEAPI key missing. Run `flux config key` or set DEAPI_API_KEY.");
  return listImageModels(key);
}

async function configureImageModel() {
  const [config, models] = await Promise.all([loadConfig(), fetchModelsOrExplain()]);
  if (!models.length) throw new Error("DEAPI returned no text-to-image models.");
  config.imageModel = await select({
    message: "Image model",
    default: config.imageModel,
    pageSize: 14,
    choices: models.map((model) => ({ name: `${model.name} · ${model.slug}`, value: model.slug }))
  });
  await saveConfig(config);
  console.log(`Image model set to ${config.imageModel}.`);
}

async function setup() {
  console.log("Flux setup\n");
  await requestKey("deapi");

  const config = await loadConfig();
  config.enhancement = await confirm({ message: "Enhance prompts with an AI prompt model?", default: config.enhancement });
  if (config.enhancement) {
    config.promptModel = await select<PromptModelId>({
      message: "Prompt model",
      default: config.promptModel,
      choices: promptModels.map((model) => ({ name: `${model.label} · ${model.provider}`, value: model.id }))
    });
    const promptProvider = promptModels.find((model) => model.id === config.promptModel)!.provider;
    await requestKey(promptProvider);
  }

  try {
    const models = await fetchModelsOrExplain();
    if (models.length) {
      config.imageModel = await select({
        message: "Image model",
        default: config.imageModel,
        pageSize: 14,
        choices: models.map((model) => ({ name: `${model.name} · ${model.slug}`, value: model.slug }))
      });
    }
  } catch (error) {
    console.log(`Could not load image models: ${(error as Error).message}`);
  }

  const slideshow = await confirm({ message: "Use Pictures/FluxGen as a rotating desktop slideshow?", default: config.slideshow });
  await configureSlideshow(slideshow);
  config.slideshow = slideshow;
  await saveConfig(config);

  console.log("\nSetup complete.");
  console.log('Try: flux "a quiet observatory above the clouds at blue hour"');
}

async function showModels() {
  const config = await loadConfig();
  console.log("Prompt models\n");
  for (const model of promptModels) {
    console.log(`  ${model.id === config.promptModel ? "●" : "○"} ${model.id.padEnd(22)} ${model.provider} · ${await safeKeyStatus(model.provider)}`);
  }
  console.log("\nDEAPI image models\n");
  try {
    const models = await fetchModelsOrExplain();
    for (const model of models) console.log(`  ${model.slug === config.imageModel ? "●" : "○"} ${model.slug}${model.name === model.slug ? "" : ` · ${model.name}`}`);
  } catch (error) {
    console.log(`  ${(error as Error).message}`);
  }
}

async function showSkills() {
  const catalogue = await discoverSkills();
  console.log("Wallpaper skills\n");
  for (const skill of catalogue.skills) console.log(`  ${skill.name.padEnd(25)} ${skill.source.padEnd(8)} ${skill.description}`);
  if (catalogue.warnings.length) {
    console.log("\nWarnings");
    for (const warning of catalogue.warnings) console.log(`  ${warning.path}: ${warning.message}`);
  }
}

async function generate(description: string) {
  if (!description.trim()) throw new Error("Please describe the wallpaper you want.");
  const config = await loadConfig();
  let lastProgress = -1;
  const result = await generateWallpaper(description.trim(), config, {
    onPhase: (message) => console.log(`  ${message}`),
    onProgress: (progress) => {
      const rounded = typeof progress === "number" ? Math.floor(progress) : -1;
      if (rounded >= 0 && rounded !== lastProgress) {
        lastProgress = rounded;
        console.log(`  Rendering ${rounded}%`);
      }
    }
  });
  console.log(`\nSaved ${result.path}`);
  if (config.slideshow) {
    try {
      await applyWallpaper(result.path);
      console.log("Applied as desktop wallpaper. The FluxGen folder will continue rotating.");
    } catch (error) {
      console.log(`Wallpaper saved, but could not be applied: ${(error as Error).message}`);
    }
  }
  if (config.enhancement) {
    console.log(`Skills ${result.skills.join(", ")}`);
    console.log(`Prompt ${result.prompt}`);
  }
}

export async function runCli(args = Bun.argv.slice(2)) {
  const [command, subcommand] = args;
  if (command === "--help" || command === "-h" || command === "help") return console.log(help);
  if (command === "--version" || command === "-v") return console.log(VERSION);
  if (command === "setup") return setup();
  if (command === "config") {
    if (!subcommand) return showConfig();
    if (subcommand === "key") return configureKey();
    if (subcommand === "enhancement") return configureEnhancement();
    if (subcommand === "slideshow") return configureSlideshowPrompt();
    throw new Error(`Unknown config command: ${subcommand}`);
  }
  if (command === "prompt-model" || command === "-pm") return configurePromptModel();
  if (command === "image-model" || command === "-im") return configureImageModel();
  if (command === "models") return showModels();
  if (command === "skills") return showSkills();
  if (command === "wallpaper" && subcommand === "next") {
    const config = await loadConfig();
    const path = await applyNextWallpaper(config.outputDirectory);
    return console.log(`Applied ${path}`);
  }
  if (!command) return generate(await input({ message: "Describe your wallpaper" }));
  return generate(args.join(" "));
}
