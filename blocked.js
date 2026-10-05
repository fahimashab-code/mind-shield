import { normalizeDomain } from "./core.js";
import { blockedMessage } from "./playful.js";
import { renderMascot, renderReminder } from "./mascot.js";
import { setMemeEffects } from "./meme-effects.js";

let site = "";
try {
  const input = new URLSearchParams(location.search).get("site");
  if (input) site = normalizeDomain(input);
} catch {
  /* Do not display invalid URL input. */
}
document.querySelector("#blocked-site").textContent = site;

async function update() {
  // This page can read presentation settings only. It cannot change Shield or access usage history.
  const response = await chrome.runtime.sendMessage({
    type: "GET_BLOCKED_VIEW",
  });
  if (!response?.ok) return;
  const { enabled, preferences } = response.presentation;
  setMemeEffects({ ...preferences, playful: preferences.playful && enabled });
  renderMascot(
    document.querySelector("#blocked-mascot"),
    preferences,
    enabled ? "suspicious" : "happy",
    enabled
      ? "Milo noticed that little detour."
      : "Milo has clocked out for now.",
  );
  document
    .querySelector(".blocked-emblem")
    .classList.toggle("has-mascot", preferences.playful);
  const joke = document.querySelector("#blocked-joke");
  joke.hidden = !preferences.playful || !enabled;
  if (!joke.textContent) joke.textContent = blockedMessage(site);
  renderReminder(
    document.querySelector("#blocked-reminder"),
    preferences.reminder,
  );
  document.querySelector("#blocked-status").textContent = enabled
    ? "YOUR SHIELD IS ACTIVE"
    : "SHIELD IS NOW OFF";
  if (enabled) {
    document.querySelector("#blocked-heading").textContent =
      "A little space to focus.";
    document.querySelector("#blocked-description").textContent =
      "This website is on your blocked list. Take a breath and return to what matters.";
    document.querySelector("#blocked-hint").textContent =
      "Turning off Shield requires seven correct math answers.";
  } else {
    document.querySelector("#blocked-heading").textContent =
      "This tab was blocked earlier.";
    document.querySelector("#blocked-description").textContent =
      "Shield is off now. You can reopen your website whenever you choose.";
    document.querySelector("#blocked-hint").textContent =
      "Return to the dashboard when you’re ready to start another session.";
  }
}
update().catch(() => {
  /* The blocked screen remains useful even if settings cannot be loaded. */
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.state) update().catch(() => {});
});
