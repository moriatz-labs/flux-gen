import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { configDirectory } from "./paths.ts";

const execFile = promisify(execFileCallback);
const intervalMinutes = 30;
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic"]);

export interface SlideshowRuntime {
  platform?: NodeJS.Platform;
  executable?: string;
  main?: string;
  environment?: NodeJS.ProcessEnv;
  run?: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  configDir?: string;
  home?: string;
  uid?: number;
}

function runner(runtime: SlideshowRuntime) {
  return runtime.run ?? (async (file: string, args: string[]) => {
    const result = await execFile(file, args, { windowsHide: true });
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

function systemd(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
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

  if (platform === "linux") {
    const systemdDirectory = join(runtime.home ?? homedir(), ".config", "systemd", "user");
    const servicePath = join(systemdDirectory, "flux-gen-slideshow.service");
    const timerPath = join(systemdDirectory, "flux-gen-slideshow.timer");
    if (!enabled) {
      await ignoreFailure(() => run("systemctl", ["--user", "disable", "--now", "flux-gen-slideshow.timer"]));
      await Promise.all([rm(servicePath, { force: true }), rm(timerPath, { force: true })]);
      await ignoreFailure(() => run("systemctl", ["--user", "daemon-reload"]));
      return;
    }
    await mkdir(systemdDirectory, { recursive: true });
    const desktop = runtime.environment?.XDG_CURRENT_DESKTOP ?? process.env.XDG_CURRENT_DESKTOP ?? "";
    await writeFile(servicePath, `[Unit]\nDescription=Rotate FluxGen wallpaper\n\n[Service]\nType=oneshot\nEnvironment=${systemd(`XDG_CURRENT_DESKTOP=${desktop}`)}\nExecStart=${parts.map(systemd).join(" ")}\n`, { mode: 0o600 });
    await writeFile(timerPath, `[Unit]\nDescription=Rotate FluxGen wallpapers every ${intervalMinutes} minutes\n\n[Timer]\nOnBootSec=1min\nOnUnitActiveSec=${intervalMinutes}min\nUnit=flux-gen-slideshow.service\n\n[Install]\nWantedBy=timers.target\n`, { mode: 0o600 });
    await run("systemctl", ["--user", "daemon-reload"]);
    await run("systemctl", ["--user", "enable", "--now", "flux-gen-slideshow.timer"]);
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
    const script = `Add-Type @'\nusing System.Runtime.InteropServices;\npublic class FluxWallpaper { [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool SystemParametersInfo(int action, int param, string path, int flags); }\n'@\nif (-not [FluxWallpaper]::SystemParametersInfo(20, 0, $args[0], 3)) { throw "Windows could not set the wallpaper." }`;
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script, path]);
    return;
  }
  if (platform === "darwin") {
    const script = 'on run argv\nset wallpaperFile to POSIX file (item 1 of argv)\ntell application "System Events" to tell every desktop to set picture to wallpaperFile\nend run';
    await run("osascript", ["-e", script, path]);
    return;
  }
  if (platform === "linux") {
    const desktop = (runtime.environment ?? process.env).XDG_CURRENT_DESKTOP?.toLowerCase() ?? "";
    const uri = pathToFileURL(path).href;
    if (desktop.includes("gnome") || desktop.includes("unity")) {
      await run("gsettings", ["set", "org.gnome.desktop.background", "picture-uri", uri]);
      await ignoreFailure(() => run("gsettings", ["set", "org.gnome.desktop.background", "picture-uri-dark", uri]));
      return;
    }
    if (desktop.includes("cinnamon")) {
      await run("gsettings", ["set", "org.cinnamon.desktop.background", "picture-uri", uri]);
      return;
    }
    if (desktop.includes("mate")) {
      await run("gsettings", ["set", "org.mate.background", "picture-filename", path]);
      return;
    }
    if (desktop.includes("kde") || desktop.includes("plasma")) {
      await run("plasma-apply-wallpaperimage", [path]);
      return;
    }
    if (desktop.includes("xfce")) {
      const listed = await run("xfconf-query", ["-c", "xfce4-desktop", "-l"]);
      const properties = listed.stdout.split(/\r?\n/).filter((item) => /\/(last-image|image-path)$/.test(item));
      if (!properties.length) throw new Error("Flux could not find an XFCE desktop wallpaper property.");
      for (const property of properties) await run("xfconf-query", ["-c", "xfce4-desktop", "-p", property, "-s", path]);
      return;
    }
    throw new Error("Flux supports automatic Linux slideshows on GNOME, KDE Plasma, Cinnamon, MATE, and XFCE.");
  }
  throw new Error(`Applying wallpapers is not supported on ${platform}.`);
}

export async function applyNextWallpaper(directory: string, runtime: SlideshowRuntime = {}) {
  const path = await chooseWallpaper(directory);
  await applyWallpaper(path, runtime);
  return path;
}
