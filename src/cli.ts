import { confirm, input, password, select } from "@inquirer/prompts";
import { envKeys, promptModels, providerKeyUrls, VERSION } from "./constants.ts";
import { loadConfig, saveConfig } from "./config.ts";
import { listImageModels } from "./deapi.ts";
import { generateWallpaper } from "./generate.ts";
import { enhancePrompt } from "./enhance.ts";
import { installLocal, startLocal } from "./local-runtime.ts";
import { HttpError, isAuthenticationError } from "./http.ts";
import { compositionChoices, lightingChoices, paletteChoices, styleChoices, type OfflineWallpaperDirection } from "./offline-prompt.ts";
import { getApiKey, getApiKeyDetails, maskApiKey, removeApiKey, resolveApiKeyEntry, setApiKey } from "./secrets.ts";
import { discoverSkills } from "./skills.ts";
import { applyNextWallpaper, applyWallpaper } from "./wallpaper.ts";
import { CODEX_IMAGE_MODEL } from "./codex-image.ts";
import { runForestCommand } from "./forest.ts";
import { checkForUpdate, maybeCheckForUpdates, updateNow } from "./update.ts";
import type { DeapiModel, PromptModelId, ProviderId, UpdateMode } from "./types.ts";

const providers: Array<{ name: string; value: ProviderId }> = [
  { name: "DEAPI", value: "deapi" },
  { name: "OpenAI", value: "openai" },
  { name: "Google Gemini", value: "google" },
  { name: "Anthropic", value: "anthropic" }
];

const help = `FluxGen — describe a wallpaper in plain English

Usage:
  flux <description>       Generate and save a wallpaper
  flux prompt <idea>       Write a prompt without generating an image
  flux forest plan         Preview today's forest colors and unique element
  flux forest daily [--publish]  Generate once per day, save to Global Assets, and apply
  flux forest init --assets <path> --remote <url> [--timezone <zone>]  Connect a shared assets repository
  flux local install      Download and select the local model/runtime (--cpu without a compatible GPU)
  flux local start        Run the local prompt server in this terminal
  flux                     Prompt for a description
  flux setup               Set up keys, models, and wallpaper behavior
  flux config              View configuration and key status
  flux config key          Add, replace, or remove an API key
  flux config enhancement  Turn prompt enhancement on or off
  flux config wallpaper    Apply new wallpapers automatically or save only
  flux config updates      Choose automatic, notification-only, or no update checks
  flux prompt-model, -pm [codex|codex-sol]   Select the prompt model
  flux image-model, -im [codex-image]  Select subscription or DEAPI image generation
  flux models              List supported prompt and image models
  flux skills              List bundled and user SKILL.md packages
  flux wallpaper next      Apply another image from Pictures/FluxGen
  flux update --check      Check whether a newer Flux release is available
  flux update              Download and securely install the latest release
  flux --help, -h          Show help
  flux --version, -v       Show version`;

async function safeKeyStatus(provider: ProviderId) {
  try {
    const key = await getApiKeyDetails(provider);
    return key.value ? `configured ${maskApiKey(key.value)} · ${key.source}` : "missing";
  }
  catch { return "keychain unavailable"; }
}

async function showConfig() {
  const config = await loadConfig();
  console.log("Flux configuration\n");
  console.log(`  Output            ${config.outputDirectory}`);
  console.log(`  Enhancement       ${config.enhancement ? "on" : "off"}`);
  console.log(`  Apply wallpaper   ${config.applyWallpaper ? "on" : "off"}`);
  console.log(`  Prompt model      ${config.promptModel}`);
  if (config.promptModel === "codex" || config.promptModel === "codex-sol") console.log(`  Codex model       ${config.promptModel === "codex-sol" ? "gpt-6.1-sol" : "gpt-6-astra"} · high reasoning`);
  console.log(`  Image model       ${config.imageModel}`);
  console.log(`  Updates           ${config.updateMode}`);
  console.log("\nAPI keys");
  for (const provider of providers) {
    const status = await safeKeyStatus(provider.value);
    console.log(`  ${provider.name.padEnd(18)} ${status}`);
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
  await requestKey(provider);
  if (provider === "deapi") {
    await fetchModelsOrExplain();
    console.log("DEAPI accepted the active key.");
  }
}

async function requestKey(provider: ProviderId, options: { optional?: boolean } = {}) {
  const label = providers.find((item) => item.value === provider)?.name ?? provider;
  const details = await getApiKeyDetails(provider);
  const current = details.value;
  const environmentKey = details.source === "environment";
  console.log(`\nCreate or manage your ${label} key here:\n${providerKeyUrls[provider]}\n`);
  if (current) {
    console.log(`Current ${label} key ${maskApiKey(current)} · from ${environmentKey ? envKeys[provider] : "the system keychain"}`);
    if (environmentKey) console.log(`A stored replacement will become active after ${envKeys[provider]} is removed.`);
    const replacement = await password({ message: `Paste a new ${label} API key, or press Enter to keep the current key`, mask: "•" });
    const update = resolveApiKeyEntry(current, replacement);
    if (update.action === "keep") {
      console.log(`Keeping the existing ${label} key.`);
      return true;
    }
    await setApiKey(provider, update.value);
    console.log(environmentKey
      ? `${label} key saved securely. ${envKeys[provider]} remains active.`
      : `${label} key replaced securely.`);
    return true;
  }
  const value = await password({
    message: options.optional ? `Paste ${label} API key, or press Enter to use built-in direction` : `Paste ${label} API key`,
    mask: "•"
  });
  if (options.optional && !value.trim()) {
    console.log(`No ${label} key added. Flux will use its built-in wallpaper direction.`);
    return false;
  }
  const update = resolveApiKeyEntry(null, value);
  if (update.action !== "replace") throw new Error("API key cannot be empty.");
  await setApiKey(provider, update.value);
  console.log(`${label} key saved securely.`);
  return true;
}

async function configureEnhancement() {
  const config = await loadConfig();
  config.enhancement = await confirm({ message: "Enhance wallpaper prompts?", default: config.enhancement });
  await saveConfig(config);
  console.log(`Prompt enhancement ${config.enhancement ? "enabled" : "disabled"}.`);
}

async function configureWallpaperPrompt() {
  const config = await loadConfig();
  config.applyWallpaper = await confirm({ message: "Apply each newly generated wallpaper immediately?", default: config.applyWallpaper });
  await saveConfig(config);
  console.log(config.applyWallpaper ? "New wallpapers will be applied immediately." : "New wallpapers will only be saved.");
}

async function configureUpdates() {
  const config = await loadConfig();
  config.updateMode = await select<UpdateMode>({
    message: "Flux updates",
    default: config.updateMode,
    choices: [
      { name: "Install automatically", value: "automatic" },
      { name: "Tell me when an update is available", value: "notify" },
      { name: "Do not check", value: "off" }
    ]
  });
  config.lastUpdateCheck = undefined;
  await saveConfig(config);
  console.log(`Updates set to ${config.updateMode}.`);
}

async function configurePromptModel(requested?: string) {
  const config = await loadConfig();
  if (requested && !promptModels.some((model) => model.id === requested)) throw new Error(`Unsupported prompt model: ${requested}`);
  config.promptModel = requested as PromptModelId ?? await select<PromptModelId>({
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

async function configureImageModel(requested?: string) {
  const config = await loadConfig();
  const key = requested === CODEX_IMAGE_MODEL ? null : await getApiKey("deapi");
  const models = key ? await listImageModels(key) : [];
  if (requested && requested !== CODEX_IMAGE_MODEL && !models.some((model) => model.slug === requested)) throw new Error(`Image model not available: ${requested}`);
  config.imageModel = requested ?? await select({
    message: "Image model",
    default: config.imageModel,
    pageSize: 14,
    choices: [{ name: "GPT Image 2 · Codex/ChatGPT subscription · no API key", value: CODEX_IMAGE_MODEL },
      ...models.map((model) => ({ name: `${model.name} · ${model.slug}`, value: model.slug }))]
  });
  await saveConfig(config);
  console.log(`Image model set to ${config.imageModel}.`);
}

async function setup() {
  console.log("Flux setup\n");
  const config = await loadConfig();
  const subscriptionImage = config.imageModel === CODEX_IMAGE_MODEL;
  if (subscriptionImage) console.log("Images use Codex/ChatGPT subscription access. Run codex login if you have not signed in. No DEAPI key is required.");
  else await requestKey("deapi");

  let models: DeapiModel[];
  try {
    models = subscriptionImage ? [] : await fetchModelsOrExplain();
    if (!subscriptionImage) console.log("DEAPI accepted the active key.\n");
  } catch (error) {
    if (isAuthenticationError(error)) throw error;
    console.log(`Could not load image models: ${(error as Error).message}`);
    models = [];
  }

  config.enhancement = await confirm({ message: "Enhance prompts with an AI prompt model?", default: config.enhancement });
  if (config.enhancement) {
    config.promptModel = await select<PromptModelId>({
      message: "Prompt model",
      default: config.promptModel,
      choices: promptModels.map((model) => ({ name: `${model.label} · ${model.provider}`, value: model.id }))
    });
    const promptProvider = promptModels.find((model) => model.id === config.promptModel)!.provider;
    if (promptProvider === "local") console.log("Local prompt writing needs no provider key. Run flux local install, then flux local start in a separate terminal.");
    else if (promptProvider === "codex") console.log("Codex prompt writing uses your Codex CLI login. Run codex login if you have not signed in.");
    else await requestKey(promptProvider, { optional: true });
  }

  if (models.length) {
    config.imageModel = await select({
      message: "Image model",
      default: config.imageModel,
      pageSize: 14,
      choices: models.map((model) => ({ name: `${model.name} · ${model.slug}`, value: model.slug }))
    });
  }

  config.applyWallpaper = true;
  const automaticUpdates = await confirm({ message: "Keep Flux automatically updated?", default: config.updateMode === "automatic" });
  config.updateMode = automaticUpdates ? "automatic" : "notify";
  config.lastUpdateCheck = undefined;
  await saveConfig(config);

  console.log("\nSetup complete.");
  console.log("Each newly generated image will be applied as your current wallpaper.");
  console.log('Try: flux "a quiet observatory above the clouds at blue hour"');
}

export async function offerDeapiKeyRecovery(
  error: HttpError,
  dependencies: {
    interactive?: boolean;
    ask?: () => Promise<boolean>;
    reconfigure?: () => Promise<void>;
    onSuccess?: () => void;
  } = {}
) {
  if (!error.url.includes("deapi.ai") || !isAuthenticationError(error)) return false;
  const interactive = dependencies.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive) return false;
  const retry = dependencies.ask ?? (() => confirm({ message: "Configure the DEAPI key again now?", default: true }));
  if (!await retry()) return false;
  const reconfigure = dependencies.reconfigure ?? (async () => {
    await requestKey("deapi");
    await fetchModelsOrExplain();
  });
  await reconfigure();
  (dependencies.onSuccess ?? (() => console.log("DEAPI accepted the active key. Run your Flux command again.")))();
  return true;
}

function printUpdateResult(update: Awaited<ReturnType<typeof updateNow>>) {
  if (!update.available || update.result === "current") {
    console.log(`Flux ${update.current} is up to date.`);
    return;
  }
  if (update.result === "staged") {
    console.log(`Flux ${update.latest} will finish installing after this command closes.`);
    return;
  }
  console.log(`Flux updated from ${update.current} to ${update.latest}.`);
}

async function updateCommand(checkOnly: boolean) {
  if (checkOnly) {
    const update = await checkForUpdate();
    console.log(update.available
      ? `Flux ${update.latest} is available. You have ${update.current}. Run \`flux update\` to install it.`
      : `Flux ${update.current} is up to date.`);
    return;
  }
  printUpdateResult(await updateNow());
}

async function handleConfiguredUpdates() {
  const update = await maybeCheckForUpdates();
  if (!update) return;
  if (update.result === "notify") {
    console.log(`Flux ${update.latest} is available. Run \`flux update\` to install it.\n`);
  } else if (update.result === "staged") {
    console.log(`Flux ${update.latest} will finish installing after this command closes.\n`);
  } else {
    console.log(`Flux automatically updated to ${update.latest}.\n`);
  }
}

async function showModels() {
  const config = await loadConfig();
  console.log("Prompt models\n");
  for (const model of promptModels) {
    const status = model.provider === "local" ? "no API key required" : model.provider === "codex" ? "uses Codex CLI login" : await safeKeyStatus(model.provider);
    console.log(`  ${model.id === config.promptModel ? "●" : "○"} ${model.id.padEnd(22)} ${model.provider} · ${status}`);
  }
  console.log(`\nSubscription image model\n\n  ${config.imageModel === CODEX_IMAGE_MODEL ? "●" : "○"} ${CODEX_IMAGE_MODEL} · GPT Image 2 · Codex CLI login, included usage limits`);
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

async function collectOfflineWallpaperDirection(): Promise<OfflineWallpaperDirection> {
  console.log("\nNo prompt-model key is active. A few visual choices will help Flux direct the wallpaper locally.");
  console.log("Press Enter on any question to keep Auto and let Flux decide.\n");
  const style = await select({ message: "What should it look like?", default: "auto", choices: styleChoices });
  const lighting = await select({ message: "What sort of lighting?", default: "auto", choices: lightingChoices });
  const composition = await select({ message: "How should the scene be composed?", default: "auto", choices: compositionChoices });
  const palette = await select({ message: "What color mood?", default: "auto", choices: paletteChoices });
  return { style, lighting, composition, palette };
}

async function generate(description: string) {
  if (!description.trim()) throw new Error("Please describe the wallpaper you want.");
  const config = await loadConfig();
  let offlineDirection: OfflineWallpaperDirection | undefined;
  if (config.enhancement) {
    const promptProvider = promptModels.find((model) => model.id === config.promptModel)!.provider;
    const keyless = promptProvider === "local" || promptProvider === "codex";
    const promptKey = keyless ? "" : await getApiKey(promptProvider);
    if (!keyless && !promptKey && process.stdin.isTTY && process.stdout.isTTY) {
      offlineDirection = await collectOfflineWallpaperDirection();
    }
  }
  let lastProgress = -1;
  const result = await generateWallpaper(description.trim(), config, {
    offlineDirection,
    onPhase: (message) => console.log(`  ${message}`),
    onNotice: (message) => console.log(`  ${message}`),
    onProgress: (progress) => {
      const rounded = typeof progress === "number" ? Math.floor(progress) : -1;
      if (rounded >= 0 && rounded !== lastProgress) {
        lastProgress = rounded;
        console.log(`  Rendering ${rounded}%`);
      }
    }
  });
  console.log(`\nSaved ${result.path}`);
  if (config.applyWallpaper) {
    try {
      await applyWallpaper(result.path);
      console.log("Applied as desktop wallpaper.");
    } catch (error) {
      console.log(`Wallpaper saved, but could not be applied: ${(error as Error).message}`);
    }
  }
  if (result.enhanced) {
    console.log(`Skills ${result.skills.join(", ")}`);
    console.log(`Prompt ${result.prompt}`);
  }
}

export async function runGenerationLoop(
  initialDescription: string,
  dependencies: {
    generate?: (description: string) => Promise<void>;
    askAgain?: () => Promise<boolean>;
    askDescription?: () => Promise<string>;
    interactive?: boolean;
  } = {}
) {
  const create = dependencies.generate ?? generate;
  const askAgain = dependencies.askAgain ?? (() => confirm({ message: "Create another wallpaper?", default: true }));
  const askDescription = dependencies.askDescription ?? (() => input({ message: "Describe your next wallpaper" }));
  const interactive = dependencies.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  let description = initialDescription;
  while (true) {
    await create(description);
    if (!interactive || !await askAgain()) return;
    description = await askDescription();
  }
}

export async function runCli(args = Bun.argv.slice(2)) {
  const [command, subcommand] = args;
  if (command === "--help" || command === "-h" || command === "help") return console.log(help);
  if (command === "--version" || command === "-v") return console.log(VERSION);
  if (command === "forest") return runForestCommand(args.slice(1));
  if (command === "local") {
    if (subcommand === "install") return installLocal(args.includes("--cpu"));
    if (subcommand === "start") return startLocal();
    throw new Error("Usage: flux local install [--cpu] | flux local start");
  }
  if (command === "update") return updateCommand(subcommand === "--check" || subcommand === "check");
  if (command === "prompt") {
    const request = args.slice(1).join(" ").trim();
    if (!request) throw new Error("Usage: flux prompt <idea>");
    const config = await loadConfig();
    const provider = promptModels.find((model) => model.id === config.promptModel)!.provider;
    const keyless = provider === "local" || provider === "codex";
    const apiKey = keyless ? "" : await getApiKey(provider);
    if (!keyless && !apiKey) throw new Error(`No ${provider} key configured. Select flux-local or codex with flux -pm to use a keyless prompt writer.`);
    const catalogue = await discoverSkills();
    const result = await enhancePrompt({ request, model: config.promptModel, apiKey: apiKey ?? "", skills: catalogue.skills });
    return console.log(result.prompt);
  }
  await handleConfiguredUpdates();
  if (command === "setup") return setup();
  if (command === "config") {
    if (!subcommand) return showConfig();
    if (subcommand === "key") return configureKey();
    if (subcommand === "enhancement") return configureEnhancement();
    if (subcommand === "wallpaper") return configureWallpaperPrompt();
    if (subcommand === "updates") return configureUpdates();
    throw new Error(`Unknown config command: ${subcommand}`);
  }
  if (command === "prompt-model" || command === "-pm") return configurePromptModel(subcommand);
  if (command === "image-model" || command === "-im") return configureImageModel(subcommand);
  if (command === "models") return showModels();
  if (command === "skills") return showSkills();
  if (command === "wallpaper" && subcommand === "next") {
    const config = await loadConfig();
    const path = await applyNextWallpaper(config.outputDirectory);
    return console.log(`Applied ${path}`);
  }
  if (!command) return runGenerationLoop(await input({ message: "Describe your wallpaper" }));
  return runGenerationLoop(args.join(" "));
}
