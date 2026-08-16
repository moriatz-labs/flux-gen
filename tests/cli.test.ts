import { describe, expect, test } from "bun:test";
import { offerDeapiKeyRecovery, runGenerationLoop } from "../src/cli.ts";
import { HttpError } from "../src/http.ts";

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

describe("DEAPI key recovery", () => {
  test("offers secure reconfiguration after an interactive auth failure", async () => {
    let reconfigured = false;
    const recovered = await offerDeapiKeyRecovery(
      new HttpError(401, "https://api.deapi.ai/api/v2/models", "Unauthenticated"),
      { interactive: true, ask: async () => true, reconfigure: async () => { reconfigured = true; }, onSuccess: () => {} }
    );
    expect(recovered).toBe(true);
    expect(reconfigured).toBe(true);
  });

  test("does not prompt in automation", async () => {
    let asked = false;
    const recovered = await offerDeapiKeyRecovery(
      new HttpError(403, "https://api.deapi.ai/api/v2/models", "Forbidden"),
      { interactive: false, ask: async () => { asked = true; return true; } }
    );
    expect(recovered).toBe(false);
    expect(asked).toBe(false);
  });
});
