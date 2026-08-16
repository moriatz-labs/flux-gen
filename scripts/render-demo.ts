import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = resolve(root, process.argv[2] ?? "website/public/flux-demo.mp4");
const gallery = resolve(root, "website/public/wallpapers/gallery");
const inputs = [
  join(gallery, "violet-lightning.webp"),
  join(gallery, "violet-lightning.webp"),
  join(gallery, "lava-meets-ice.webp"),
  join(gallery, "moss-temple.webp"),
  join(gallery, "purple-petals.webp"),
];

const missing = inputs.filter((path) => !Bun.file(path).size);
if (missing.length) throw new Error(`Missing demo wallpaper assets:\n${missing.join("\n")}`);

const monoFont = process.env.FLUX_DEMO_FONT ?? (process.platform === "win32"
  ? "C:/Windows/Fonts/consola.ttf"
  : process.platform === "darwin"
    ? "/System/Library/Fonts/Menlo.ttc"
    : "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf");
const font = monoFont.replace(":", "\\:");
const terminalEnd = 12.2;
const fade = 0.8;

function escapeText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'").replaceAll("%", "\\%");
}

function typedLine(text: string, y: number, start: number, speed = 0.055, color = "white") {
  const filters: string[] = [];
  for (let length = 1; length <= text.length; length++) {
    const from = start + (length - 1) * speed;
    const to = length === text.length ? terminalEnd : start + length * speed;
    filters.push(`drawtext=fontfile='${font}':text='${escapeText(text.slice(0, length))}':fontcolor=${color}:fontsize=25:x=102:y=${y}:enable='between(t,${from.toFixed(3)},${to.toFixed(3)})'`);
  }
  return filters;
}

const terminalLines = [
  ...typedLine("> flux setup", 112, 0.55, 0.075, "0xFFE58A"),
  ...typedLine("DEAPI key     ****************", 173, 1.65, 0.035, "0x78A9FF"),
  ...typedLine("Prompt model  GPT-5.6 Luna", 218, 2.95, 0.035),
  ...typedLine("Image model   Flux 2 Klein", 263, 4.05, 0.035),
  ...typedLine("Wallpaper     Apply immediately", 308, 5.15, 0.035),
  ...typedLine("Setup complete.", 369, 6.35, 0.055, "0xA7E8A0"),
  ...typedLine("> flux a violet storm over a silent canyon", 445, 7.15, 0.045, "0xFFE58A"),
  ...typedLine("Enhancing prompt...", 506, 9.15, 0.04),
  ...typedLine("Rendering complete", 551, 10.05, 0.04),
  ...typedLine("Saved to Pictures/FluxGen", 596, 10.85, 0.025, "0x78A9FF"),
];

const imageDuration = 5;
const filter = [
  `[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30,boxblur=14:2,eq=brightness=-0.4:saturation=0.75,format=yuv420p,setpts=PTS-STARTPTS,` +
    `drawbox=x=54:y=42:w=1172:h=636:color=0x0B1118@0.92:t=fill,` +
    `drawbox=x=54:y=42:w=1172:h=48:color=0x202B36@0.98:t=fill,` +
    `drawtext=fontfile='${font}':text='FLUX SETUP':fontcolor=0xB8C3CE:fontsize=16:x=102:y=59,` +
    terminalLines.join(",") + `[terminal]`,
  ...inputs.slice(1).map((_, index) =>
    `[${index + 1}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,` +
    `zoompan=z='min(zoom+0.00055,1.035)':d=${imageDuration * 30}:s=1280x720:fps=30,format=yuv420p,setpts=PTS-STARTPTS[v${index + 1}]`,
  ),
  `[terminal][v1]xfade=transition=fade:duration=${fade}:offset=${terminalEnd - fade}[x1]`,
  `[x1][v2]xfade=transition=fade:duration=${fade}:offset=${terminalEnd + imageDuration - fade * 2}[x2]`,
  `[x2][v3]xfade=transition=fade:duration=${fade}:offset=${terminalEnd + imageDuration * 2 - fade * 3}[x3]`,
  `[x3][v4]xfade=transition=fade:duration=${fade}:offset=${terminalEnd + imageDuration * 3 - fade * 4},` +
    `drawbox=x=68:y=614:w=1144:h=58:color=0x0B1118@0.78:t=fill:enable='between(t,11.7,15.9)',` +
    `drawtext=fontfile='${font}':text='Applied as desktop wallpaper.':fontcolor=0xFFE58A:fontsize=22:x=94:y=632:enable='between(t,11.7,15.9)',` +
    `drawtext=fontfile='${font}':text='Pictures/FluxGen':fontcolor=white:fontsize=18:x=w-tw-94:y=635:enable='between(t,11.7,15.9)',format=yuv420p[out]`,
].join(";\n");

const tempDir = resolve(root, ".tmp");
const filterPath = join(tempDir, "flux-demo-filter.txt");
await mkdir(dirname(output), { recursive: true });
await mkdir(tempDir, { recursive: true });
await writeFile(filterPath, filter, "utf8");

const args = [
  "-y",
  "-loop", "1", "-t", String(terminalEnd), "-i", inputs[0]!,
  ...inputs.slice(1).flatMap((path) => ["-loop", "1", "-t", String(imageDuration), "-i", path]),
  "-filter_complex_script", filterPath,
  "-map", "[out]",
  "-t", String(terminalEnd + imageDuration * 4 - fade * 4),
  "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-movflags", "+faststart",
  output,
];

const result = Bun.spawnSync(["ffmpeg", ...args], { stdout: "inherit", stderr: "inherit" });
await rm(filterPath, { force: true });
if (result.exitCode !== 0) throw new Error(`FFmpeg exited with code ${result.exitCode}`);
console.log(`Created ${output}`);
