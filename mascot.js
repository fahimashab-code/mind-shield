import { el } from "./shared.js";

const labels = {
  resting: "Milo the Shield is resting and keeping watch.",
  suspicious: "Milo the Shield raises an eyebrow at this detour.",
  happy: "Milo the Shield is celebrating your progress.",
};

export function renderMascot(
  root,
  preferences,
  mood = "resting",
  caption = "Milo is keeping watch.",
) {
  root.hidden = !preferences.playful;
  if (root.dataset.mood === mood) return;
  root.dataset.mood = mood;
  root.replaceChildren();
  root.className = `mascot mascot--${mood}`;
  const image = el("img");
  image.src = `icons/milo-${mood}.svg`;
  image.width = 84;
  image.height = 84;
  image.alt = labels[mood];
  root.append(image, el("span", "mascot-caption", caption));
}

export function renderReminder(root, reminder) {
  root.hidden = !reminder;
  root.replaceChildren();
  if (reminder)
    root.append(
      el("span", "eyebrow", "A NOTE FROM YOU"),
      el("p", "", reminder),
    );
}
