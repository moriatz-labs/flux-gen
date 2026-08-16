import { describe, expect, test } from "bun:test";
import { checkForUpdate, compareVersions } from "../src/update.ts";

describe("updates", () => {
  test("compares release versions numerically", () => {
    expect(compareVersions("v0.7.0", "0.6.1")).toBe(1);
    expect(compareVersions("0.6.1", "v0.6.1")).toBe(0);
    expect(compareVersions("0.6.1", "0.7.0")).toBe(-1);
  });

  test("detects a newer GitHub release", async () => {
    const fakeFetch = async () => Response.json({ tag_name: "v99.0.0" });
    const update = await checkForUpdate(fakeFetch as unknown as typeof fetch);
    expect(update.available).toBe(true);
    expect(update.latest).toBe("99.0.0");
  });
});
