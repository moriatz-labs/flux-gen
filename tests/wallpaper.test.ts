import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyNextWallpaper, applyWallpaper } from "../src/wallpaper.ts";

let temporary = "";
afterEach(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }); temporary = ""; });

describe("desktop wallpaper", () => {
  test("applies a Windows wallpaper without a blocking settings broadcast", async () => {
    const calls: Array<[string, string[]]> = [];
    const run = async (file: string, args: string[]) => { calls.push([file, args]); return { stdout: "", stderr: "" }; };
    const path = "C:\\Users\\test\\Pictures\\FluxGen\\sky.png";
    await applyWallpaper(path, { platform: "win32", run });
    expect(calls[0]?.[0]).toBe("powershell.exe");
    expect(calls[0]?.[1]).toContain("-EncodedCommand");
    const command = Buffer.from(calls[0]?.[1].at(-1) ?? "", "base64").toString("utf16le");
    expect(command).toContain("SystemParametersInfo(20, 0, $wallpaperPath, 1)");
    expect(command).toContain(Buffer.from(path, "utf8").toString("base64"));
    expect(calls[0]?.[1].join(" ")).not.toContain(path);
  });

  test("chooses only supported images from the folder", async () => {
    temporary = await mkdtemp(join(tmpdir(), "flux-wallpaper-"));
    await writeFile(join(temporary, "wallpaper.webp"), "image");
    await writeFile(join(temporary, "notes.txt"), "ignore");
    const calls: string[] = [];
    const selected = await applyNextWallpaper(temporary, {
      platform: "darwin",
      run: async (_file, args) => { calls.push(args.at(-1) ?? ""); return { stdout: "", stderr: "" }; }
    });
    expect(selected).toEndWith("wallpaper.webp");
    expect(calls).toContain(selected);
  });

  test("passes Linux wallpaper paths literally to Noctalia", async () => {
    const calls: Array<[string, string[]]> = [];
    const path = "/tmp/quiet sky $(touch unsafe); 'quote'.png";
    await applyWallpaper(path, { platform: "linux", run: async (file, args) => {
      calls.push([file, args]);
      return { stdout: "", stderr: "" };
    } });
    expect(calls).toEqual([["noctalia", ["msg", "wallpaper-set", path]]]);
  });

  test("explains Linux wallpaper backend failures", async () => {
    await expect(applyWallpaper("/tmp/sky.png", {
      platform: "linux", run: async () => { throw new Error("socket unavailable"); }
    })).rejects.toThrow("running Noctalia shell");
  });

  test("rejects unsupported operating systems", async () => {
    await expect(applyWallpaper("/tmp/sky.png", { platform: "freebsd" })).rejects.toThrow("not supported");
  });
});
