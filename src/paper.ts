import { createHash, randomUUID } from "node:crypto";
import { basename, isAbsolute, join } from "node:path";
import { link, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { configDirectory } from "./paths.ts";
import { loadConfig } from "./config.ts";
import { atomicJson } from "./forest-assets.ts";
import { connectPaper, paperEndpoint, type PaperClient } from "./paper-mcp.ts";

export interface PaperSettings {
  fileId: string;
  pageId: string;
  dailyPageId?: string;
  endpoint: string;
  sources: Array<{ directory: string; pageId?: string }>;
}
interface PaperImage {
  sha256: string; name: string; source: string; pageId: string;
  width: number; height: number; artboardId?: string; importedAt?: string;
}
type Board = { id: string; name: string; width: number; height: number };
export const paperSettingsPath = () => join(configDirectory(), "paper.json");
export const paperStateDirectory = (settings: PaperSettings) => join(configDirectory(), "paper", settings.fileId);
export async function loadPaperSettings(path = paperSettingsPath()): Promise<PaperSettings | null> {
  let settings: PaperSettings;
  try { settings = JSON.parse(await readFile(path, "utf8")); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const validId = (id: unknown) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  if (!validId(settings.fileId) || !validId(settings.pageId) || (settings.dailyPageId && !validId(settings.dailyPageId)) || !Array.isArray(settings.sources) || settings.sources.some((source) => !isAbsolute(source.directory) || (source.pageId && !validId(source.pageId)))) throw new Error("Invalid Paper archive settings.");
  paperEndpoint(settings.endpoint);
  return settings;
}

export function pngDimensions(data: Buffer) {
  if (data.length < 24 || !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || data.toString("ascii", 12, 16) !== "IHDR") throw new Error("Paper archive requires an original PNG.");
  const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
  if (!width || !height || width > 32768 || height > 32768) throw new Error("Invalid PNG dimensions.");
  return { width, height };
}
export function paperImageHtml(path: string, image: { width: number; height: number }) {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const normalized = path.replaceAll("\\", "/");
  return `<img src="paper-asset://${escape(normalized.startsWith("/") ? normalized : `/${normalized}`)}" style="display:block;width:${image.width}px;height:${image.height}px;object-fit:contain;flex-shrink:0;" />`;
}

async function createRecord(path: string, image: PaperImage) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(image), { mode: 0o600 });
    try { await link(temporary, path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  } finally { await rm(temporary, { force: true }); }
}
export async function queuePaperImage(path: string, settings: PaperSettings, state = paperStateDirectory(settings), pageId = settings.pageId) {
  if (!isAbsolute(path)) throw new Error("Paper image path must be absolute.");
  const bytes = await readFile(path), dimensions = pngDimensions(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await mkdir(state, { recursive: true });
  const record = join(state, `${sha256}.json`), pending = join(state, `${sha256}.png`);
  try { await readFile(record); return sha256; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  // Keep pending pixels even if a temporary Codex output is later removed.
  const temporary = `${pending}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { mode: 0o600 });
    try { await link(temporary, pending); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  } finally { await rm(temporary, { force: true }); }
  await createRecord(record, { sha256, name: basename(path, ".png").replace(/[-_]/g, " "), source: path, pageId, ...dimensions });
  return sha256;
}

async function scanImages(settings: PaperSettings, state: string) {
  const walk = async (directory: string, pageId: string) => {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    for (const entry of entries) {
      if (entry.isDirectory() && !["verification", "node_modules", ".git"].includes(entry.name)) await walk(join(directory, entry.name), pageId);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) await queuePaperImage(join(directory, entry.name), settings, state, pageId);
    }
  };
  for (const source of settings.sources) await walk(source.directory, source.pageId ?? settings.pageId);
}

async function lockArchive(state: string) {
  const lock = join(state, ".sync-lock");
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await mkdir(lock); await writeFile(join(lock, "pid"), String(process.pid)); return () => rm(lock, { recursive: true, force: true }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(await readFile(join(lock, "pid"), "utf8").catch(() => ""));
      if (!Number.isInteger(pid) || pid < 1) throw new Error("Paper archive is busy; retry sync shortly.");
      try { process.kill(pid, 0); } catch (check) {
        if ((check as NodeJS.ErrnoException).code === "ESRCH") { await rm(lock, { recursive: true, force: true }); continue; }
        throw check;
      }
      throw new Error("Another Paper archive sync is running; pending images will be retried.");
    }
  }
  throw new Error("Cannot acquire Paper archive lock.");
}

export async function syncPaper(settings: PaperSettings, options: { stateDirectory?: string; scan?: boolean; limit?: number; connect?: (endpoint: string) => Promise<PaperClient>; onImported?: (image: { artboardId: string; pageId: string; name: string }) => Promise<void> } = {}) {
  const state = options.stateDirectory ?? paperStateDirectory(settings);
  await mkdir(state, { recursive: true });
  const unlock = await lockArchive(state);
  let client: PaperClient | undefined;
  try {
    if (options.scan !== false) await scanImages(settings, state);
    const images: PaperImage[] = [];
    for (const entry of await readdir(state)) if (/^[a-f0-9]{64}\.json$/.test(entry)) images.push(JSON.parse(await readFile(join(state, entry), "utf8")));
    const pending = images.filter((image) => !image.importedAt);
    if (!pending.length) return { imported: 0, total: images.length, pending: 0 };
    client = await (options.connect ?? connectPaper)(settings.endpoint);
    await client.call("get_guide", { topic: "paper-mcp-instructions" });
    const pages = new Map<string, Board[]>();
    let imported = 0;
    for (const image of pending) {
      if (!pages.has(image.pageId)) {
        const info = await client.call("get_basic_info", { fileId: settings.fileId, pageId: image.pageId });
        if ((info.file as { id?: string } | undefined)?.id !== settings.fileId || info.pageId !== image.pageId) throw new Error("Paper returned a different file or page; upload stopped.");
        pages.set(image.pageId, info.artboards as Board[]);
        if (pages.size === 1) await client.call("get_selection", { fileId: settings.fileId });
      }
      const boards = pages.get(image.pageId)!;
      const suffix = `[sha256:${image.sha256}]`;
      let board = boards.find((item) => item.name.endsWith(suffix));
      if (!board) {
        board = await client.call("create_artboard", { fileId: settings.fileId, pageId: image.pageId, name: `${image.name} ${suffix}`, styles: { width: `${image.width}px`, height: `${image.height}px`, display: "flex" } }) as Board;
        if (!board.id) throw new Error("Paper did not return the new artboard ID.");
        boards.push(board);
      }
      if (board.width !== image.width || board.height !== image.height) throw new Error("Paper image artboard dimensions changed; review it before retrying.");
      image.artboardId = board.id;
      await atomicJson(join(state, `${image.sha256}.json`), image);
      const children = await client.call("get_children", { fileId: settings.fileId, nodeId: board.id });
      if (children.count === 0) {
        const pixels = join(state, `${image.sha256}.png`);
        if (createHash("sha256").update(await readFile(pixels)).digest("hex") !== image.sha256) throw new Error("Pending Paper image integrity check failed.");
        await client.call("write_html", { fileId: settings.fileId, targetNodeId: board.id, mode: "insert-children", html: paperImageHtml(pixels, image) });
      } else if (children.count !== 1) throw new Error("Paper archive artboard has unexpected contents; upload stopped.");
      // A lost write acknowledgement resumes from the existing image, without another artboard.
      const stored = await client.call("get_children", { fileId: settings.fileId, nodeId: board.id });
      if (stored.count !== 1) throw new Error("Paper did not store the image.");
      await client.call("finish_working_on_nodes", { fileId: settings.fileId, nodeIds: [board.id] });
      image.importedAt = new Date().toISOString();
      await atomicJson(join(state, `${image.sha256}.json`), image);
      await rm(join(state, `${image.sha256}.png`), { force: true });
      imported++;
      await options.onImported?.({ artboardId: board.id, pageId: image.pageId, name: image.name });
      if (options.limit && imported >= options.limit) break;
    }
    return { imported, total: images.length, pending: pending.length - imported };
  } finally { try { await client?.close(); } finally { await unlock(); } }
}

export async function archivePaperImage(path: string, options: { daily?: boolean; onNotice?: (message: string) => void } = {}) {
  try {
    const settings = await loadPaperSettings();
    if (!settings) return;
    await queuePaperImage(path, settings, undefined, options.daily ? settings.dailyPageId ?? settings.pageId : settings.pageId);
    const result = await syncPaper(settings);
    if (result.imported) options.onNotice?.(`Stored ${result.imported} image(s) in Paper.`);
  } catch (error) { options.onNotice?.(`Paper archive needs a retry: ${(error as Error).message} Run flux paper sync when Paper is open; the saved wallpaper is safe.`); }
}

export async function runPaperCommand(args: string[]) {
  if (args[0] === "init") {
    const flags = args.slice(1), allowed = ["--file", "--page", "--daily-page"];
    if (flags.length % 2 || flags.some((flag, index) => index % 2 === 0 && !allowed.includes(flag)) || !flags.includes("--file") || !flags.includes("--page")) throw new Error("Usage: flux paper init --file <Paper file ID> --page <page ID> [--daily-page <page ID>]");
    const value = (flag: string) => flags[flags.indexOf(flag) + 1]!;
    const settings: PaperSettings = { fileId: value("--file"), pageId: value("--page"), dailyPageId: flags.includes("--daily-page") ? value("--daily-page") : undefined, endpoint: "http://127.0.0.1:29979/mcp", sources: [{ directory: (await loadConfig()).outputDirectory, pageId: value("--page") }] };
    // Validate without replacing an existing working configuration first.
    if (![settings.fileId, settings.pageId, settings.dailyPageId ?? settings.pageId].every((id) => /^[a-zA-Z0-9_-]{1,100}$/.test(id))) throw new Error("Invalid Paper file or page ID.");
    await atomicJson(paperSettingsPath(), settings);
    console.log(`Paper archive configured: ${paperSettingsPath()}. Run flux paper sync with Paper open.`);
    return;
  }
  if (args.length !== 1 || args[0] !== "sync") throw new Error("Usage: flux paper sync | flux paper init --file <id> --page <id> [--daily-page <id>]");
  const settings = await loadPaperSettings();
  if (!settings) throw new Error("Paper archive is not configured. Run flux paper init first.");
  const result = await syncPaper(settings);
  console.log(`Paper: ${result.imported} added; ${result.total} original images stored; ${result.pending} pending.`);
}
