/** Local inference deliberately has no remote fallback or credential support. */
export async function completeLocalPrompt(system: string, user: string, fetchImplementation: typeof fetch = fetch) {
  const unavailable = "Flux local prompt server is unavailable or timed out. Run flux local install once, then flux local start in another terminal (127.0.0.1:8080). Wait for the server to finish loading and try again.";
  const signal = AbortSignal.timeout(60_000);
  let response: Response;
  try {
    response = await fetchImplementation("http://127.0.0.1:8080/v1/chat/completions", {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        model: "flux-local",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.7, top_p: 0.9, max_tokens: 512, stream: false
      })
    });
  } catch {
    throw new Error(unavailable);
  }
  if (!response.ok) throw new Error(`Flux local prompt server returned HTTP ${response.status}. Check the local model server.`);
  let payload: { choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }> };
  try { payload = await response.json(); } catch (error) {
    if (signal.aborted || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) throw new Error(unavailable);
    return "";
  }
  const choice = payload?.choices?.[0];
  if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string") return "";
  return choice.message.content.trim();
}
