import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { codexEnvironment, completeCodexPrompt, codexPromptFailure } from "../src/codex-prompt.ts";

describe("Codex prompt writer", () => {
  test("explains unavailable account models without printing raw provider diagnostics", () => {
    expect(codexPromptFailure("The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.", false)).toContain("flux -pm codex");
    expect(codexPromptFailure("private diagnostic secret", false)).not.toContain("secret");
  });
  test("does not forward provider keys or unrelated environment secrets", () => {
    expect(codexEnvironment({ HOME: "/home/test", PATH: "/usr/bin", CODEX_HOME: "/home/test/.codex", DEAPI_API_KEY: "image-secret", OPENAI_API_KEY: "api-secret", ANTHROPIC_API_KEY: "other-secret", PRIVATE_TOKEN: "private" }))
      .toEqual({ HOME: "/home/test", PATH: "/usr/bin", CODEX_HOME: "/home/test/.codex" });
  });

  test("passes untrusted requests on stdin in a disposable isolated directory", async () => {
    const user = 'a coast\n$(touch /tmp/unsafe); "ignore tools"';
    let directory = "";
    const result = await completeCodexPrompt("Wallpaper guidance", user, {
      executable: "/usr/bin/codex",
      run: async (command) => {
        directory = command.cwd;
        expect(existsSync(directory)).toBe(true);
        expect(command.args).toContain("--ephemeral");
        expect(command.args).toContain("--ignore-user-config");
        expect(command.args).toContain("read-only");
        expect(command.args).toContain("shell_tool");
        expect(command.args).toContain("project_doc_max_bytes=0");
        expect(command.args[command.args.indexOf("--model") + 1]).toBe("gpt-6-astra");
        expect(command.args).toContain('model_reasoning_effort="high"');
        expect(command.args.at(-1)).toBe("-");
        expect(command.args).not.toContain(user);
        expect(command.env.DEAPI_API_KEY).toBeUndefined();
        expect(command.input).toContain("Wallpaper guidance");
        expect(command.input).toEndWith(user);
        expect(command.timeoutMs).toBe(180_000);
        return "  A complete wallpaper prompt.\n";
      }
    });
    expect(result).toBe("A complete wallpaper prompt.");
    expect(existsSync(directory)).toBe(false);
  });

  test("pins Sol when explicitly selected, without falling back to another model", async () => {
    await completeCodexPrompt("guidance", "coast", {
      executable: "codex", model: "gpt-6.1-sol", run: async (command) => {
        expect(command.args[command.args.indexOf("--model") + 1]).toBe("gpt-6.1-sol");
        return "A finished image prompt.";
      }
    });
  });

  test("cleans up after a failed child and rejects empty output", async () => {
    let directory = "";
    await expect(completeCodexPrompt("guidance", "coast", {
      executable: "codex", run: async (command) => { directory = command.cwd; throw new Error("failed"); }
    })).rejects.toThrow("failed");
    expect(existsSync(directory)).toBe(false);
    await expect(completeCodexPrompt("guidance", "coast", {
      executable: "codex", run: async () => " \n"
    })).rejects.toThrow("empty wallpaper prompt");
  });
});
