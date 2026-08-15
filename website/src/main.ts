import "./style.css";

const demoVideo = document.querySelector<HTMLVideoElement>(".showreel video");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if (demoVideo && reducedMotion.matches) {
  demoVideo.autoplay = false;
  demoVideo.pause();
  demoVideo.currentTime = 0;
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
