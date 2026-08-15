import { describe, expect, test } from "bun:test";
import { listImageModels, submitImage, waitForImage } from "../src/deapi.ts";

describe("DEAPI", () => {
  test("paginates text-to-image models", async () => {
    const fakeFetch = async (input: string | URL | Request) => {
      const page = new URL(String(input)).searchParams.get("page");
      return Response.json(page === "1"
        ? { data: [{ name: "B", slug: "b" }], meta: { current_page: 1, last_page: 2 } }
        : { data: [{ name: "A", slug: "a" }], meta: { current_page: 2, last_page: 2 } });
    };
    expect((await listImageModels("secret", fakeFetch as typeof fetch)).map((model) => model.slug)).toEqual(["a", "b"]);
  });

  test("submits and polls a generation", async () => {
    let calls = 0;
    const fakeFetch = async () => {
      calls += 1;
      return Response.json(calls === 1 ? { data: { request_id: "job-1" } } : { data: { result_url: "https://images.test/result.png" } });
    };
    const requestId = await submitImage({ apiKey: "secret", prompt: "a lake", model: "flux", fetchImplementation: fakeFetch as unknown as typeof fetch });
    const url = await waitForImage({ apiKey: "secret", requestId, fetchImplementation: fakeFetch as unknown as typeof fetch, pollIntervalMs: 0 });
    expect(requestId).toBe("job-1");
    expect(url).toBe("https://images.test/result.png");
  });
});
