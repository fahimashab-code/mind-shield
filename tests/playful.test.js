import test from "node:test";
import assert from "node:assert/strict";
import { initialState, makeChallenge } from "../core.js";
import {
  upgradeState,
  registerMilestone,
  createReceipt,
  checkChallengeAnswers,
  blockedMessage,
} from "../playful.js";

test("upgrading version one preserves protection, websites and usage without inventing receipts", () => {
  const legacy = initialState();
  delete legacy.preferences;
  delete legacy.milestones;
  delete legacy.receipts;
  legacy.version = 1;
  legacy.shield.enabled = true;
  legacy.shield.startedAt = 1234;
  legacy.shield.sessions = [{ startedAt: 100, endedAt: 200, durationMs: 100 }];
  legacy.usage = { "2026-10-05": { "example.com": 1000 } };
  const before = structuredClone(legacy);
  upgradeState(legacy);
  assert.deepEqual(legacy.shield, before.shield);
  assert.deepEqual(legacy.usage, before.usage);
  assert.deepEqual(legacy.domains, before.domains);
  assert.equal(legacy.milestones.sessionsStarted, 2);
  assert.equal(legacy.milestones.mathUnlocks, 1);
  assert.ok(legacy.milestones.earned.firstShield);
  assert.ok(legacy.milestones.earned.mathEscape);
  assert.deepEqual(legacy.receipts, []);
  legacy.preferences.playful = false;
  legacy.preferences.reminder = "Keep working";
  assert.deepEqual(upgradeState(structuredClone(legacy)), legacy);
});

test("badges unlock at their threshold and keep their original earned date", () => {
  const state = initialState();
  assert.deepEqual(registerMilestone(state, "sessionsStarted", 10), [
    "firstShield",
  ]);
  assert.deepEqual(registerMilestone(state, "sessionsStarted", 20), []);
  for (let i = 0; i < 4; i++)
    assert.deepEqual(registerMilestone(state, "blockedVisits", 30), []);
  assert.deepEqual(registerMilestone(state, "blockedVisits", 40), [
    "tabResister",
  ]);
  assert.deepEqual(registerMilestone(state, "mathUnlocks", 50), ["mathEscape"]);
  assert.equal(state.milestones.earned.firstShield, 10);
});

test("partial math checks save verified answers and never trust caller-supplied solved flags", () => {
  const challenge = {
    questions: makeChallenge(() => 0),
    solved: Array(7).fill(false),
  };
  const answers = Array(7).fill("");
  answers[0] = String(challenge.questions[0].answer);
  answers[1] = "999";
  assert.deepEqual(checkChallengeAnswers(challenge, answers), [
    { index: 0, correct: true },
    { index: 1, correct: false },
  ]);
  answers[0] = "0";
  answers[1] = String(challenge.questions[1].answer);
  checkChallengeAnswers(challenge, answers);
  assert.deepEqual(challenge.solved, [
    true,
    true,
    false,
    false,
    false,
    false,
    false,
  ]);
  answers[2] = "1e3";
  assert.equal(checkChallengeAnswers(challenge, answers)[0].correct, false);
  assert.throws(() => checkChallengeAnswers(challenge, []));
  checkChallengeAnswers(
    challenge,
    challenge.questions.map((q) => String(q.answer)),
  );
  assert.ok(challenge.solved.every(Boolean));
});

test("receipts retain only twenty successful choices and jokes match domain boundaries", () => {
  const state = initialState();
  for (let i = 0; i < 25; i++)
    createReceipt(state, { type: "disable" }, 1000 + i, 100);
  assert.equal(state.receipts.length, 20);
  assert.equal(state.receipts[0].protectedMs, 924);
  const receipt = createReceipt(
    state,
    { type: "remove", domain: "facebook.com" },
    2000,
    1000,
  );
  assert.equal(receipt.shieldStillOn, true);
  assert.equal(receipt.domain, "facebook.com");
  assert.equal(receipt.questionsSolved, 7);
  assert.match(
    blockedMessage("m.linkedin.com", () => 0),
    /LinkedIn/,
  );
  assert.doesNotMatch(
    blockedMessage("evil-linkedin.com", () => 0),
    /LinkedIn/,
  );
});
