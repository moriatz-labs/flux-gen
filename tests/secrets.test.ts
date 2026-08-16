import { describe, expect, test } from "bun:test";
import { getApiKeyDetails, maskApiKey, resolveApiKeyEntry } from "../src/secrets.ts";

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

  test("reports when an environment key overrides the keychain", async () => {
    const previous = process.env.DEAPI_API_KEY;
    process.env.DEAPI_API_KEY = "environment-secret";
    try {
      expect(await getApiKeyDetails("deapi")).toEqual({ value: "environment-secret", source: "environment" });
    } finally {
      if (previous === undefined) delete process.env.DEAPI_API_KEY;
      else process.env.DEAPI_API_KEY = previous;
    }
  });
});
