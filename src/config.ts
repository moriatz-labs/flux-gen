import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DEFAULT_IMAGE_MODEL } from "./constants.ts";
import { configDirectory, defaultOutputDirectory } from "./paths.ts";
import { promptModelIds, type FluxConfig } from "./types.ts";

export function defaultConfig(): FluxConfig {
  return { enhancement: true, applyWallpaper: true, promptModel: "gpt-5.6-luna", imageModel: DEFAULT_IMAGE_MODEL, outputDirectory: defaultOutputDirectory() };
}

export function configPath() { return join(configDirectory(), "config.json"); }

export async function loadConfig(path = configPath()): Promise<FluxConfig> {
  const defaults = defaultConfig();
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<FluxConfig>;
    return {
      enhancement: typeof parsed.enhancement === "boolean" ? parsed.enhancement : defaults.enhancement,
      applyWallpaper: typeof parsed.applyWallpaper === "boolean" ? parsed.applyWallpaper : defaults.applyWallpaper,
      promptModel: promptModelIds.includes(parsed.promptModel as FluxConfig["promptModel"])
        ? parsed.promptModel as FluxConfig["promptModel"]
        : defaults.promptModel,
      imageModel: typeof parsed.imageModel === "string" && parsed.imageModel.trim() ? parsed.imageModel : defaults.imageModel,
      outputDirectory: typeof parsed.outputDirectory === "string" && parsed.outputDirectory.trim() ? parsed.outputDirectory : defaults.outputDirectory
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaults;
    throw new Error(`Could not read Flux configuration: ${(error as Error).message}`);
  }
}

export async function saveConfig(config: FluxConfig, path = configPath()) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}
