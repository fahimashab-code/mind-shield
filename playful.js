export const BADGES = [
  {
    id: "firstShield",
    title: "First Shield Session",
    icon: "✦",
    description: "Enable Shield for the first time.",
    target: 1,
    counter: "sessionsStarted",
  },
  {
    id: "mathEscape",
    title: "Math Escape Artist",
    icon: "×",
    description: "Complete your first seven-answer unlock.",
    target: 1,
    counter: "mathUnlocks",
  },
  {
    id: "tabResister",
    title: "Professional Tab Resister",
    icon: "⊘",
    description: "Meet the blocked page five times while Shield is on.",
    target: 5,
    counter: "blockedVisits",
  },
];

export function upgradeState(state) {
  const legacy = !state.milestones;
  state.preferences = {
    playful: true,
    memeEffects: true,
    reminder: "",
    ...(state.preferences || {}),
  };
  state.milestones = {
    sessionsStarted:
      state.shield.sessions.length + (state.shield.enabled ? 1 : 0),
    mathUnlocks: state.shield.sessions.length,
    blockedVisits: 0,
    earned: {},
    ...(state.milestones || {}),
  };
  state.receipts ??= [];
  state.version = 2;
  if (legacy)
    awardBadges(
      state,
      state.shield.startedAt ||
        state.shield.sessions[0]?.startedAt ||
        Date.now(),
    );
  return state;
}

export function awardBadges(state, time) {
  const newlyEarned = [];
  for (const badge of BADGES) {
    if (
      state.milestones[badge.counter] >= badge.target &&
      !state.milestones.earned[badge.id]
    ) {
      state.milestones.earned[badge.id] = time;
      newlyEarned.push(badge.id);
    }
  }
  return newlyEarned;
}

export function registerMilestone(state, counter, time) {
  state.milestones[counter] += 1;
  return awardBadges(state, time);
}

export function createReceipt(state, action, time, startedAt) {
  const receipt = {
    id: crypto.randomUUID(),
    time,
    action: action.type,
    ...(action.type === "remove" ? { domain: action.domain } : {}),
    protectedMs: Math.max(0, time - startedAt),
    questionsSolved: 7,
    shieldStillOn: action.type === "remove",
  };
  state.receipts.unshift(receipt);
  state.receipts = state.receipts.slice(0, 20);
  return receipt;
}

export function blockedMessage(site, random = Math.random) {
  const general = [
    "Your tabs have enough drama. Give this one a day off.",
    "Plot twist: you remembered what you came here to do.",
    "Distraction knocked. Your Shield pretended nobody was home.",
    "This website has been placed in the waiting room.",
    "A tiny detour has been gently escorted off the premises.",
    "Your future self asked us to intercept this tab.",
  ];
  const specific = {
    "linkedin.com": "LinkedIn will survive without your supervision.",
    "instagram.com": "The reels will keep spinning. You can keep focusing.",
    "facebook.com": "The feed has been fed enough for today.",
    "x.com": "The hot takes can cool down for a bit.",
    "twitter.com": "The hot takes can cool down for a bit.",
    "chess.com": "A strategic retreat from just one more game.",
    "lichess.org": "Your strongest move right now: closing this tab.",
    "reddit.com": "That rabbit hole will still be here after your work.",
  };
  const domain = Object.keys(specific).find(
    (domain) => site === domain || site?.endsWith(`.${domain}`),
  );
  const choices = domain ? [specific[domain], ...general] : general;
  return choices[
    Math.min(
      choices.length - 1,
      Math.max(0, Math.floor(random() * choices.length)),
    )
  ];
}

export function checkChallengeAnswers(challenge, answers) {
  if (!Array.isArray(answers) || answers.length !== 7)
    throw new Error("Send one answer for each of the seven questions.");
  challenge.solved ??= Array(7).fill(false);
  const checked = [];
  for (let i = 0; i < 7; i++) {
    if (
      challenge.solved[i] ||
      typeof answers[i] !== "string" ||
      !answers[i].trim()
    )
      continue;
    const answer = answers[i].trim();
    const correct =
      /^\d{1,8}$/.test(answer) &&
      Number(answer) === challenge.questions[i].answer;
    if (correct) challenge.solved[i] = true;
    checked.push({ index: i, correct });
  }
  return checked;
}
