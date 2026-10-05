import {
  $,
  send,
  withButton,
  openDashboard,
  requestAction,
  shieldElapsed,
  formatDuration,
  aggregateUsage,
  showError,
} from "./shared.js";
import { renderMascot, renderReminder } from "./mascot.js";
let state;
function render() {
  const active = state.shield.enabled;
  $("#status").textContent = active ? "Shield on" : "Shield off";
  $("#status").classList.toggle("on", active);
  $("#session-label").textContent = active
    ? "CURRENT SHIELD SESSION"
    : "YOUR SPACE TO FOCUS";
  $("#timer").textContent = formatDuration(shieldElapsed(state), true);
  $("#description").textContent = active
    ? "Your distractions can wait."
    : "A little distance from distraction.";
  $("#toggle").textContent = active ? "Turn off Shield" : "Enable Shield";
  $("#toggle").classList.toggle("primary", !active);
  $("#toggle").classList.toggle("secondary", active);
  $("#challenge-hint").textContent = active
    ? "Turning off requires 7 math answers."
    : "One click to protect your focus.";
  $("#site-count").textContent = state.domains.length;
  $("#today").textContent = formatDuration(
    aggregateUsage(state, 1).reduce((sum, [, ms]) => sum + ms, 0),
  );
  $("#toggle").disabled = false;
  renderMascot(
    $("#popup-mascot"),
    state.preferences,
    active ? "resting" : "happy",
    active ? "Milo is keeping watch." : "Milo is ready when you are.",
  );
  $(".popup-symbol").classList.toggle("has-mascot", state.preferences.playful);
  renderReminder($("#popup-reminder"), state.preferences.reminder);
}
$("#toggle").addEventListener("click", () =>
  withButton($("#toggle"), async () => {
    if (state.shield.enabled) await requestAction({ type: "disable" });
    else {
      state = (await send("ENABLE")).state;
      render();
    }
  }),
);
$("#dashboard").addEventListener("click", () =>
  withButton($("#dashboard"), openDashboard),
);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.state) {
    state = changes.state.newValue;
    render();
  }
});
send("GET_STATE")
  .then((response) => {
    state = response.state;
    render();
  })
  .catch(showError);
setInterval(() => {
  if (state)
    $("#timer").textContent = formatDuration(shieldElapsed(state), true);
}, 1000);
