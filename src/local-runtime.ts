import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { configDirectory } from "./paths.ts";
import { loadConfig, saveConfig } from "./config.ts";

export type Download = { name: string; sha256: string; url: string };
const modelBase = "https://github.com/moriatz-labs/flux-gen/releases/download/model-positive-v2";
export const modelFiles: Download[] = [
  { name: "flux-local-00001-of-00002.gguf", sha256: "ed6964a8d522f66836c658c7f0b7eabe5b9c12fef4d907de4679d1a245d7688b", url: `${modelBase}/flux-local-00001-of-00002.gguf` },
  { name: "flux-local-00002-of-00002.gguf", sha256: "382ffb39e2d7831bcfb1b37ac12ae07429e57ca77876638025dbfd8d3b954cab", url: `${modelBase}/flux-local-00002-of-00002.gguf` }
];
const modelNotices: Download[] = [
  { name: "LICENSE-QWEN.txt", sha256: "832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e", url: `${modelBase}/LICENSE-QWEN.txt` },
  { name: "NOTICE.txt", sha256: "09ff661de6cbe9a4de6de07474563bf5e773333b57a8d20f910488f18a5b36c7", url: `${modelBase}/NOTICE.txt` }
];
const runtimeBase = "https://github.com/ggml-org/llama.cpp/releases/download/b10819";
const asset = (name: string, sha256: string): Download => ({ name, sha256, url: `${runtimeBase}/${name}` });
export function runtimeFiles(platform: string, arch: string, cpu = false): Download[] {
  if (platform === "win32" && arch === "x64") return cpu ? [asset("llama-b10819-bin-win-cpu-x64.zip", "4599e502b374196d24600ea9b03c842a448c853116a15b55e8ba502bdc727b3f")] : [
    asset("llama-b10819-bin-win-cuda-12.4-x64.zip", "8acca2d6464c968f9b17e664b093b23e21aada16a8f61b2191a3a588f56518a8"),
    asset("cudart-llama-bin-win-cuda-12.4-x64.zip", "8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6")
  ];
  if (platform === "darwin" && arch === "arm64") return [asset("llama-b10819-bin-macos-arm64.tar.gz", "8933e736495eadfef0731ae32054acfaa75699bf4a6ccba77cd8475db085ec66")];
  if (platform === "darwin" && arch === "x64") return [asset("llama-b10819-bin-macos-x64.tar.gz", "04dd13ec03120685bd6e1931e8f1562d2c981ca076a3e63cc44e9a199b37816a")];
  throw new Error("The local runtime supports Windows x64 and macOS arm64/x64.");
}
async function digest(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function downloadVerified(file: Download, directory: string, fetcher: typeof fetch = fetch) {
  if (!/^[a-zA-Z0-9._-]+$/.test(file.name) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error("Invalid download manifest.");
  await mkdir(directory, { recursive: true });
  const target = join(directory, file.name);
  if (await Bun.file(target).exists()) {
    if (await digest(target) !== file.sha256) throw new Error(`Checksum mismatch for existing ${file.name}. Move it aside before retrying; it was preserved.`);
    return target;
  }
  const temporary = `${target}.${crypto.randomUUID()}.partial`;
  const response = await fetcher(file.url, { signal: AbortSignal.timeout(3_600_000) });
  if (!response.ok) throw new Error(`Download failed for ${file.name}: HTTP ${response.status}. Run flux local install again.`);
  await Bun.write(temporary, response);
  if (await digest(temporary) !== file.sha256) throw new Error(`Checksum verification failed for ${file.name}. Untrusted download was not installed.`);
  await rename(temporary, target);
  return target;
}
async function findServer(directory: string): Promise<string | undefined> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isFile() && entry.name === (process.platform === "win32" ? "llama-server.exe" : "llama-server")) return path;
    if (entry.isDirectory()) { const found = await findServer(path); if (found) return found; }
  }
}
export async function installLocal(cpu = false) {
  const files = runtimeFiles(process.platform, process.arch, cpu);
  const root = join(configDirectory(), "local", "positive-v2");
  const runtime = join(root, `b10819-${process.platform}-${process.arch}-${cpu ? "cpu" : "gpu"}`);
  console.log("Downloading the frozen local prompt model (2.50 GB) and verified llama.cpp runtime. Allow at least 6 GB free disk space.");
  console.log("Windows defaults to NVIDIA CUDA; use flux local install --cpu on other Windows hardware. macOS uses the native runtime.");
  for (const file of [...modelFiles, ...modelNotices]) { console.log(`Verifying/downloading ${file.name}…`); await downloadVerified(file, root); }
  await mkdir(runtime, { recursive: true });
  for (const file of files) {
    console.log(`Verifying/downloading ${file.name}…`);
    const archive = await downloadVerified(file, join(root, "downloads"));
    const child = process.platform === "win32"
      ? Bun.spawn(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Expand-Archive -LiteralPath $env:FLUX_ARCHIVE -DestinationPath $env:FLUX_EXTRACT -Force"], { env: { ...process.env, FLUX_ARCHIVE: archive, FLUX_EXTRACT: runtime }, stdout: "inherit", stderr: "inherit" })
      : Bun.spawn(["tar", "-xzf", archive, "-C", runtime], { stdout: "inherit", stderr: "inherit" });
    if (await child.exited !== 0) throw new Error("Runtime extraction failed. Run flux local install again.");
  }
  const server = await findServer(runtime);
  if (!server) throw new Error("The downloaded runtime did not contain llama-server.");
  await Bun.write(join(root, "installation.json"), JSON.stringify({ server, cpu }, null, 2));
  const config = await loadConfig();
  config.promptModel = "flux-local";
  config.enhancement = true;
  await saveConfig(config);
  console.log("Local prompt writing selected. Run flux local start and leave that terminal open, then use flux prompt <idea> in another terminal.");
}
export async function startLocal() {
  const root = join(configDirectory(), "local", "positive-v2");
  const manifest = Bun.file(join(root, "installation.json"));
  if (!await manifest.exists()) throw new Error("Local model is not installed. Run flux local install first (or flux local install --cpu for Windows without NVIDIA).");
  const { server, cpu } = await manifest.json() as { server: string; cpu: boolean };
  if (typeof server !== "string" || !(await stat(server)).isFile()) throw new Error("Local runtime is missing. Run flux local install again.");
  for (const file of modelFiles) if (!await Bun.file(join(root, file.name)).exists()) throw new Error("A model shard is missing. Run flux local install again.");
  console.log("Starting local prompt writer on 127.0.0.1:8080. Leave this terminal open; Ctrl+C stops it. First startup can take several minutes.");
  const child = Bun.spawn([server, "--model", join(root, modelFiles[0]!.name), "--alias", "flux-local", "--host", "127.0.0.1", "--port", "8080", "--ctx-size", "4096", "--parallel", "1", "--n-gpu-layers", cpu ? "0" : "99", "--cors-origins", "localhost", "--no-cors-credentials"], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const stop = () => child.kill("SIGINT");
  process.on("SIGINT", stop);
  try { const code = await child.exited; if (code !== 0 && code !== 130) throw new Error(`Local server exited (${code}). Check port 8080 and available memory; Windows without NVIDIA should use flux local install --cpu.`); }
  finally { process.off("SIGINT", stop); }
}

