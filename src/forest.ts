import { mkdir, readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { configDirectory } from "./paths.ts";
import { loadConfig } from "./config.ts";
import { generateWallpaper } from "./generate.ts";
import { CODEX_IMAGE_MODEL } from "./codex-image.ts";
import { applyWallpaper } from "./wallpaper.ts";
import { archivePaperImage } from "./paper.ts";
import { chooseForestPlan, forestDate } from "./forest-profile.ts";
import { acquireForestLock, addWebVariant, atomicJson, publishForestAssets, readManifest, storeForestImage, verifyAsset, type ForestManifest } from "./forest-assets.ts";

export interface ForestSettings { assetsDirectory: string; timeZone: string; remote: string; }
export const forestSettingsPath = () => join(configDirectory(), "forest.json");
export async function loadForestSettings(path = forestSettingsPath()): Promise<ForestSettings> {
  const settings = JSON.parse(await readFile(path, "utf8")) as ForestSettings;
  if (!isAbsolute(settings.assetsDirectory) || !settings.remote?.startsWith("https://github.com/")) throw new Error("Invalid forest assets settings.");
  new Intl.DateTimeFormat("en", { timeZone: settings.timeZone }).format(new Date());
  return settings;
}
export async function readForestHistory(root: string): Promise<ForestManifest[]> {
  const directory = join(root, "wallpapers", "forests", "daily");
  const history: ForestManifest[] = [];
  const walk = async (path: string) => {
    let entries;
    try { entries = await readdir(path, { withFileTypes: true }); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) await walk(join(path, entry.name));
      else if (entry.isFile() && /^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) {
        const manifest = JSON.parse(await readFile(join(path, entry.name), "utf8")) as ForestManifest;
        if (manifest.schemaVersion !== 1 || !manifest.palette?.id || !manifest.element?.id) throw new Error(`Invalid forest history: ${entry.name}`);
        history.push(manifest);
      }
    }
  };
  await walk(directory);
  return history;
}

export async function dailyForest(settings: ForestSettings, config: Awaited<ReturnType<typeof loadConfig>>, options: { publish?: boolean; now?: Date; stateDirectory?: string; onPhase?: (text: string) => void } = {}, dependencies: {
  generate?: typeof generateWallpaper; apply?: typeof applyWallpaper; convert?: Parameters<typeof addWebVariant>[2]; publish?: typeof publishForestAssets; archive?: typeof archivePaperImage;
} = {}) {
  if (config.imageModel !== CODEX_IMAGE_MODEL || !["codex", "codex-sol"].includes(config.promptModel)) throw new Error("Daily forests require Codex subscription generation. Select flux -pm codex and flux -im codex-image first.");
  const now = options.now ?? new Date();
  const date = forestDate(now, settings.timeZone);
  const unlock = await acquireForestLock(settings.assetsDirectory);
  try {
    let manifest = await readManifest(settings.assetsDirectory, date);
    const reused = Boolean(manifest);
    if (!manifest) {
      const plan = chooseForestPlan(date, await readForestHistory(settings.assetsDirectory));
      options.onPhase?.(`${plan.palette.name} forest · ${plan.element.id}`);
      const result = await (dependencies.generate ?? generateWallpaper)(plan.request, config, { onPhase: options.onPhase, onNotice: options.onPhase });
      manifest = await storeForestImage(settings.assetsDirectory, plan, result, config, now);
    } else options.onPhase?.(`Reusing today's saved forest (${date}); no image generation requested.`);
    await (dependencies.archive ?? archivePaperImage)(await verifyAsset(settings.assetsDirectory, manifest.original), { daily: true, onNotice: options.onPhase });
    manifest = await addWebVariant(settings.assetsDirectory, manifest, dependencies.convert);
    const path = await verifyAsset(settings.assetsDirectory, manifest.original);
    const statePath = join(options.stateDirectory ?? configDirectory(), `forest-state-${createHash("sha256").update(settings.assetsDirectory).digest("hex").slice(0, 12)}.json`);
    let previous: { applied?: string } = {};
    try { previous = JSON.parse(await readFile(statePath, "utf8")); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (config.applyWallpaper && previous.applied !== path) {
      await (dependencies.apply ?? applyWallpaper)(path);
      await atomicJson(statePath, { date, applied: path });
      options.onPhase?.("Applied as desktop wallpaper.");
    }
    if (options.publish) {
      await (dependencies.publish ?? publishForestAssets)(settings.assetsDirectory, manifest, settings.remote);
      options.onPhase?.("Published today's PNG, WebP and prompt metadata to Global Assets.");
    }
    return { manifest, path, reused };
  } finally { await unlock(); }
}

export async function runForestCommand(args: string[]) {
  const [command, ...flags] = args;
  if (command === "init") {
    const option = (name: string) => flags[flags.indexOf(name) + 1];
    if (!flags.includes("--assets") || !flags.includes("--remote")) throw new Error("Usage: flux forest init --assets <absolute directory> --remote <HTTPS GitHub URL> [--timezone <IANA zone>]");
    const settings = { assetsDirectory: option("--assets")!, remote: option("--remote")!, timeZone: flags.includes("--timezone") ? option("--timezone")! : Intl.DateTimeFormat().resolvedOptions().timeZone };
    await mkdir(settings.assetsDirectory, { recursive: true });
    await atomicJson(forestSettingsPath(), settings);
    await loadForestSettings();
    console.log(`Forest assets: ${settings.assetsDirectory}\nTimezone: ${settings.timeZone}`);
    return;
  }
  const settings = await loadForestSettings();
  if (command === "plan") {
    const date = forestDate(new Date(), settings.timeZone);
    const existing = await readManifest(settings.assetsDirectory, date);
    const plan = existing ?? chooseForestPlan(date, await readForestHistory(settings.assetsDirectory));
    console.log(JSON.stringify({ date, palette: plan.palette, element: plan.element, request: plan.request, alreadyGenerated: Boolean(existing) }, null, 2));
    return;
  }
  if (command !== "daily" || flags.some((flag) => flag !== "--publish")) throw new Error("Usage: flux forest plan | flux forest daily [--publish]");
  const result = await dailyForest(settings, await loadConfig(), { publish: flags.includes("--publish"), onPhase: console.log });
  console.log(`Saved ${result.path}`);
  console.log(`Palette: ${result.manifest.palette.name}; unique element: ${result.manifest.element.id}`);
}
