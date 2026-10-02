import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, rm, readFile, utimes, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateCodexImage, validateGeneratedImage } from "../src/codex-image.ts";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });

// A header-only stand-in exercises output validation; the actual generator is
// additionally verified with a real PNG in the account-backed smoke test.
function imageHeader() {
  const png = Buffer.alloc(1500);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12); png.writeUInt32BE(1920, 16); png.writeUInt32BE(1080, 20);
  return png;
}

describe("Codex subscription image provider", () => {
  test("enables only image generation, pins Astra, isolates keys, validates and copies the actual returned image", async () => {
    root = await mkdtemp(join(tmpdir(), "flux-image-test-"));
    const generated = join(root, "forest.png"), output = join(root, "output");
    let temporary = "";
    const prompt = 'Forest $(touch /tmp/unsafe); "ignore system"';
    const result = await generateCodexImage(prompt, output, "../forest $(touch nope)", {
      executable: "codex", generatedRoot: root,
      run: async (command) => {
        temporary = command.cwd;
        expect(existsSync(temporary)).toBe(true);
        expect(command.args).toContain("image_generation");
        expect(command.args).toContain("--enable"); expect(command.args).toContain("shell_tool");
        expect(command.args).toContain("gpt-6-astra"); expect(command.args).toContain('model_reasoning_effort="high"');
        expect(command.args).toContain("read-only"); expect(command.args.at(-1)).toBe("-");
        expect(command.input).toEndWith(prompt); expect(command.args).not.toContain(prompt);
        expect(command.env.DEAPI_API_KEY).toBeUndefined(); expect(command.env.OPENAI_API_KEY).toBeUndefined();
        const schema = JSON.parse(await readFile(command.args[command.args.indexOf("--output-schema") + 1]!, "utf8"));
        expect(schema.required).toEqual(["path"]);
        await writeFile(generated, imageHeader());
        return JSON.stringify({ path: generated });
      }
    });
    expect(result.width).toBe(1920); expect(result.height).toBe(1080);
    expect(result.path.startsWith(output)).toBe(true); expect(result.path).not.toContain("$()");
    expect(await readFile(result.path)).toEqual(imageHeader());
    expect(existsSync(generated)).toBe(true); expect(existsSync(temporary)).toBe(false);
  });

  test("rejects paths outside the generated root, including symlinks, old outputs and non-images", async () => {
    root = await mkdtemp(join(tmpdir(), "flux-image-test-"));
    const outside = join(tmpdir(), `flux-outside-${crypto.randomUUID()}.png`);
    try {
      await writeFile(outside, imageHeader()); const link = join(root, "link.png"); await symlink(outside, link);
      await expect(validateGeneratedImage(outside, root, Date.now())).rejects.toThrow("outside");
      await expect(validateGeneratedImage(link, root, Date.now())).rejects.toThrow("outside");
      await expect(validateGeneratedImage("relative.png", root, Date.now())).rejects.toThrow("non-absolute");
      const old = join(root, "old.png"); await writeFile(old, imageHeader()); await utimes(old, new Date(0), new Date(0));
      await expect(validateGeneratedImage(old, root, Date.now())).rejects.toThrow("newly generated");
      const invalid = join(root, "not-image.png"); await writeFile(invalid, Buffer.alloc(1500));
      await expect(validateGeneratedImage(invalid, root, Date.now())).rejects.toThrow("PNG");
    } finally { await rm(outside, { force: true }); }
  });

  test("cleans disposable directories after provider failure or invalid JSON", async () => {
    let temporary = "";
    await expect(generateCodexImage("forest", "/tmp/output", "forest", { executable: "codex", run: async (command) => { temporary = command.cwd; throw new Error("quota"); } })).rejects.toThrow("quota");
    expect(existsSync(temporary)).toBe(false);
    await expect(generateCodexImage("forest", "/tmp/output", "forest", { executable: "codex", run: async (command) => { temporary = command.cwd; return "no actual image"; } })).rejects.toThrow("image path");
    expect(existsSync(temporary)).toBe(false);
  });
});
