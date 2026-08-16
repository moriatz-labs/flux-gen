import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultConfig, loadConfig, saveConfig } from "../src/config.ts";

let temporary = "";
afterEach(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }); temporary = ""; });

describe("configuration", () => {
  test("uses safe defaults when no file exists", async () => {
    temporary = await mkdtemp(join(tmpdir(), "flux-config-"));
    const config = await loadConfig(join(temporary, "missing.json"));
    expect(config.enhancement).toBe(true);
    expect(config.promptModel).toBe("gpt-5.6-luna");
    expect(config.imageModel).toBe("Flux_2_Klein_4B_BF16");
    expect(config.applyWallpaper).toBe(true);
    expect(config.updateMode).toBe("notify");
  });

  test("round trips nonsecret configuration", async () => {
    temporary = await mkdtemp(join(tmpdir(), "flux-config-"));
    const path = join(temporary, "nested", "config.json");
    const config = { ...defaultConfig(), enhancement: false, imageModel: "another-model" };
    await saveConfig(config, path);
    expect(await loadConfig(path)).toEqual(config);
  });
});
