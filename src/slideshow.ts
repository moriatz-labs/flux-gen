import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";
import { configDirectory } from "./paths.ts";

const execFile = promisify(execFileCallback);
const intervalMinutes = 30;
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic"]);

export interface SlideshowRuntime {
  platform?: NodeJS.Platform;
  executable?: string;
  main?: string;
  run?: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  configDir?: string;
  home?: string;
  uid?: number;
}

function runner(runtime: SlideshowRuntime) {
  return runtime.run ?? (async (file: string, args: string[]) => {
    const result = await execFile(file, args, { windowsHide: true, timeout: 15_000 });
    return { stdout: result.stdout, stderr: result.stderr };
  });
}

function command(runtime: SlideshowRuntime) {
  const executable = runtime.executable ?? process.execPath;
  const main = runtime.main ?? Bun.main;
  return basename(executable).toLowerCase().startsWith("bun")
    ? [executable, main, "wallpaper", "next"]
    : [executable, "wallpaper", "next"];
}

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function ignoreFailure(action: () => Promise<unknown>) {
  try { await action(); } catch { /* The integration may not exist yet. */ }
}

export async function configureSlideshow(enabled: boolean, runtime: SlideshowRuntime = {}) {
  const platform = runtime.platform ?? process.platform;
  const run = runner(runtime);
  const parts = command(runtime);
  const directory = runtime.configDir ?? configDirectory();
  await mkdir(directory, { recursive: true });

  if (platform === "win32") {
    const taskName = "FluxGen Slideshow";
    if (!enabled) {
      await ignoreFailure(() => run("schtasks.exe", ["/Delete", "/TN", taskName, "/F"]));
      return;
    }
    const taskCommand = parts.map((part) => `"${part.replaceAll('"', '\\"')}"`).join(" ");
    await run("schtasks.exe", ["/Create", "/TN", taskName, "/TR", taskCommand, "/SC", "MINUTE", "/MO", String(intervalMinutes), "/F"]);
    return;
  }

  if (platform === "darwin") {
    const label = "com.moriatz.flux-gen.slideshow";
    const launchAgents = join(runtime.home ?? homedir(), "Library", "LaunchAgents");
    const path = join(launchAgents, `${label}.plist`);
    const domain = `gui/${runtime.uid ?? process.getuid?.() ?? 501}`;
    if (!enabled) {
      await ignoreFailure(() => run("launchctl", ["bootout", domain, path]));
      await rm(path, { force: true });
      return;
    }
    await mkdir(launchAgents, { recursive: true });
    const argumentsXml = parts.map((part) => `      <string>${xml(part)}</string>`).join("\n");
    const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n  <dict>\n    <key>Label</key><string>${label}</string>\n    <key>ProgramArguments</key>\n    <array>\n${argumentsXml}\n    </array>\n    <key>StartInterval</key><integer>${intervalMinutes * 60}</integer>\n    <key>RunAtLoad</key><true/>\n  </dict>\n</plist>\n`;
    await writeFile(path, plist, { mode: 0o600 });
    await ignoreFailure(() => run("launchctl", ["bootout", domain, path]));
    await run("launchctl", ["bootstrap", domain, path]);
    return;
  }

  throw new Error(`Automatic slideshows are not supported on ${platform}.`);
}

export async function chooseWallpaper(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile() && imageExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase()))
    .map((entry) => join(directory, entry.name));
  if (!paths.length) throw new Error(`No wallpapers found in ${directory}.`);
  return paths[Math.floor(Math.random() * paths.length)]!;
}

export async function applyWallpaper(path: string, runtime: SlideshowRuntime = {}) {
  const platform = runtime.platform ?? process.platform;
  const run = runner(runtime);
  if (platform === "win32") {
    const encodedPath = Buffer.from(path, "utf8").toString("base64");
    const script = `$wallpaperPath = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'))\nAdd-Type @'\nusing System.Runtime.InteropServices;\npublic class FluxWallpaper { [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool SystemParametersInfo(int action, int param, string path, int flags); }\n'@\nif (-not [FluxWallpaper]::SystemParametersInfo(20, 0, $wallpaperPath, 1)) { throw "Windows could not set the wallpaper." }`;
    const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand]);
    return;
  }
  if (platform === "darwin") {
    const script = 'on run argv\nset wallpaperFile to POSIX file (item 1 of argv)\ntell application "System Events" to tell every desktop to set picture to wallpaperFile\nend run';
    await run("osascript", ["-e", script, path]);
    return;
  }
  throw new Error(`Applying wallpapers is not supported on ${platform}.`);
}

export async function applyNextWallpaper(directory: string, runtime: SlideshowRuntime = {}) {
  const path = await chooseWallpaper(directory);
  await applyWallpaper(path, runtime);
  return path;
}
