import { expect, test, spyOn } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli.ts";
import { defaultConfig } from "../src/config.ts";
import { configDirectory } from "../src/paths.ts";

test.skipIf(!["win32", "linux"].includes(process.platform))("prompt command needs no image key, skips update traffic, and prints only text", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flux-prompt-command-"));
  const previousAppData = process.env.APPDATA;
  const previousXdgConfig = process.env.XDG_CONFIG_HOME;
  const text = "A still lake rests beneath layered gray mountains, rendered as a quiet panoramic illustration with delicate paper grain, low clouds, soft morning light, a restrained green and ivory palette, broad areas of visual rest, and an uninterrupted field without lettering.";
  const calls: string[] = [];
  const print = spyOn(console, "log").mockImplementation(() => {});
  const network = spyOn(globalThis, "fetch").mockImplementation((async (url: string | URL | Request) => {
    calls.push(String(url));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: text } }] });
  }) as unknown as typeof fetch);
  try {
    process.env.APPDATA = directory;
    process.env.XDG_CONFIG_HOME = directory;
    const root = configDirectory();
    await mkdir(root);
    await writeFile(join(root, "config.json"), JSON.stringify({ ...defaultConfig(), promptModel: "flux-local", updateMode: "automatic" }));
    await runCli(["prompt", "a", "quiet", "lake"]);
    expect(calls).toEqual(["http://127.0.0.1:8080/v1/chat/completions"]);
    expect(print).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledWith(text);
  } finally {
    if (previousAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = previousAppData;
    if (previousXdgConfig === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = previousXdgConfig;
    network.mockRestore(); print.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});
