import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyNextWallpaper, applyWallpaper, configureSlideshow } from "../src/slideshow.ts";

let temporary = "";
afterEach(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }); temporary = ""; });

describe("desktop slideshow", () => {
  test("registers and removes the Windows scheduled task", async () => {
    temporary = await mkdtemp(join(tmpdir(), "flux-slideshow-"));
    const calls: Array<[string, string[]]> = [];
    const run = async (file: string, args: string[]) => { calls.push([file, args]); return { stdout: "", stderr: "" }; };
    const runtime = { platform: "win32" as const, executable: "C:\\FluxGen\\flux.exe", main: "", configDir: temporary, run };
    await configureSlideshow(true, runtime);
    expect(calls[0]?.[0]).toBe("schtasks.exe");
    expect(calls[0]?.[1]).toContain("/Create");
    expect(calls[0]?.[1].join(" ")).toContain('"wallpaper" "next"');
    await configureSlideshow(false, runtime);
    expect(calls[1]?.[1]).toContain("/Delete");
  });

  test("writes a macOS LaunchAgent", async () => {
    temporary = await mkdtemp(join(tmpdir(), "flux-slideshow-"));
    const calls: Array<[string, string[]]> = [];
    const run = async (file: string, args: string[]) => { calls.push([file, args]); return { stdout: "", stderr: "" }; };
    await configureSlideshow(true, { platform: "darwin", executable: "/usr/local/bin/flux", main: "", configDir: temporary, home: temporary, uid: 502, run });
    const plist = await readFile(join(temporary, "Library", "LaunchAgents", "com.moriatz.flux-gen.slideshow.plist"), "utf8");
    expect(plist).toContain("wallpaper");
    expect(plist).toContain("1800");
    expect(calls.at(-1)?.[1]).toContain("bootstrap");
  });

  test("writes and enables a Linux user timer", async () => {
    temporary = await mkdtemp(join(tmpdir(), "flux-slideshow-"));
    const calls: Array<[string, string[]]> = [];
    const run = async (file: string, args: string[]) => { calls.push([file, args]); return { stdout: "", stderr: "" }; };
    await configureSlideshow(true, { platform: "linux", executable: "/home/test/.local/bin/flux", main: "", configDir: temporary, home: temporary, environment: { XDG_CURRENT_DESKTOP: "GNOME" }, run });
    const service = await readFile(join(temporary, ".config", "systemd", "user", "flux-gen-slideshow.service"), "utf8");
    const timer = await readFile(join(temporary, ".config", "systemd", "user", "flux-gen-slideshow.timer"), "utf8");
    expect(service).toContain("XDG_CURRENT_DESKTOP=GNOME");
    expect(timer).toContain("OnUnitActiveSec=30min");
    expect(calls.at(-1)?.[1]).toEqual(["--user", "enable", "--now", "flux-gen-slideshow.timer"]);
  });

  test("applies a wallpaper on GNOME", async () => {
    const calls: Array<[string, string[]]> = [];
    const run = async (file: string, args: string[]) => { calls.push([file, args]); return { stdout: "", stderr: "" }; };
    await applyWallpaper("/home/test/Pictures/FluxGen/sky.png", { platform: "linux", environment: { XDG_CURRENT_DESKTOP: "GNOME" }, run });
    expect(calls[0]).toEqual(["gsettings", ["set", "org.gnome.desktop.background", "picture-uri", "file:///home/test/Pictures/FluxGen/sky.png"]]);
  });

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
    temporary = await mkdtemp(join(tmpdir(), "flux-slideshow-"));
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
});
