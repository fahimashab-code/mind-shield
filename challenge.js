import { $, send, withButton, el, showError } from "./shared.js";
let challenge;
async function load() {
  challenge = (await send("GET_CHALLENGE")).challenge;
  if (!challenge) {
    $("#action-description").textContent =
      "No unlock is waiting. Start a challenge from the dashboard.";
    $("#challenge-form").hidden = true;
    $("#expiry").hidden = true;
    return;
  }
  $("#action-description").textContent =
    challenge.action.type === "remove"
      ? `Solve all seven problems to remove ${challenge.action.domain}. Your Shield stays active while you work.`
      : "Solve all seven problems to turn off Shield. Your Shield stays active while you work.";
  for (const [index, question] of challenge.questions.entries()) {
    const label = el("label", "question"),
      number = el(
        "span",
        "question-number",
        String(index + 1).padStart(2, "0"),
      );
    const expression = el("span", "expression", `${question} =`),
      input = el("input");
    input.name = `answer-${index}`;
    input.type = "text";
    input.inputMode = "numeric";
    input.pattern = "[0-9]{1,8}";
    input.required = true;
    input.maxLength = 8;
    input.autocomplete = "off";
    input.placeholder = "Your answer";
    input.setAttribute("aria-label", `Answer to ${question}`);
    label.append(number, expression, input);
    $("#questions").append(label);
  }
  $("#expiry").textContent =
    `Valid until ${new Date(challenge.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Closing this tab keeps Shield on.`;
  $("#submit").disabled = false;
}
$("#challenge-form").addEventListener("submit", (event) => {
  event.preventDefault();
  withButton($("#submit"), async () => {
    const answers = [...$("#questions").querySelectorAll("input")].map(
      (input) => input.value,
    );
    await send("SUBMIT_CHALLENGE", { id: challenge.id, answers });
    $("#challenge-form").hidden = true;
    $("#expiry").hidden = true;
    $("h1").textContent =
      challenge.action.type === "remove"
        ? "Your list is updated."
        : "Shield is now off.";
    $("#action-description").textContent =
      challenge.action.type === "remove"
        ? "Your other blocked websites stay protected."
        : "Your session has been saved. Come back when you’re ready to focus again.";
  });
});
$("#cancel").addEventListener("click", () =>
  withButton($("#cancel"), async () => {
    if (challenge) await send("CANCEL_CHALLENGE", { id: challenge.id });
    location.href = "dashboard.html";
  }),
);
load().catch(showError);
