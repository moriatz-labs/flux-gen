import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = resolve(root, process.argv[2] ?? "website/public/flux-demo.mp4");
const frameDir = resolve(root, "website/public/wallpapers");
const inputs = [
  join(frameDir, "aurora-borealis.webp"),
  join(frameDir, "bioluminescent-sea.webp"),
  join(frameDir, "green-rainforest.webp"),
  join(frameDir, "japanese-garden.webp"),
];

const missing = inputs.filter((path) => !Bun.file(path).size);
if (missing.length) {
  throw new Error(`Missing demo wallpaper assets:\n${missing.join("\n")}`);
}

const duration = 4.2;
const fade = 0.7;
const monoFont =
  process.env.FLUX_DEMO_FONT ??
  (process.platform === "win32"
    ? "C:/Windows/Fonts/consola.ttf"
    : process.platform === "darwin"
      ? "/System/Library/Fonts/Menlo.ttc"
      : "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf");
const ffmpegFont = monoFont.replace(":", "\\:");
const filter = [
  ...inputs.map(
    (_, index) =>
      `[${index}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,` +
      `zoompan=z='min(zoom+0.0007,1.045)':d=${Math.round(duration * 30)}:s=1280x720:fps=30,` +
      `format=yuv420p,setpts=PTS-STARTPTS[v${index}]`,
  ),
  `[v0][v1]xfade=transition=fade:duration=${fade}:offset=${duration - fade}[x1]`,
  `[x1][v2]xfade=transition=fade:duration=${fade}:offset=${duration * 2 - fade * 2}[x2]`,
  `[x2][v3]xfade=transition=fade:duration=${fade}:offset=${duration * 3 - fade * 3}[gallery]`,
  `[gallery]drawbox=x=44:y=46:w=1192:h=108:color=0x111821@0.84:t=fill:enable='between(t,0,4.1)',` +
    `drawtext=fontfile='${ffmpegFont}':text='> flux aurora over a frozen mountain lake':` +
    `fontcolor=white:fontsize=28:x=72:y=78:enable='between(t,0,4.1)',` +
    `drawbox=x=44:y=636:w=1192:h=42:color=0x111821@0.72:t=fill,` +
    `drawtext=fontfile='${ffmpegFont}':text='Plain English in. Desktop wallpaper out.':` +
    `fontcolor=white:fontsize=20:x=68:y=647,` +
    `drawtext=fontfile='${ffmpegFont}':text='Saved to Pictures/FluxGen':` +
    `fontcolor=0xFFE58A:fontsize=18:x=w-tw-68:y=649,format=yuv420p[out]`,
].join(";\n");

const tempDir = resolve(root, ".tmp");
const filterPath = join(tempDir, "flux-demo-filter.txt");
await mkdir(dirname(output), { recursive: true });
await mkdir(tempDir, { recursive: true });
await writeFile(filterPath, filter, "utf8");

const args = [
  "-y",
  ...inputs.flatMap((path) => ["-loop", "1", "-t", String(duration), "-i", path]),
  "-filter_complex_script",
  filterPath,
  "-map",
  "[out]",
  "-t",
  String(duration * 4 - fade * 3),
  "-an",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "23",
  "-movflags",
  "+faststart",
  output,
];

const processResult = Bun.spawnSync(["ffmpeg", ...args], { stdout: "inherit", stderr: "inherit" });
await rm(filterPath, { force: true });

if (processResult.exitCode !== 0) {
  throw new Error(`FFmpeg exited with code ${processResult.exitCode}`);
}

console.log(`Created ${output}`);
