import { describe, expect, test } from "bun:test";
import { runGenerationLoop } from "../src/cli.ts";

describe("interactive generation", () => {
  test("offers another wallpaper after each successful generation", async () => {
    const generated: string[] = [];
    const answers = [true, false];
    await runGenerationLoop("first wallpaper", {
      interactive: true,
      generate: async (description) => { generated.push(description); },
      askAgain: async () => answers.shift() ?? false,
      askDescription: async () => "second wallpaper"
    });
    expect(generated).toEqual(["first wallpaper", "second wallpaper"]);
  });

  test("generates once outside an interactive terminal", async () => {
    const generated: string[] = [];
    let prompted = false;
    await runGenerationLoop("one wallpaper", {
      interactive: false,
      generate: async (description) => { generated.push(description); },
      askAgain: async () => { prompted = true; return true; }
    });
    expect(generated).toEqual(["one wallpaper"]);
    expect(prompted).toBe(false);
  });
});
