import { $, send, withButton, el, showError, renderReceipt } from "./shared.js";
import { setMemeEffects, stopMemeEffects } from "./meme-effects.js";
let challenge,
  preferences,
  finished = false,
  ready = false;

function renderProgress(checked = []) {
  const solved = challenge.solved.filter(Boolean).length;
  setMemeEffects(preferences);
  $("#challenge-progress").textContent =
    `${solved} of 7 answers verified. ${solved === 7 ? "Ready to unlock — Shield is still on until you confirm." : "Shield stays on while you work."}`;
  $("#boss-battle").hidden = !preferences.playful;
  $("#boss-health").value = 7 - solved;
  $("#boss-health").textContent = String(7 - solved);
  $("#boss-battle").classList.toggle("defeated", solved === 7);
  $("#boss-name").textContent =
    solved === 7 ? "Distraction Monster defeated!" : "Distraction Monster";
  $("#boss-line").textContent =
    solved === 7
      ? "A heroic amount of arithmetic. Confirm your choice below."
      : `${7 - solved} / 7 health left. Every correct answer lands a hit.`;
  for (let index = 0; index < 7; index++) {
    const row = $("#questions").children[index],
      input = row.querySelector("input"),
      check = row.querySelector("button"),
      feedback = row.querySelector(".answer-feedback");
    const correct = challenge.solved[index];
    row.classList.toggle("solved", correct);
    input.disabled = correct;
    check.disabled = correct;
    check.textContent = correct ? "✓" : "Check";
    if (correct) {
      input.placeholder = "Verified";
      input.removeAttribute("aria-invalid");
      feedback.textContent = "Correct — nice work.";
    }
    const result = checked.find((result) => result.index === index);
    if (result && !result.correct) {
      input.setAttribute("aria-invalid", "true");
      feedback.textContent = "Check this answer and try again.";
    }
  }
  $("#submit").textContent =
    solved === 7
      ? challenge.action.type === "remove"
        ? "Confirm website removal"
        : "Turn off Shield"
      : "Check answers";
  $("#submit").disabled = false;
}

async function checkAnswers(index) {
  const answers = [...$("#questions").querySelectorAll("input")].map(
    (input, i) => (index === undefined || index === i ? input.value : ""),
  );
  if (!answers.some((answer, i) => answer.trim() && !challenge.solved[i]))
    throw new Error(
      "Enter an answer, then check it. Verified answers are already saved.",
    );
  const response = await send("CHECK_ANSWERS", { id: challenge.id, answers });
  challenge = response.challenge;
  renderProgress(response.checked);
  if (response.checked.some((result) => !result.correct)) {
    $("#notice").textContent =
      "Some answers need another look. Your correct answers are saved.";
    $("#notice").hidden = false;
  }
  const nextInput = [...$("#questions").querySelectorAll("input")].find(
    (input) => !input.disabled,
  );
  nextInput?.focus();
}

async function load() {
  const response = await send("GET_CHALLENGE");
  challenge = response.challenge;
  preferences = (await send("GET_STATE")).state.preferences;
  if (!challenge) {
    $("#action-description").textContent =
      "No unlock is waiting. Start a challenge from the dashboard.";
    $("#challenge-form").hidden = true;
    $("#expiry").hidden = true;
    $("#challenge-progress").hidden = true;
    return;
  }
  $("#action-description").textContent =
    challenge.action.type === "remove"
      ? `Solve all seven problems to remove ${challenge.action.domain}. Your Shield stays active while you work.`
      : "Solve all seven problems to turn off Shield. Your Shield stays active while you work.";
  for (const [index, question] of challenge.questions.entries()) {
    const row = el("div", "question"),
      number = el(
        "span",
        "question-number",
        String(index + 1).padStart(2, "0"),
      );
    const expression = el("label", "expression", `${question} =`),
      answerGroup = el("div", "answer-group"),
      input = el("input"),
      check = el("button", "answer-check", "Check");
    input.id = `answer-${index}`;
    input.name = input.id;
    expression.htmlFor = input.id;
    input.type = "text";
    input.inputMode = "numeric";
    input.pattern = "[0-9]{1,8}";
    input.maxLength = 8;
    input.autocomplete = "off";
    input.placeholder = "Your answer";
    input.setAttribute("aria-label", `Answer to ${question}`);
    const feedback = el("span", "answer-feedback");
    feedback.id = `feedback-${index}`;
    input.setAttribute("aria-describedby", feedback.id);
    input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      feedback.textContent = "";
    });
    check.type = "button";
    check.setAttribute("aria-label", `Check answer ${index + 1}`);
    check.addEventListener("click", async () => {
      await withButton(check, () => checkAnswers(index));
      check.disabled = Boolean(challenge.solved[index]);
    });
    answerGroup.append(input, check);
    row.append(number, expression, answerGroup, feedback);
    $("#questions").append(row);
  }
  $("#expiry").textContent =
    `Valid until ${new Date(challenge.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Verified answers survive closing this tab; closing Chrome ends the challenge.`;
  ready = true;
  renderProgress();
}

$("#challenge-form").addEventListener("submit", (event) => {
  event.preventDefault();
  withButton($("#submit"), async () => {
    if (!challenge.solved.every(Boolean)) {
      await checkAnswers();
      return;
    }
    const response = await send("SUBMIT_CHALLENGE", {
      id: challenge.id,
      answers: [],
    });
    finished = true;
    stopMemeEffects();
    $("#challenge-form").hidden = true;
    $("#expiry").hidden = true;
    $("#boss-battle").hidden = true;
    $("#challenge-progress").hidden = true;
    $("h1").textContent =
      challenge.action.type === "remove"
        ? "Your list is updated."
        : "Shield is now off.";
    $("#action-description").textContent =
      challenge.action.type === "remove"
        ? "Your other blocked websites stay protected."
        : "Your session has been saved. Come back when you’re ready to focus again.";
    if (response.preferences.playful) {
      $("#escape-receipt").hidden = false;
      renderReceipt($("#escape-receipt"), response.receipt);
    }
  });
});
$("#cancel").addEventListener("click", () =>
  withButton($("#cancel"), async () => {
    if (challenge) await send("CANCEL_CHALLENGE", { id: challenge.id });
    location.href = "dashboard.html";
  }),
);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.state && !finished && ready) {
    preferences = changes.state.newValue.preferences;
    renderProgress();
  }
});
load().catch(showError);
