import "./style.css";

const demoVideo = document.querySelector<HTMLVideoElement>(".showreel video");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if (demoVideo && reducedMotion.matches) {
  demoVideo.autoplay = false;
  demoVideo.pause();
  demoVideo.currentTime = 0;
}

const wallpapers = [
  ["glacial-lagoon.webp", "Photographic", "Pale ice arches holding the first yellow light of morning."],
  ["golden-grasslands.webp", "Painterly", "An open field beneath enormous blue weather."],
  ["brutalist-sea-house.webp", "Architecture", "Concrete, clear water, and one yellow chair."],
  ["liquid-glass.webp", "Abstract", "Light moving through a folded ribbon of glass."],
  ["night-train.webp", "Illustrated", "A warm overnight train crossing the blue mountains."],
  ["white-dunes.webp", "Aerial", "White dunes, shallow water, one distant umbrella."],
  ["flooded-library.webp", "Environment", "A silent library reflected in still blue water."],
  ["paper-archipelago.webp", "Tactile", "An imaginary archipelago cut from handmade paper."],
  ["violet-lightning.webp", "Storm", "Violet mist split by a single electric branch."],
  ["silk-flames.webp", "Fire", "Crimson flame moving like silk through darkness."],
  ["moss-temple.webp", "Earth", "Ancient basalt, wet moss, and yellow forest light."],
  ["red-clay-storm.webp", "Terrain", "Rain settling across a red desert after the storm."],
  ["firefly-meadow.webp", "Illustrated", "A green meadow lifting into a yellow constellation."],
  ["mineral-earth.webp", "Texture", "Clay, copper, and turquoise seen as aerial terrain."],
  ["mountain-mist.webp", "Atmosphere", "Fog flowing between midnight-blue mountain layers."],
  ["lava-meets-ice.webp", "Elemental", "Molten red meeting glacial blue at the edge of the world."],
  ["purple-petals.webp", "Botanical", "Rain held inside deep folds of violet petals."],
  ["emerald-cenote.webp", "Underwater", "Gold light entering the green silence of a cenote."],
  ["red-planet.webp", "Science fiction", "A red planet rising behind an earthen observatory."],
  ["midnight-rooftop.webp", "Nocturne", "A rain-soaked rooftop garden above the midnight city."],
] as const;

const carousel = document.querySelector<HTMLElement>("[data-carousel]");
const carouselTrack = document.querySelector<HTMLElement>("[data-carousel-track]");
const carouselCurrent = document.querySelector<HTMLElement>("[data-carousel-current]");
if (carousel && carouselTrack) {
  wallpapers.forEach(([file, category, caption], index) => {
    const figure = document.createElement("figure");
    figure.className = "wallpaper-slide";
    figure.dataset.slide = String(index);
    const image = document.createElement("img");
    image.src = `/wallpapers/gallery/${file}`;
    image.alt = caption;
    image.width = 1536;
    image.height = 864;
    image.loading = index < 2 ? "eager" : "lazy";
    const description = document.createElement("figcaption");
    description.innerHTML = `<span>${String(index + 1).padStart(2, "0")} / ${category}</span><p>${caption}</p>`;
    figure.append(image, description);
    carouselTrack.append(figure);
  });

  const slides = [...carouselTrack.querySelectorAll<HTMLElement>("[data-slide]")];
  let activeIndex = 0;
  let autoplay: number | undefined;
  const show = (index: number, behavior: ScrollBehavior = "smooth") => {
    activeIndex = (index + slides.length) % slides.length;
    const slide = slides[activeIndex];
    if (slide) {
      const left = slide.offsetLeft - (carouselTrack.clientWidth - slide.offsetWidth) / 2;
      carouselTrack.scrollTo({ left, behavior });
    }
    if (carouselCurrent) carouselCurrent.textContent = String(activeIndex + 1).padStart(2, "0");
  };
  const stopAutoplay = () => window.clearInterval(autoplay);
  const startAutoplay = () => {
    stopAutoplay();
    if (!reducedMotion.matches) autoplay = window.setInterval(() => show(activeIndex + 1), 5200);
  };
  document.querySelector("[data-carousel-prev]")?.addEventListener("click", () => { show(activeIndex - 1); startAutoplay(); });
  document.querySelector("[data-carousel-next]")?.addEventListener("click", () => { show(activeIndex + 1); startAutoplay(); });
  carousel.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    show(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
    startAutoplay();
  });
  carousel.addEventListener("pointerenter", stopAutoplay);
  carousel.addEventListener("pointerleave", startAutoplay);
  carousel.addEventListener("focusin", stopAutoplay);
  carousel.addEventListener("focusout", startAutoplay);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) startAutoplay();
    else stopAutoplay();
  }, { threshold: 0.2 });
  visibilityObserver.observe(carousel);
  carouselTrack.addEventListener("scrollend", () => {
    const trackCenter = carouselTrack.scrollLeft + carouselTrack.clientWidth / 2;
    const closest = slides.reduce((best, slide, index) => {
      const center = slide.offsetLeft + slide.offsetWidth / 2;
      return Math.abs(center - trackCenter) < best.distance ? { index, distance: Math.abs(center - trackCenter) } : best;
    }, { index: 0, distance: Number.POSITIVE_INFINITY });
    activeIndex = closest.index;
    if (carouselCurrent) carouselCurrent.textContent = String(activeIndex + 1).padStart(2, "0");
  });
}

const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-tab]")];
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    for (const candidate of tabs) {
      const selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      const panel = document.getElementById(`${candidate.dataset.tab}-panel`);
      if (panel) panel.hidden = !selected;
    }
  });
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = tabs.indexOf(tab);
    const next = event.key === "ArrowRight" ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
    tabs[next]?.focus();
    tabs[next]?.click();
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.copy ?? "");
    button.textContent = "[ copied ]";
    window.setTimeout(() => { button.textContent = "[ copy ]"; }, 1500);
  });
}

const navLinks = [...document.querySelectorAll<HTMLAnchorElement>("nav a")];
const sections = navLinks.map((link) => document.querySelector<HTMLElement>(link.hash)).filter(Boolean) as HTMLElement[];
const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  for (const link of navLinks) link.classList.toggle("active", link.hash === `#${visible.target.id}`);
}, { rootMargin: "-20% 0px -60%", threshold: [0, 0.2, 0.5] });
for (const section of sections) observer.observe(section);
