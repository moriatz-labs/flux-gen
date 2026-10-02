import { execFile as execFileCallback } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic"]);

export interface WallpaperRuntime {
  platform?: NodeJS.Platform;
  run?: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
}

function runner(runtime: WallpaperRuntime) {
  return runtime.run ?? (async (file: string, args: string[]) => {
    const result = await execFile(file, args, { windowsHide: true, timeout: 15_000 });
    return { stdout: result.stdout, stderr: result.stderr };
  });
}

export async function chooseWallpaper(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile() && imageExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase()))
    .map((entry) => join(directory, entry.name));
  if (!paths.length) throw new Error(`No wallpapers found in ${directory}.`);
  return paths[Math.floor(Math.random() * paths.length)]!;
}

export async function applyWallpaper(path: string, runtime: WallpaperRuntime = {}) {
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
  if (platform === "linux") {
    try {
      await run("noctalia", ["msg", "wallpaper-set", path]);
    } catch (error) {
      throw new Error(`Linux wallpaper application requires a running Noctalia shell. ${(error as Error).message}`);
    }
    return;
  }
  throw new Error(`Applying wallpapers is not supported on ${platform}.`);
}

export async function applyNextWallpaper(directory: string, runtime: WallpaperRuntime = {}) {
  const path = await chooseWallpaper(directory);
  await applyWallpaper(path, runtime);
  return path;
}
