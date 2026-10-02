import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { copyFile, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig } from "../src/config.ts";
import { buildForestPlan, chooseForestPlan, forestDate, forestProfile } from "../src/forest-profile.ts";
import { dailyForest } from "../src/forest.ts";
import { acquireForestLock, assetPath, manifestPath, publishForestAssets, readManifest, storeForestImage } from "../src/forest-assets.ts";
import { discoverSkills } from "../src/skills.ts";
import { selectLocalSkills } from "../src/enhance.ts";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });
const config = { ...defaultConfig(), promptModel: "codex" as const, imageModel: "codex-image" };
const remote = "https://github.com/example/Global-Assets.git";
const today = new Date("2026-10-02T02:30:00Z");

async function sourceImage() {
  root = await mkdtemp(join(tmpdir(), "flux-forest-"));
  const source = join(root, "source.png");
  await writeFile(source, Buffer.alloc(2000, 37));
  return source;
}

describe("daily forest", () => {
  test("rotates palettes and unique elements across their complete cycles, including missed dates", () => {
    const history: ReturnType<typeof chooseForestPlan>[] = [];
    for (let day = 0; day < 100; day++) {
      const date = new Date(Date.UTC(2026, 9, 2 + day * 12)).toISOString().slice(0, 10);
      const plan = chooseForestPlan(date, history);
      expect(history.slice(-11).map((p) => p.palette.id)).not.toContain(plan.palette.id);
      const previousTheme = history.filter((p) => p.palette.element === plan.palette.element);
      expect(previousTheme.slice(-5).map((p) => p.element.id)).not.toContain(plan.element.id);
      expect(plan.element.element).toBe(plan.palette.element);
      history.push(plan);
    }
    expect(() => chooseForestPlan("2026-02-31")).toThrow("valid");
    expect(() => chooseForestPlan("../../../etc")).toThrow("valid");
  });
  test("uses India calendar dates at the UTC boundary and selects the forest expertise", async () => {
    expect(forestDate(new Date("2026-10-01T20:00:00Z"), "Asia/Kolkata")).toBe("2026-10-02");
    const catalogue = await discoverSkills();
    expect(selectLocalSkills(chooseForestPlan("2026-10-02").request, catalogue.skills)).toContain("enchanted-forest");
  });
  test("keeps the immersive composition, supports requested elements and excludes botanical motifs", () => {
    expect(forestProfile.id).toBe("elemental-forest-v3");
    expect(forestProfile.elements.map((element) => element.id)).not.toContain("feather-frond");
    for (const element of forestProfile.elements) {
      expect(element.description).not.toMatch(/fern|moss|immense|oversized|leaf|flower/);
    }
    const plan = chooseForestPlan("2026-10-03");
    expect(plan.request).toContain("The entire woodland environment is the subject");
    expect(plan.request).toContain("at a modest scale");
    expect(plan.request).toContain("ferns, moss");
    expect(new Set(forestProfile.palettes.map((palette) => palette.element))).toEqual(new Set(["fire", "earth", "lightning", "energy", "water", "air"]));
    expect(forestProfile.palettes.find(p => p.id === "lightning-gold")?.colors).toContain("yellow");
    expect(forestProfile.palettes.find(p => p.id === "energy-violet")?.colors).toContain("purple");
    expect(() => buildForestPlan("2026-10-03", forestProfile.palettes[0]!, forestProfile.elements.find(e => e.element === "water")!)).toThrow("match");
  });
  test("generates, applies and converts once; reuses the same day and retries publishing without regenerating", async () => {
    const source = await sourceImage();
    const settings = { assetsDirectory: join(root, "assets"), remote, timeZone: "Asia/Kolkata" };
    let renders = 0, applies = 0, conversions = 0, publishes = 0, archives = 0;
    const deps = {
      archive: async () => { archives++; },
      generate: async () => { renders++; return { path: source, prompt: "A completed forest prompt.", skills: ["enchanted-forest"], requestId: "mock", enhanced: true, width: 1672, height: 941 }; },
      apply: async () => { applies++; },
      convert: async (input: string, output: string) => { conversions++; await copyFile(input, output); },
      publish: async () => { publishes++; if (publishes === 1) throw new Error("network unavailable"); }
    };
    const options = { now: today, publish: true, stateDirectory: join(root, "state") };
    await expect(dailyForest(settings, config, options, deps)).rejects.toThrow("network unavailable");
    const result = await dailyForest(settings, config, options, deps);
    expect(result.reused).toBe(true);
    expect([renders, applies, conversions, publishes]).toEqual([1, 1, 1, 2]);
    expect(archives).toBe(2);
    expect(result.manifest.width).toBe(1672);
    expect(result.manifest.original.path).not.toContain(root);
    expect(result.manifest.web?.path).toEndWith(".webp");
    expect(existsSync(join(settings.assetsDirectory, ".flux-forest.lock"))).toBe(false);
  });
  test("resumes a failed WebP conversion from the saved PNG without another image request", async () => {
    const source = await sourceImage();
    const settings = { assetsDirectory: join(root, "assets"), remote, timeZone: "Asia/Kolkata" };
    let renders = 0;
    const deps = { archive: async () => {}, generate: async () => { renders++; return { path: source, prompt: "forest", skills: [], requestId: "mock", enhanced: false }; }, apply: async () => {} };
    await expect(dailyForest(settings, config, { now: today, stateDirectory: join(root, "state") }, { ...deps, convert: async () => { throw new Error("ffmpeg unavailable"); } })).rejects.toThrow("ffmpeg unavailable");
    const result = await dailyForest(settings, config, { now: today, stateDirectory: join(root, "state") }, { ...deps, convert: copyFile });
    expect(result.reused).toBe(true); expect(renders).toBe(1);
  });
  test("does not regenerate corrupt or missing saved pixels and cannot fall back to a paid provider", async () => {
    const source = await sourceImage(), assets = join(root, "assets");
    const plan = chooseForestPlan("2026-10-02");
    const manifest = await storeForestImage(assets, plan, { path: source, prompt: "forest", skills: [] }, config);
    await writeFile(join(assets, manifest.original.path), "corrupt");
    await expect(readManifest(assets, plan.date)).rejects.toThrow("integrity");
    await rm(join(assets, manifest.original.path));
    await expect(readManifest(assets, plan.date)).rejects.toThrow();
    await expect(dailyForest({ assetsDirectory: assets, remote, timeZone: "Asia/Kolkata" }, { ...config, imageModel: "DEAPI-model" })).rejects.toThrow("subscription");
  });
  test("blocks concurrent generation and symlink escapes", async () => {
    const source = await sourceImage(), assets = join(root, "assets");
    const unlock = await acquireForestLock(assets);
    await expect(acquireForestLock(assets)).rejects.toThrow("Another");
    await unlock();
    const plan = chooseForestPlan("2026-10-02");
    const manifest = await storeForestImage(assets, plan, { path: source, prompt: "forest", skills: [] }, config);
    const path = join(assets, manifest.original.path);
    await rm(path); await symlink(source, path);
    await expect(assetPath(assets, manifest.original.path)).rejects.toThrow("escapes");
  });
  test("publishes only today's assets and refuses staged unrelated changes or a changed remote", async () => {
    const source = await sourceImage(), assets = join(root, "assets");
    const manifest = await storeForestImage(assets, chooseForestPlan("2026-10-02"), { path: source, prompt: "forest", skills: [] }, config);
    const calls: string[][] = [];
    let unrelated = false, wrongRemote = false, added = false;
    const run = async (args: string[]) => {
      calls.push(args);
      if (args[0] === "rev-parse") return assets;
      if (args[0] === "remote") return wrongRemote ? "https://github.com/other/repo.git" : remote;
      if (args[0] === "symbolic-ref") return "main";
      if (args[0] === "rev-list") return "0";
      if (args[0] === "diff") return unrelated ? "unrelated.txt\0" : added ? manifest.original.path : "";
      if (args[0] === "add") added = true;
      return "";
    };
    unrelated = true;
    await expect(publishForestAssets(assets, manifest, remote, run)).rejects.toThrow("Unrelated");
    expect(calls.some((args) => args[0] === "add")).toBe(false);
    unrelated = false; wrongRemote = true;
    await expect(publishForestAssets(assets, manifest, remote, run)).rejects.toThrow("unexpected");
    wrongRemote = false;
    await publishForestAssets(assets, manifest, remote, run);
    expect(calls.find((args) => args[0] === "add")).toEqual(["add", "--", manifestPath(assets, manifest.date).slice(assets.length + 1), manifest.original.path]);
    expect(calls.at(-1)).toEqual(["push", "origin", "HEAD:main"]);
  });
});
