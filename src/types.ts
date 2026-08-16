export const promptModelIds = ["gpt-5.6-luna", "gemini-3.6-flash", "claude-sonnet-5"] as const;
export type PromptModelId = (typeof promptModelIds)[number];
export type ProviderId = "deapi" | "openai" | "google" | "anthropic";
export type SkillSource = "bundled" | "personal" | "project";
export type UpdateMode = "off" | "notify" | "automatic";

export interface FluxConfig {
  enhancement: boolean;
  applyWallpaper: boolean;
  promptModel: PromptModelId;
  imageModel: string;
  outputDirectory: string;
  updateMode: UpdateMode;
  lastUpdateCheck?: string;
}

export interface WallpaperSkill {
  name: string;
  description: string;
  instructions: string;
  source: SkillSource;
  path?: string;
}

export interface SkillWarning { path: string; message: string; }
export interface SkillCatalogue { skills: WallpaperSkill[]; warnings: SkillWarning[]; }

export interface DeapiModel {
  name: string;
  slug: string;
  inference_types?: unknown;
  info?: { limits?: Record<string, number>; defaults?: Record<string, unknown>; };
}
