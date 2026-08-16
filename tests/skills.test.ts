import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverSkills, parseSkill } from "../src/skills.ts";

let temporary = "";
afterEach(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }); temporary = ""; });

describe("skills", () => {
  test("parses the Agent Skills frontmatter contract", () => {
    const skill = parseSkill("---\nname: calm-space\ndescription: Keeps space calm.\n---\n\nDo the thing.", "project", "SKILL.md");
    expect(skill.name).toBe("calm-space");
    expect(skill.instructions).toContain("Do the thing");
  });

  test("rejects invalid metadata", () => {
    expect(() => parseSkill("---\nname: Bad Name\ndescription: no\n---\nbody", "project")).toThrow("Skill name");
  });

  test("project skills override bundled skills by name", async () => {
    temporary = await mkdtemp(join(tmpdir(), "flux-skills-"));
    const directory = join(temporary, ".flux", "skills", "wallpaper-foundation");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "SKILL.md"), "---\nname: wallpaper-foundation\ndescription: Local foundation.\n---\n\nUse the local version.");
    const catalogue = await discoverSkills(temporary);
    const foundation = catalogue.skills.find((skill) => skill.name === "wallpaper-foundation");
    expect(foundation?.source).toBe("project");
    expect(foundation?.instructions).toContain("local version");
  });

  test("bundles the vivid wallpaper art-direction recipe", async () => {
    temporary = await mkdtemp(join(tmpdir(), "flux-skills-"));
    const catalogue = await discoverSkills(temporary);
    const skill = catalogue.skills.find((candidate) => candidate.name === "wallpaper-art-direction");
    expect(skill?.source).toBe("bundled");
    expect(skill?.instructions).toContain("Lower-capability model guardrails");
    expect(skill?.instructions).toContain("midnight blue, ultraviolet");
  });
});
