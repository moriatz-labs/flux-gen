import { describe, expect, test } from "bun:test";
import { friendlyHttpError } from "../src/errors.ts";
import { fetchJson, HttpError } from "../src/http.ts";

describe("HTTP errors", () => {
  test("preserves status and URL without exposing a raw auth error", async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ message: "Unauthenticated." }), { status: 401 });
    const error = await fetchJson("https://api.deapi.ai/api/v2/models", {}, fakeFetch as unknown as typeof fetch).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(HttpError);
    const httpError = error as HttpError;
    expect(httpError.status).toBe(401);
    expect(friendlyHttpError(httpError)).toContain("DEAPI authentication failed (401)");
    expect(friendlyHttpError(httpError)).not.toContain("Unauthenticated");
  });

  test("gives specific guidance for forbidden DEAPI requests", () => {
    const message = friendlyHttpError(new HttpError(403, "https://api.deapi.ai/api/v2/models", "Forbidden"));
    expect(message).toContain("denied this request (403)");
    expect(message).toContain("permissions and account credits");
  });
});
