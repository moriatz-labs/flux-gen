import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
// TypeScript does not resolve arbitrary Markdown imports; Bun embeds these as text in the executable.
// @ts-expect-error Bun text import
import foundation from "../skills/wallpaper-foundation/SKILL.md" with { type: "text" };
// @ts-expect-error Bun text import
import composition from "../skills/wallpaper-composition/SKILL.md" with { type: "text" };
// @ts-expect-error Bun text import
import lighting from "../skills/cinematic-lighting/SKILL.md" with { type: "text" };
// @ts-expect-error Bun text import
import photography from "../skills/photographic-wallpaper/SKILL.md" with { type: "text" };
// @ts-expect-error Bun text import
import illustration from "../skills/illustrated-wallpaper/SKILL.md" with { type: "text" };
// @ts-expect-error Bun text import
import abstract from "../skills/abstract-wallpaper/SKILL.md" with { type: "text" };
// @ts-expect-error Bun text import
import environment from "../skills/environment-wallpaper/SKILL.md" with { type: "text" };
// @ts-expect-error Bun text import
import color from "../skills/color-direction/SKILL.md" with { type: "text" };
import { personalSkillsDirectory, projectSkillsDirectory } from "./paths.ts";
import type { SkillCatalogue, SkillSource, WallpaperSkill } from "./types.ts";

const bundledSources = [foundation, composition, lighting, photography, illustration, abstract, environment, color];

export function parseSkill(source: string, origin: SkillSource, path?: string): WallpaperSkill {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) throw new Error("SKILL.md must begin with YAML frontmatter.");
  const metadata = parse(match[1]!) as { name?: unknown; description?: unknown };
  const name = typeof metadata.name === "string" ? metadata.name.trim() : "";
  const description = typeof metadata.description === "string" ? metadata.description.trim() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    throw new Error("Skill name must be 1–64 lowercase letters, numbers, or hyphens.");
  }
  if (!description || description.length > 1024) {
    throw new Error("Skill description must be 1–1024 characters.");
  }
  const instructions = match[2]!.trim();
  if (!instructions) throw new Error("Skill instructions cannot be empty.");
  return { name, description, instructions, source: origin, path };
}

async function readSkillDirectory(directory: string, source: Exclude<SkillSource, "bundled">) {
  const skills: WallpaperSkill[] = [];
  const warnings: SkillCatalogue["warnings"] = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { skills, warnings };
    warnings.push({ path: directory, message: (error as Error).message });
    return { skills, warnings };
  }
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const path = join(directory, entry.name, "SKILL.md");
    try {
      const file = await readFile(path, "utf8");
      if (Buffer.byteLength(file) > 64 * 1024) throw new Error("SKILL.md exceeds the 64 KiB safety limit.");
      skills.push(parseSkill(file, source, path));
    } catch (error) {
      warnings.push({ path, message: (error as Error).message });
    }
  }
  return { skills, warnings };
}

export async function discoverSkills(cwd = process.cwd()): Promise<SkillCatalogue> {
  const byName = new Map<string, WallpaperSkill>();
  const warnings: SkillCatalogue["warnings"] = [];
  for (const source of bundledSources) {
    const skill = parseSkill(source, "bundled");
    byName.set(skill.name, skill);
  }
  for (const [directory, source] of [
    [personalSkillsDirectory(), "personal"],
    [projectSkillsDirectory(cwd), "project"]
  ] as const) {
    const result = await readSkillDirectory(directory, source);
    warnings.push(...result.warnings);
    for (const skill of result.skills) byName.set(skill.name, skill);
  }
  return { skills: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)), warnings };
}
