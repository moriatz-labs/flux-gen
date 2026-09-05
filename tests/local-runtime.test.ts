import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { downloadVerified, runtimeFiles } from "../src/local-runtime.ts";

test("runtime selection supports CPU Windows and native macOS, rejects unsupported platforms", () => {
  expect(runtimeFiles("win32", "x64").length).toBe(2);
  expect(runtimeFiles("win32", "x64", true)[0]!.name).toContain("cpu");
  expect(runtimeFiles("darwin", "arm64")[0]!.name).toContain("macos-arm64");
  expect(runtimeFiles("darwin", "x64")[0]!.name).toContain("macos-x64");
  expect(() => runtimeFiles("linux", "x64")).toThrow("supports Windows");
});
test("downloads are verified, reused only when intact, and corrupt content is never installed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flux-download-"));
  try {
    const bytes = "verified fixture";
    const file = { name: "model.gguf", url: "https://example.test/model", sha256: createHash("sha256").update(bytes).digest("hex") };
    let calls = 0;
    const fetcher = (async () => { calls++; return new Response(bytes); }) as unknown as typeof fetch;
    const path = await downloadVerified(file, directory, fetcher);
    expect(await Bun.file(path).text()).toBe(bytes);
    await downloadVerified(file, directory, fetcher);
    expect(calls).toBe(1);
    await Bun.write(path, "corrupted");
    await expect(downloadVerified(file, directory, fetcher)).rejects.toThrow("existing");
    await expect(downloadVerified({ ...file, name: "bad.gguf" }, directory, (async () => new Response("bad")) as unknown as typeof fetch)).rejects.toThrow("verification failed");
    expect(await Bun.file(join(directory, "bad.gguf")).exists()).toBe(false);
    await expect(downloadVerified({ ...file, name: "../escape" }, directory, fetcher)).rejects.toThrow("manifest");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

