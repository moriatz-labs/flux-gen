import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { connectPaper, parseMcpResponse, paperEndpoint, type PaperClient, type PaperReply } from "../src/paper-mcp.ts";
import { paperImageHtml, pngDimensions, queuePaperImage, syncPaper, type PaperSettings } from "../src/paper.ts";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });
const settings: PaperSettings = { fileId: "archive-file", pageId: "p-1-0", dailyPageId: "p-2-0", endpoint: "http://127.0.0.1:29979/mcp", sources: [] };
async function fixture() {
  root = await mkdtemp(join(tmpdir(), "flux-paper-"));
  const data = Buffer.alloc(40);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data);
  data.write("IHDR", 12); data.writeUInt32BE(1672, 16); data.writeUInt32BE(941, 20);
  const path = join(root, 'forest & "moon".png');
  await writeFile(path, data);
  return { path, data, state: join(root, "state") };
}
function mockPaper() {
  const boards: Array<{ id: string; name: string; width: number; height: number; worldX: number; worldY: number; pageId: string; children: number }> = [];
  const calls: string[] = [], html: string[] = [];
  let lostWrite = false, wrongFile = false;
  const client: PaperClient = {
    async call(name, args): Promise<PaperReply> {
      calls.push(name);
      if (name === "get_basic_info") return { file: { id: wrongFile ? "unrelated-file" : args.fileId }, pageId: args.pageId, artboards: boards.filter(board => board.pageId === args.pageId) };
      if (name === "create_artboard") {
        const styles = args.styles as Record<string, string>;
        const board = { id: String(boards.length + 1), name: String(args.name), width: parseInt(styles.width!), height: parseInt(styles.height!), worldX: 0, worldY: 0, pageId: String(args.pageId), children: 0 };
        boards.push(board); return board;
      }
      if (name === "get_children") return { count: boards.find(board => board.id === args.nodeId)!.children };
      if (name === "write_html") {
        boards.find(board => board.id === args.targetNodeId)!.children++;
        html.push(String(args.html));
        if (lostWrite) { lostWrite = false; throw new Error("connection lost after image was stored"); }
      }
      return {};
    },
    async close() {}
  };
  return { client, boards, calls, html, loseWrite() { lostWrite = true; }, wrongFile() { wrongFile = true; } };
}

describe("Paper image archive", () => {
  test("queues offline pixels, survives source deletion, stores once and removes only the pending copy", async () => {
    const { path, state } = await fixture(), paper = mockPaper();
    const hash = await queuePaperImage(path, settings, state);
    await expect(syncPaper(settings, { stateDirectory: state, connect: async () => { throw new Error("Paper closed"); } })).rejects.toThrow("Paper closed");
    expect(await readdir(state)).toContain(`${hash}.png`);
    await rm(path);
    const options = { stateDirectory: state, connect: async () => paper.client };
    expect(await syncPaper(settings, options)).toEqual({ imported: 1, total: 1, pending: 0 });
    expect(await readdir(state)).toEqual([`${hash}.json`]);
    expect(JSON.parse(await readFile(join(state, `${hash}.json`), "utf8")).importedAt).toBeTruthy();
    expect(await syncPaper(settings, options)).toEqual({ imported: 0, total: 1, pending: 0 });
    expect(paper.boards).toHaveLength(1);
    expect(paper.calls.slice(0, 3)).toEqual(["get_guide", "get_basic_info", "get_selection"]);
    expect(paper.html[0]).toContain(`paper-asset://${state}/${hash}.png`);
  });
  test("deduplicates copied PNGs and resumes a lost acknowledgement without duplicate nodes", async () => {
    const { path, data, state } = await fixture(), paper = mockPaper();
    const duplicate = join(root, "duplicate.png"); await writeFile(duplicate, data);
    expect(await queuePaperImage(path, settings, state)).toBe(await queuePaperImage(duplicate, settings, state));
    paper.loseWrite();
    const options = { stateDirectory: state, connect: async () => paper.client };
    await expect(syncPaper(settings, options)).rejects.toThrow("connection lost");
    expect((await syncPaper(settings, options)).imported).toBe(1);
    expect(paper.boards).toHaveLength(1); expect(paper.html).toHaveLength(1);
  });
  test("keeps original dimensions, routes daily images and skips verification screenshots", async () => {
    const { path, data, state } = await fixture(), paper = mockPaper();
    const second = join(root, "second.png"), third = join(root, "daily.png");
    data[39] = 1; await writeFile(second, data); data[39] = 2; await writeFile(third, data);
    await queuePaperImage(path, settings, state); await queuePaperImage(second, settings, state);
    await queuePaperImage(third, settings, state, settings.dailyPageId);
    await syncPaper(settings, { stateDirectory: state, connect: async () => paper.client });
    const ordinary = paper.boards.filter(board => board.pageId === settings.pageId);
    expect(ordinary.map(board => [board.width, board.height])).toEqual([[1672, 941], [1672, 941]]);
    expect(paper.boards.filter(board => board.pageId === settings.dailyPageId)).toHaveLength(1);
    // The source scan excludes QA screenshots while discovering new original pixels.
    await rm(state, { recursive: true });
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(root, "verification")); data[39] = 3; await writeFile(join(root, "verification", "screenshot.png"), data);
    const result = await syncPaper({ ...settings, sources: [{ directory: root }] }, { stateDirectory: join(root, "new-state"), connect: async () => paper.client });
    expect(result.total).toBe(3);
  });
  test("stops before mutation when Paper returns an unrelated file", async () => {
    const { path, state } = await fixture(), paper = mockPaper();
    await queuePaperImage(path, settings, state); paper.wrongFile();
    await expect(syncPaper(settings, { stateDirectory: state, connect: async () => paper.client })).rejects.toThrow("different file");
    expect(paper.boards).toHaveLength(0);
  });
  test("validates PNG dimensions, escapes paths and rejects remote MCP destinations", () => {
    expect(() => pngDimensions(Buffer.from("invalid"))).toThrow("PNG");
    expect(paperImageHtml('/tmp/forest & "moon".png', { width: 1672, height: 941 })).toContain('paper-asset:///tmp/forest &amp; &quot;moon&quot;.png');
    expect(() => paperEndpoint("https://example.com/mcp")).toThrow("local");
    expect(() => paperEndpoint("http://127.0.0.1:29979/mcp?secret=yes")).toThrow("local");
    expect(paperEndpoint(settings.endpoint)).toBe(settings.endpoint);
  });
});

describe("Paper MCP transport", () => {
  test("handles SSE messages, session headers, initialization, and tool errors", async () => {
    const requests: Array<{ method: string; session: string | null }> = [];
    const fetcher = (async (_url: unknown, init: RequestInit) => {
      if (init.method === "DELETE") return new Response(null, { status: 204 });
      const request = JSON.parse(String(init.body));
      requests.push({ method: request.method, session: new Headers(init.headers).get("Mcp-Session-Id") });
      if (request.method === "notifications/initialized") return new Response(null, { status: 202 });
      const result = request.method === "initialize" ? { protocolVersion: "2025-03-26" } : request.params.name === "fail" ? { isError: true, content: [{ type: "text", text: "Page unavailable" }] } : { content: [{ type: "text", text: JSON.stringify({ file: { id: "archive-file" } }) }, { type: "text", text: JSON.stringify({ id: "board" }) }] };
      return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n\n`, { headers: { "mcp-session-id": "local-session" } });
    }) as typeof fetch;
    const client = await connectPaper(settings.endpoint, fetcher);
    expect(await client.call("create_artboard", {})).toEqual({ file: { id: "archive-file" }, id: "board" });
    await expect(client.call("fail", {})).rejects.toThrow("Page unavailable");
    expect(requests[0]?.session).toBeNull();
    expect(requests.slice(1).every(request => request.session === "local-session")).toBe(true);
    expect(requests.map(request => request.method).slice(0, 3)).toEqual(["initialize", "notifications/initialized", "tools/call"]);
    await client.close();
    expect(parseMcpResponse('{"id":8,"result":{"ok":true}}', 8).result).toEqual({ ok: true });
  });
});
