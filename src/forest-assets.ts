import { execFile as execFileCallback } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { assertForestDate, type ForestPlan } from "./forest-profile.ts";

const execFile = promisify(execFileCallback);
export interface ForestAsset {
  path: string;
  sha256: string;
  bytes: number;
}
export interface ForestManifest extends ForestPlan {
  schemaVersion: 1;
  generatedAt: string;
  provider: string;
  promptModel: string;
  prompt: string;
  skills: string[];
  width: number;
  height: number;
  original: ForestAsset;
  web?: ForestAsset;
  selection?: { kind: "curated-favorite" | "user-replacement"; source: string; selectedAt: string; reason: string };
}

export async function atomicJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

export function manifestPath(root: string, date: string) {
  assertForestDate(date);
  return join(root, "wallpapers", "forests", "daily", date.slice(0, 4), date.slice(5, 7), `${date}.json`);
}

export async function assetPath(root: string, path: string) {
  if (isAbsolute(path) || path.split(/[\\/]/).includes("..") || !path.startsWith("wallpapers/forests/")) throw new Error("Invalid forest asset path.");
  const canonicalRoot = await realpath(root);
  const canonicalPath = await realpath(resolve(root, path));
  const inside = relative(canonicalRoot, canonicalPath);
  if (inside.startsWith("..") || isAbsolute(inside)) throw new Error("Forest asset escapes the assets repository.");
  return canonicalPath;
}

export async function describeAsset(root: string, path: string): Promise<ForestAsset> {
  const data = await readFile(path);
  return { path: relative(root, path).split("\\").join("/"), bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
}

export async function verifyAsset(root: string, asset: ForestAsset) {
  const path = await assetPath(root, asset.path);
  const actual = await describeAsset(root, path);
  if (actual.sha256 !== asset.sha256 || actual.bytes !== asset.bytes) throw new Error(`Forest asset integrity check failed: ${asset.path}`);
  return path;
}

export async function readManifest(root: string, date: string): Promise<ForestManifest | null> {
  try {
    const value = JSON.parse(await readFile(manifestPath(root, date), "utf8")) as ForestManifest;
    if (value.schemaVersion !== 1 || value.date !== date || !value.palette?.id || !value.element?.id || !value.original?.path) throw new Error("Invalid forest manifest.");
    await verifyAsset(root, value.original);
    if (value.web) await verifyAsset(root, value.web);
    return value;
  } catch (error) {
    // A missing manifest means no generation. Missing pixels in an existing manifest must fail closed.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      try { await stat(manifestPath(root, date)); } catch (missing) {
        if ((missing as NodeJS.ErrnoException).code === "ENOENT") return null;
      }
    }
    throw error;
  }
}

export async function storeForestImage(root: string, plan: ForestPlan, generated: {
  path: string; prompt: string; skills: string[]; width?: number; height?: number;
}, model: { imageModel: string; promptModel: string }, now = new Date()): Promise<ForestManifest> {
  const metadataPath = manifestPath(root, plan.date);
  await mkdir(dirname(metadataPath), { recursive: true });
  const imagePath = join(dirname(metadataPath), `${plan.date}-${plan.palette.id}-${plan.element.id}.png`);
  await copyFile(generated.path, imagePath, constants.COPYFILE_EXCL);
  const manifest: ForestManifest = {
    ...plan, schemaVersion: 1, generatedAt: now.toISOString(), provider: model.imageModel,
    promptModel: model.promptModel, prompt: generated.prompt, skills: generated.skills,
    width: generated.width ?? 0, height: generated.height ?? 0, original: await describeAsset(root, imagePath)
  };
  await atomicJson(metadataPath, manifest);
  return manifest;
}

export async function addWebVariant(root: string, manifest: ForestManifest, convert = async (input: string, output: string) => {
  await execFile("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-i", input, "-frames:v", "1", "-c:v", "libwebp", "-quality", "90", "-compression_level", "6", "-y", output], { timeout: 60_000 });
}) {
  if (manifest.web) return manifest;
  const original = await verifyAsset(root, manifest.original);
  const web = original.replace(/\.png$/, ".webp");
  const temporary = `${web}.${randomUUID()}.webp`;
  try {
    await convert(original, temporary);
    await rename(temporary, web);
    const updated = { ...manifest, web: await describeAsset(root, web) };
    await atomicJson(manifestPath(root, manifest.date), updated);
    return updated;
  } finally { await rm(temporary, { force: true }); }
}

export async function acquireForestLock(root: string) {
  const path = join(root, ".flux-forest.lock");
  await mkdir(root, { recursive: true });
  try { await mkdir(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    let pid: number;
    try { pid = JSON.parse(await readFile(join(path, "owner.json"), "utf8")).pid; }
    catch { throw new Error(`Forest generation lock needs inspection: ${path}`); }
    if (!Number.isInteger(pid) || pid <= 0) throw new Error("Invalid forest generation lock.");
    try { process.kill(pid, 0); } catch (check) {
      if ((check as NodeJS.ErrnoException).code === "ESRCH") {
        await rm(path, { recursive: true });
        return acquireForestLock(root);
      }
    }
    throw new Error("Another forest generation is running. No duplicate image was requested.");
  }
  await writeFile(join(path, "owner.json"), JSON.stringify({ pid: process.pid }));
  return async () => { await rm(path, { recursive: true, force: true }); };
}

export type GitRunner = (args: string[]) => Promise<string>;
export async function publishForestAssets(root: string, manifest: ForestManifest, expectedRemote: string, run: GitRunner = async (args) => {
  const result = await execFile("git", args, { cwd: root, timeout: 180_000, maxBuffer: 256 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  return result.stdout;
}) {
  const top = (await run(["rev-parse", "--show-toplevel"])).trim();
  if (await realpath(top) !== await realpath(root)) throw new Error("Global assets must be a dedicated Git repository.");
  const remote = (await run(["remote", "get-url", "origin"])).trim();
  if (remote !== expectedRemote) throw new Error("Assets origin changed; refusing to publish to an unexpected repository.");
  const branch = (await run(["symbolic-ref", "--short", "HEAD"])).trim();
  if (branch !== "main") throw new Error("Publish from the main assets checkout, not a detached submodule or another branch.");
  const files = [relative(root, manifestPath(root, manifest.date)).split("\\").join("/"), manifest.original.path, ...(manifest.web ? [manifest.web.path] : [])];
  for (const asset of [manifest.original, ...(manifest.web ? [manifest.web] : [])]) await verifyAsset(root, asset);
  const staged = (await run(["diff", "--cached", "--name-only", "-z"])).split("\0").filter(Boolean);
  if (staged.some((path) => !files.includes(path))) throw new Error("Unrelated changes are staged in Global Assets. Save those separately before publishing today's forest.");
  // Never include unrelated local commits, merge remote changes, force-push, or reset user files.
  await run(["fetch", "origin", "main"]);
  const behind = Number((await run(["rev-list", "--count", "HEAD..origin/main"])).trim());
  if (behind) throw new Error("Global Assets has remote updates. Update its main checkout before publishing; today's image is already saved.");
  const pending = (await run(["log", "origin/main..HEAD", "--format=%H\t%s"])).trim().split("\n").filter(Boolean);
  for (const commit of pending) {
    const [sha, subject] = commit.split("\t");
    const date = subject?.match(/^Add forest wallpaper (\d{4}-\d{2}-\d{2})$/)?.[1];
    if (!date || !/^[a-f0-9]{40,64}$/.test(sha!)) throw new Error("Global Assets has unrelated unpushed commits. Publish those separately first.");
    const changed = (await run(["diff-tree", "--no-commit-id", "--name-only", "-r", sha!])).trim().split("\n").filter(Boolean);
    const prefix = `wallpapers/forests/daily/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}`;
    if (!changed.length || changed.some((path) => !path.startsWith(prefix) || !/\.(json|png|webp)$/.test(path))) throw new Error("An unpushed commit includes unrelated assets. Publish it separately first.");
  }
  await run(["add", "--", ...files]);
  if ((await run(["diff", "--cached", "--name-only"])).trim()) await run(["commit", "-m", `Add forest wallpaper ${manifest.date}`, "--only", "--", ...files]);
  await run(["push", "origin", "HEAD:main"]);
}
