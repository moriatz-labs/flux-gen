export interface PaperReply { [key: string]: unknown; }
export interface PaperClient {
  call(name: string, args: Record<string, unknown>): Promise<PaperReply>;
  close(): Promise<void>;
}

// Paper's desktop MCP imports local files; keep this adapter on the local machine.
export function paperEndpoint(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/mcp" || url.search || url.hash) {
    throw new Error("Paper must use a local HTTP /mcp endpoint.");
  }
  return url.href;
}

export function parseMcpResponse(body: string, id: number): { result?: unknown; error?: { message: string } } {
  const messages = body.trim().startsWith("{") ? [body] : body.split(/\r?\n\r?\n/).flatMap((event) => {
    const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    return data ? [data] : [];
  });
  for (const message of messages) {
    const parsed = JSON.parse(message) as { id?: number; result?: unknown; error?: { message: string } };
    if (parsed.id === id) return parsed;
  }
  throw new Error("Paper returned no matching MCP response.");
}

export async function connectPaper(endpoint: string, fetcher: typeof fetch = fetch): Promise<PaperClient> {
  const url = paperEndpoint(endpoint);
  let id = 0, session = "";
  const headers = () => ({ "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-03-26", ...(session ? { "Mcp-Session-Id": session } : {}) });
  const request = async (method: string, params?: unknown, notification = false): Promise<unknown> => {
    const requestId = ++id;
    const response = await fetcher(url, { method: "POST", headers: headers(), body: JSON.stringify({ jsonrpc: "2.0", ...(notification ? {} : { id: requestId }), method, params }), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Paper MCP returned HTTP ${response.status}.`);
    session = response.headers.get("mcp-session-id") ?? session;
    const body = await response.text();
    if (notification) return;
    const message = parseMcpResponse(body, requestId);
    if (message.error) throw new Error(message.error.message);
    return message.result;
  };
  await request("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "fluxgen-paper", version: "1.0.0" } });
  await request("notifications/initialized", undefined, true);
  return {
    async call(name, args) {
      const result = await request("tools/call", { name, arguments: args }) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
      if (result.isError) throw new Error(result.content?.map((part) => part.text ?? "").join("\n") || `Paper ${name} failed.`);
      const data: PaperReply = {};
      for (const part of result.content ?? []) {
        if (part.type === "text" && part.text?.trim().startsWith("{")) Object.assign(data, JSON.parse(part.text));
      }
      return data;
    },
    async close() {
      try { await fetcher(url, { method: "DELETE", headers: headers(), signal: AbortSignal.timeout(2_000) }); } catch { /* Session cleanup must not invalidate a saved image. */ }
    }
  };
}
