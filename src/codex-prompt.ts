import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CodexPromptCommand {
  executable: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  input: string;
  timeoutMs: number;
}

export type CodexModel = "gpt-6-astra" | "gpt-6.1-sol";
interface CodexDependencies {
  model?: CodexModel;
  executable?: string;
  run?: (command: CodexPromptCommand) => Promise<string>;
}

// The CLI manages its own login. Image-provider credentials never reach this child.
export function codexEnvironment(environment = process.env): NodeJS.ProcessEnv {
  const allowed = ["HOME", "PATH", "USER", "LANG", "LC_ALL", "TMPDIR", "TEMP", "TMP", "SYSTEMROOT", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "CODEX_HOME", "XDG_CONFIG_HOME", "XDG_RUNTIME_DIR", "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY"];
  return Object.fromEntries(allowed.filter((key) => environment[key] !== undefined).map((key) => [key, environment[key]]));
}

function runCodex(command: CodexPromptCommand) {
  return new Promise<string>((resolve, reject) => {
    const child = execFile(command.executable, command.args, {
      cwd: command.cwd, env: command.env, timeout: command.timeoutMs,
      maxBuffer: 256 * 1024, encoding: "utf8", windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(codexPromptFailure(stderr, Boolean(error.killed))));
      } else resolve(stdout);
    });
    // Prompts and skill guidance are data on stdin, never shell commands or arguments.
    child.stdin?.on("error", () => {});
    child.stdin?.end(command.input);
  });
}

export function codexPromptFailure(stderr: string, killed: boolean) {
  if (/gpt-6\.1-sol[\s\S]*not supported when using Codex with a ChatGPT account/.test(stderr)) return "GPT-6.1 Sol is not available to this ChatGPT Codex login. Select GPT-6 Astra with flux -pm codex. No image was submitted.";
  return killed ? "Codex prompt writing timed out. Check your Codex connection and try again."
    : "Codex prompt writing failed. Run codex login status, check account limits, and try again.";
}

export async function completeCodexText(input: string, dependencies: CodexDependencies = {}) {
  const executable = dependencies.executable ?? Bun.which("codex");
  if (!executable) throw new Error("Codex CLI is not installed. Install Codex, run codex login, then try again.");
  const directory = await mkdtemp(join(tmpdir(), "flux-codex-"));
  try {
    const disabled = ["shell_tool", "apps", "plugins", "browser_use", "computer_use", "image_generation", "multi_agent", "view_image", "hooks", "skill_search", "memories"];
    const output = await (dependencies.run ?? runCodex)({
      executable, cwd: directory, env: codexEnvironment(), timeoutMs: 180_000,
      args: ["exec", "--model", dependencies.model ?? "gpt-6-astra", "-c", 'model_reasoning_effort="high"', "--ignore-user-config", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never",
        ...disabled.flatMap((feature) => ["--disable", feature]),
        "-c", "project_doc_max_bytes=0", "-c", 'web_search="disabled"', "--cd", directory, "-"],
      input
    });
    if (!output.trim()) throw new Error("Codex returned an empty wallpaper prompt. Try again.");
    return output.trim();
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function completeCodexPrompt(system: string, user: string, dependencies: CodexDependencies = {}) {
  return completeCodexText(`You are a text-only wallpaper art director. Do not use tools or inspect files. Make reasonable artistic choices and finish without asking questions.\n\n${system}\n\nWrite one finished image prompt, normally 80–180 words and never more than 250. Choose one coherent medium; describe how the scene is physically constructed in that medium rather than mixing generic style labels. Give the subject a distinctive silhouette, restrained palette, specific materials and a believable light source. Arrange foreground, middle distance and background deliberately, with quiet desktop space. Preserve the requested subjects, colors, orientation, and exclusions. Avoid stock quality tags, generic cinematic spectacle and competing focal points. Return the prompt only.\n\nWallpaper request:\n${user}`, dependencies);
}
