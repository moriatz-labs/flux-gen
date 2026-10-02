type ElementTheme = "fire" | "earth" | "lightning" | "energy" | "water" | "air";
const features = (element: ElementTheme, variants: Array<[string, string]>) => variants.map(([id, description]) => ({ id, element, description }));

export const forestProfile = {
  id: "elemental-forest-v3",
  title: "Elemental enchanted forests",
  description: "Avatar-inspired elemental forest landscapes using the immersive composition of moonlit and golden forests. Fire, earth, yellow lightning, purple energy, water and air shape light and one elemental phenomenon. No fern or moss motifs, oversized plants, or characters. Persistent art direction, not fine-tuned weights.",
  palettes: [
    { id: "fire-amber", element: "fire" as const, name: "Amber fire", colors: "amber-orange elemental fire, golden reflections and deep blue woodland shadows", light: "soft amber firelight against a dark blue dusk" },
    { id: "earth-ochre", element: "earth" as const, name: "Ochre earth", colors: "ochre rock, warm earthen gold and dark forest-green canopy", light: "low golden sunlight grazing rugged stone and ancient bark" },
    { id: "lightning-gold", element: "lightning" as const, name: "Golden lightning", colors: "brilliant golden-yellow lightning, warm amber reflections and deep sapphire woodland shadows", light: "golden lightning illuminating delicate dusk mist" },
    { id: "energy-violet", element: "energy" as const, name: "Violet energy", colors: "luminous violet-purple energy, soft lavender mist and midnight blue woodland", light: "restrained violet elemental radiance reflected on water and ancient bark" },
    { id: "water-cyan", element: "water" as const, name: "Turquoise water", colors: "luminous turquoise water, silver light and deep emerald woodland shadows", light: "cool silver moonbeams and subtle turquoise water glow" },
    { id: "air-ivory", element: "air" as const, name: "Ivory air", colors: "pearl-white air currents, soft champagne highlights and slate-blue woodland shadows", light: "diffuse silver light tracing fine suspended mist" },
    { id: "fire-crimson", element: "fire" as const, name: "Crimson fire", colors: "crimson-red elemental fire, copper reflections and dark indigo woodland", light: "warm crimson firelight glowing gently through evening haze" },
    { id: "earth-jade", element: "earth" as const, name: "Jade earth", colors: "jade-green mineral light, muted bronze rock and dark natural woodland", light: "subtle jade radiance grazing weathered rock under a soft moon" },
    { id: "lightning-lemon", element: "lightning" as const, name: "Lemon lightning", colors: "electric lemon-yellow and pale gold lightning, cool steel-blue woodland shadows", light: "a delicate yellow-white lightning flash reflected in the river" },
    { id: "energy-amethyst", element: "energy" as const, name: "Amethyst energy", colors: "deep amethyst-purple energy, magenta reflections and midnight forest shadows", light: "soft amethyst radiance illuminating ribbons of evening mist" },
    { id: "water-azure", element: "water" as const, name: "Azure water", colors: "azure-blue elemental water, pearl-white highlights and dark teal woodland", light: "blue moonlight and luminous ripples reflected on exposed roots" },
    { id: "air-saffron", element: "air" as const, name: "Saffron air", colors: "soft saffron-gold air currents, cream mist and deep blue-green woodland shadows", light: "warm dawn light tracing a gentle visible current of air" }
  ],
  elements: [
    ...features("fire", [
      ["ember-channel", "one gentle ribbon of elemental fire flowing above a rocky river channel"],
      ["fire-arch", "one flowing arc of elemental fire crossing a distant woodland stream"],
      ["ember-gorge", "one restrained seam of glowing fire along a rocky woodland gorge"],
      ["fire-cascade", "one narrow cascade of elemental flame descending a distant rock face"],
      ["ember-bend", "one softly swirling current of fire following a bend in the woodland river"],
      ["fire-clearing", "one low, graceful wave of elemental flame passing through a distant clearing"]
    ]),
    ...features("earth", [
      ["stone-terrace", "one weathered rocky terrace rising naturally beside the forest river"],
      ["earth-ridge", "one rugged earthen ridge carrying a subtle mineral glow between ancient trees"],
      ["stone-crossing", "one organically shaped stone crossing above a narrow woodland gorge"],
      ["mineral-seam", "one softly illuminated mineral seam winding through a dark rock bank"],
      ["earth-platform", "one low cluster of stone slabs gently lifted above a rocky riverbed"],
      ["rock-wall", "one ancient sculpted rock wall emerging naturally from the woodland terrain"]
    ]),
    ...features("lightning", [
      ["distant-lightning", "one graceful branching lightning discharge in a distant forest gorge"],
      ["river-lightning", "one slender lightning current following the river in the middle distance"],
      ["canopy-lightning", "one delicate branching lightning arc passing above the distant tree canopy"],
      ["gorge-lightning", "one lightning arc crossing between two rocky woodland cliffs"],
      ["lightning-reflection", "one distant lightning discharge mirrored in a still forest pool"],
      ["mist-lightning", "one gently curving lightning discharge illuminating thin middle-distance mist"]
    ]),
    ...features("energy", [
      ["violet-current", "one flowing ribbon of violet elemental energy above a woodland stream"],
      ["purple-gorge", "one subtle purple energy current tracing a distant rocky gorge"],
      ["amethyst-cascade", "one narrow cascade of purple energy pouring into a distant woodland pool"],
      ["violet-arch", "one graceful arc of purple energy crossing a river in the middle distance"],
      ["purple-clearing", "one softly spiraling purple energy current passing through a spacious clearing"],
      ["amethyst-river", "one low wave of amethyst energy reflecting along a winding forest river"]
    ]),
    ...features("water", [
      ["turquoise-spring", "one secluded turquoise spring illuminating wet rock and exposed roots"],
      ["water-arc", "one graceful arc of clear elemental water passing over a woodland river"],
      ["water-cascade", "one narrow luminous water cascade between dark woodland stones"],
      ["water-spiral", "one gentle spiral of elemental water rising modestly above a distant pool"],
      ["water-crossing", "one smooth current of elemental water suspended across a narrow gorge"],
      ["water-terrace", "one stream of luminous water passing over stepped rocky woodland terraces"]
    ]),
    ...features("air", [
      ["air-river", "one graceful visible current of air following a winding forest river"],
      ["air-gorge", "one sweeping current of air carrying fine mist through a distant gorge"],
      ["air-clearing", "one gentle spiral of air moving thin haze across an open clearing"],
      ["air-canopy", "one soft arc of air tracing the opening above a distant woodland canopy"],
      ["air-crossing", "one flowing current of air crossing between two ancient tree trunks"],
      ["air-pool", "one gentle current of air skimming a quiet forest pool and stirring delicate ripples"]
    ])
  ]
};

export interface ForestPlan {
  date: string;
  profile: string;
  palette: typeof forestProfile.palettes[number];
  element: typeof forestProfile.elements[number];
  request: string;
}

export function assertForestDate(date: string) {
  const parsed = new Date(date + "T12:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("Forest date must be a valid YYYY-MM-DD date.");
}

export function forestDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map((name) => parts.find((part) => part.type === name)!.value).join("-");
}

export function buildForestPlan(date: string, palette: ForestPlan["palette"], element: ForestPlan["element"]): ForestPlan {
  assertForestDate(date);
  if (palette.element !== element.element) throw new Error("The forest phenomenon must match the selected elemental theme.");
  const request = [
    "An immersive Avatar-inspired " + palette.element + " element forest wallpaper in a wide 16:9 landscape.",
    "Preserve the grand ancient woodland composition, atmospheric depth and convincing bark and water textures of a moonlit turquoise forest and a golden sunbeam forest. The entire woodland environment is the subject.",
    "Palette: " + palette.colors + ". Lighting: " + palette.light + ".",
    "Exactly one elemental phenomenon: " + element.description + ".",
    "Integrate it into the middle-distance landscape at a modest scale; the surrounding trees, exposed roots, wet rock, river and layered mist remain visually dominant.",
    "Sophisticated painterly fantasy environmental art with ancient asymmetrical trees, spacious depth, nuanced shadows and quiet dark edges for desktop icons.",
    "Color comes from elemental light, haze and water reflections. Keep the elemental magic majestic and serene rather than destructive.",
    "No characters, buildings, castles, ferns, moss, botanical motifs, oversized leaves or flowers, isolated object portraits, writing, logos, watermark or border.",
    "Do not mix multiple elements or add another magical focal object."
  ].join(" ");
  return { date, profile: forestProfile.id, palette, element, request };
}

export function chooseForestPlan(date: string, history: Array<{ date: string; palette: { id: string }; element: { id: string } }> = []): ForestPlan {
  assertForestDate(date);
  const previous = history.filter((item) => item.date < date).sort((a, b) => a.date.localeCompare(b.date));
  const day = Math.floor(Date.parse(date + "T12:00:00Z") / 86_400_000);
  const choose = <T extends { id: string }>(items: T[], used: string[]) => {
    const remaining = items.filter((item) => !used.includes(item.id));
    return remaining[day % remaining.length]!;
  };
  const palette = choose(forestProfile.palettes, previous.slice(-(forestProfile.palettes.length - 1)).map((item) => item.palette.id));
  const variants = forestProfile.elements.filter((item) => item.element === palette.element);
  const previousVariants = previous.filter((item) => variants.some((variant) => variant.id === item.element.id));
  const element = choose(variants, previousVariants.slice(-(variants.length - 1)).map((item) => item.element.id));
  return buildForestPlan(date, palette, element);
}
