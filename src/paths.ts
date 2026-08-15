import { homedir } from "node:os";
import { join } from "node:path";

export function configDirectory(platform = process.platform, environment = process.env) {
  if (platform === "win32") {
    return join(environment.APPDATA ?? join(homedir(), "AppData", "Roaming"), "FluxGen");
  }
  if (platform === "darwin") return join(homedir(), "Library", "Application Support", "FluxGen");
  return join(environment.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "flux-gen");
}

export function defaultOutputDirectory() { return join(homedir(), "Pictures", "FluxGen"); }
export function personalSkillsDirectory() { return join(homedir(), ".flux", "skills"); }
export function projectSkillsDirectory(cwd = process.cwd()) { return join(cwd, ".flux", "skills"); }
