export type DirectionChoice = "auto" | "photographic" | "illustrated" | "pixel" | "abstract" | "cinematic";
export type LightingChoice = "auto" | "daylight" | "golden" | "blue-hour" | "dramatic" | "neon";
export type CompositionChoice = "auto" | "centered" | "off-center" | "minimal" | "layered";
export type PaletteChoice = "auto" | "warm" | "cool" | "dark" | "vibrant" | "earthy";

export interface OfflineWallpaperDirection {
  style?: DirectionChoice;
  lighting?: LightingChoice;
  composition?: CompositionChoice;
  palette?: PaletteChoice;
}

export const styleChoices: Array<{ name: string; value: DirectionChoice }> = [
  { name: "Auto · infer it from my sentence", value: "auto" },
  { name: "Photographic · natural detail and believable materials", value: "photographic" },
  { name: "Illustrated · painterly, graphic, or storybook", value: "illustrated" },
  { name: "Pixel art · deliberate shapes and limited pixels", value: "pixel" },
  { name: "Abstract · form, texture, color, and light", value: "abstract" },
  { name: "Cinematic · dramatic environmental concept art", value: "cinematic" }
];

export const lightingChoices: Array<{ name: string; value: LightingChoice }> = [
  { name: "Auto · match the scene", value: "auto" },
  { name: "Soft daylight · diffused and natural", value: "daylight" },
  { name: "Golden hour · warm low sun and long shadows", value: "golden" },
  { name: "Blue hour · cool dusk, moonlight, or mist", value: "blue-hour" },
  { name: "Dramatic · strong directional light and deep shadow", value: "dramatic" },
  { name: "Neon night · colored glow and reflections", value: "neon" }
];

export const compositionChoices: Array<{ name: string; value: CompositionChoice }> = [
  { name: "Auto · wide focal area with calm desktop edges", value: "auto" },
  { name: "Centered · one strong subject in the middle", value: "centered" },
  { name: "Off-center · focal subject on a third", value: "off-center" },
  { name: "Minimal · broad negative space and one quiet subject", value: "minimal" },
  { name: "Layered panorama · foreground, middle distance, horizon", value: "layered" }
];

export const paletteChoices: Array<{ name: string; value: PaletteChoice }> = [
  { name: "Auto · use colors already suggested by the scene", value: "auto" },
  { name: "Warm · amber, coral, ochre, and deep brown", value: "warm" },
  { name: "Cool · blue, teal, violet, and pale silver", value: "cool" },
  { name: "Dark · near-black, midnight tones, and one luminous accent", value: "dark" },
  { name: "Vibrant · saturated contrasts with controlled highlights", value: "vibrant" },
  { name: "Earthy · moss, clay, stone, sand, and muted copper", value: "earthy" }
];

function inferredStyle(request: string) {
  const value = request.toLowerCase();
  if (/pixel|8-bit|16-bit|game style/.test(value)) return "detailed pixel art with deliberate silhouettes and a restrained pixel grid";
  if (/photo|realistic|photoreal|camera|lens/.test(value)) return "cinematic environmental photography with believable scale and natural material detail";
  if (/illustrat|paint|gouache|watercolor|anime|comic/.test(value)) return "polished editorial illustration with tactile marks and controlled detail";
  if (/abstract|geometric|liquid|gradient|shape/.test(value)) return "premium abstract image-making with dimensional form and tactile surface detail";
  return "cinematic environmental artwork faithful to the requested subject";
}

function inferredLighting(request: string) {
  const value = request.toLowerCase();
  if (/sunset|sunrise|golden hour|dawn/.test(value)) return "warm low-angle light, long soft shadows, and a restrained luminous horizon";
  if (/night|moon|blue hour|dusk|stars?/.test(value)) return "cool blue-hour illumination with gentle atmospheric glow and deep readable shadows";
  if (/neon|cyber|city lights?/.test(value)) return "colored night glow with controlled reflections and luminous accents";
  if (/fire|flame|lava|ember/.test(value)) return "directional firelight with glowing edges, smoke depth, and dark surrounding contrast";
  if (/storm|lightning|thunder/.test(value)) return "dramatic storm light with one bright directional event and layered atmospheric depth";
  return "soft directional light with atmospheric depth and clearly separated foreground, middle distance, and background";
}

const styleText: Record<Exclude<DirectionChoice, "auto">, string> = {
  photographic: "cinematic environmental photography with believable scale and natural material detail",
  illustrated: "polished editorial illustration with tactile marks and controlled detail",
  pixel: "detailed pixel art with deliberate silhouettes and a restrained pixel grid",
  abstract: "premium abstract image-making with dimensional form and tactile surface detail",
  cinematic: "cinematic environmental concept art with convincing depth and precise material detail"
};

const lightingText: Record<Exclude<LightingChoice, "auto">, string> = {
  daylight: "soft diffused daylight with natural shadows and gentle atmospheric depth",
  golden: "warm low-angle golden-hour light with long soft shadows and luminous edges",
  "blue-hour": "cool blue-hour illumination with misty depth and deep readable shadows",
  dramatic: "strong directional light with sculpted highlights, deep shadow, and atmospheric contrast",
  neon: "colored night glow with controlled reflections and luminous accents"
};

const compositionText: Record<CompositionChoice, string> = {
  auto: "panoramic full-bleed 16:9 composition with one clear focal area, layered depth, and calm low-contrast side edges for desktop icons",
  centered: "panoramic full-bleed 16:9 composition with one strong centered subject, balanced visual weight, and calm side edges",
  "off-center": "panoramic full-bleed 16:9 composition with the focal subject placed on a third and broad calm space across the opposite side",
  minimal: "minimal full-bleed 16:9 composition with one quiet focal subject, generous breathing room, and clean low-detail edges",
  layered: "layered full-bleed 16:9 panorama with tactile foreground, strong middle-distance subject, softened horizon, and calm side edges"
};

const paletteText: Record<PaletteChoice, string> = {
  auto: "a cohesive restrained palette derived from the scene with one controlled luminous accent",
  warm: "a restrained palette of amber, coral, ochre, and deep brown",
  cool: "a restrained palette of blue, teal, violet, and pale silver",
  dark: "a near-black and midnight palette with one controlled luminous accent",
  vibrant: "a vibrant but disciplined palette with saturated contrast and controlled highlights",
  earthy: "an earthy palette of moss, clay, weathered stone, sand, and muted copper"
};

export function buildOfflineWallpaperPrompt(request: string, direction: OfflineWallpaperDirection = {}) {
  const style = direction.style && direction.style !== "auto" ? styleText[direction.style] : inferredStyle(request);
  const lighting = direction.lighting && direction.lighting !== "auto" ? lightingText[direction.lighting] : inferredLighting(request);
  const composition = compositionText[direction.composition ?? "auto"];
  const palette = paletteText[direction.palette ?? "auto"];
  return `${request.trim()}, ${style}, ${composition}, ${lighting}, ${palette}, tactile material detail, intentional areas of visual rest, polished and immersive, image only with a clean unlettered field and no border.`;
}
