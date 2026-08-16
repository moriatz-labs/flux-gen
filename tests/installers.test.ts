import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("installers", () => {
  test("POSIX installer verifies releases before installation", async () => {
    const source = await readFile(new URL("../website/public/install.sh", import.meta.url), "utf8");
    expect(source).toContain("checksums.txt");
    expect(source).toContain("sha256sum");
    expect(source).toContain("Linux arm64");
  });
  test("Windows installer verifies releases and updates user PATH", async () => {
    const source = await readFile(new URL("../website/public/install.ps1", import.meta.url), "utf8");
    const textEndpoint = await readFile(new URL("../website/public/install.ps1.txt", import.meta.url), "utf8");
    expect(source).toContain("Get-FileHash");
    expect(source).toContain('"Path", "User"');
    expect(source).toContain("[string]::IsNullOrWhiteSpace($userPath)");
    expect(source).toContain("[Environment]::Is64BitOperatingSystem");
    expect(source).toContain('$ProgressPreference = "SilentlyContinue"');
    expect(source).toContain('$ProgressPreference = $previousProgressPreference');
    expect(source).toContain('Write-Host "Downloading Flux for Windows..."');
    expect(source).not.toContain("RuntimeInformation");
    expect(textEndpoint.replaceAll("\r\n", "\n")).toBe(source.replaceAll("\r\n", "\n"));
  });

  test("website presents separate operating-system installers", async () => {
    const source = await readFile(new URL("../website/index.html", import.meta.url), "utf8");
    expect(source).toContain('data-tab="windows"');
    expect(source).toContain('data-tab="linux"');
    expect(source).toContain('data-tab="macos"');
    expect(source).toContain("install.ps1.txt");
  });
});
