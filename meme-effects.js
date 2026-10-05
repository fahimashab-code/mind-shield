// The supplied GIF stays local. Decorations never receive clicks or cover the form.
let stage,
  timer,
  count = 0;
let enabled = false;
const motion = matchMedia("(prefers-reduced-motion: reduce)");

function spawn() {
  if (!enabled || document.hidden || motion.matches || count >= 12) return;
  const image = document.createElement("img");
  image.src = "assets/crying.gif";
  image.alt = "";
  image.className = `crying-gif crying-gif-${count}`;
  image.width = 100;
  image.height = 100;
  stage.append(image);
  count++;
  if (count === 12) clearInterval(timer);
}

function stop() {
  clearInterval(timer);
  stage?.remove();
  stage = null;
  count = 0;
}

function start() {
  if (stage || !enabled || document.hidden || motion.matches) return;
  stage = document.createElement("div");
  stage.className = "meme-stage";
  stage.setAttribute("aria-hidden", "true");
  document.body.append(stage);
  spawn();
  spawn();
  timer = setInterval(spawn, 1800);
}

export function setMemeEffects(preferences) {
  const next = preferences.playful && preferences.memeEffects !== false;
  if (next !== enabled) {
    enabled = next;
    stop();
  }
  if (enabled) start();
}

export function stopMemeEffects() {
  enabled = false;
  stop();
}
motion.addEventListener("change", () => {
  stop();
  if (enabled) start();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
  else if (enabled) start();
});
