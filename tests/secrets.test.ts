import { describe, expect, test } from "bun:test";
import { maskApiKey, resolveApiKeyEntry } from "../src/secrets.ts";

describe("API key masking", () => {
  test("shows only the first character and a fixed mask", () => {
    const secret = "deapi-super-secret-value";
    const masked = maskApiKey(secret);
    expect(masked).toBe("[d****************]");
    expect(masked).not.toContain(secret.slice(1));
    expect(maskApiKey("  sk-test  ")).toBe("[s****************]");
  });

  test("keeps an existing key when setup receives an empty entry", () => {
    expect(resolveApiKeyEntry("existing-secret", "")).toEqual({ action: "keep" });
    expect(resolveApiKeyEntry("existing-secret", "  new-secret  ")).toEqual({ action: "replace", value: "new-secret" });
    expect(() => resolveApiKeyEntry(null, "")).toThrow("cannot be empty");
  });
});
