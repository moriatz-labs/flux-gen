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
    expect(source).toContain("Get-FileHash");
    expect(source).toContain('"Path", "User"');
  });
});
