import { VERSION } from "./constants.ts";
import { loadConfig, saveConfig } from "./config.ts";
import { fetchJson } from "./http.ts";

const latestReleaseUrl = "https://api.github.com/repos/moriatz-labs/flux-gen/releases/latest";
const macInstaller = "https://flux-gen.moriatz.com/install.sh";
const windowsInstaller = "https://flux-gen.moriatz.com/install.ps1.txt";
const checkIntervalMs = 24 * 60 * 60 * 1_000;

export function compareVersions(left: string, right: string) {
  const parse = (value: string) => value.replace(/^v/, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export async function latestVersion(fetchImplementation: typeof fetch = fetch) {
  const release = await fetchJson<{ tag_name?: string }>(latestReleaseUrl, {
    headers: { accept: "application/vnd.github+json", "user-agent": `FluxGen/${VERSION}` }
  }, fetchImplementation);
  if (!release.tag_name) throw new Error("GitHub returned a release without a version tag.");
  return release.tag_name.replace(/^v/, "");
}

export async function checkForUpdate(fetchImplementation: typeof fetch = fetch) {
  const latest = await latestVersion(fetchImplementation);
  return { current: VERSION, latest, available: compareVersions(latest, VERSION) > 0 };
}

export async function installLatestRelease(platform = process.platform) {
  if (platform === "darwin") {
    const installer = Bun.spawn(["/bin/sh", "-c", `curl -fsSL ${macInstaller} | sh`], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit"
    });
    const exitCode = await installer.exited;
    if (exitCode !== 0) throw new Error(`The Flux installer exited with code ${exitCode}.`);
    return "installed" as const;
  }
  if (platform === "win32") {
    const command = `$fluxPid=${process.pid}; Wait-Process -Id $fluxPid -ErrorAction SilentlyContinue; Invoke-Expression (Invoke-RestMethod '${windowsInstaller}')`;
    const updater = Bun.spawn(["powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", command], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      detached: true,
      windowsHide: true
    });
    updater.unref();
    return "staged" as const;
  }
  throw new Error("Flux updates currently support Windows and macOS.");
}

export async function updateNow() {
  const update = await checkForUpdate();
  if (!update.available) return { ...update, result: "current" as const };
  return { ...update, result: await installLatestRelease() };
}

export async function maybeCheckForUpdates(now = new Date()) {
  const config = await loadConfig();
  if (config.updateMode === "off") return null;
  const lastCheck = config.lastUpdateCheck ? Date.parse(config.lastUpdateCheck) : 0;
  if (Number.isFinite(lastCheck) && now.getTime() - lastCheck < checkIntervalMs) return null;
  config.lastUpdateCheck = now.toISOString();
  await saveConfig(config);
  try {
    const update = await checkForUpdate();
    if (!update.available) return null;
    if (config.updateMode === "automatic") {
      return { ...update, result: await installLatestRelease() };
    }
    return { ...update, result: "notify" as const };
  } catch {
    return null;
  }
}
