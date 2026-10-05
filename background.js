import {
  initialState,
  normalizeDomain,
  hostnameOf,
  matchesDomain,
  buildRules,
  makeChallenge,
  answersMatch,
  addUsage,
  stopShield,
  MAX_DOMAINS,
} from "./core.js";

let state;
let checkpoint = null;
let challenge = null;
const now = () => Date.now();
const save = () => chrome.storage.local.set({ state });

async function syncRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: state.shield.enabled
      ? buildRules(state.domains, chrome.runtime.getURL(""))
      : [],
  });
  await chrome.action.setBadgeText({ text: state.shield.enabled ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#347e63" });
}

async function ensureAlarm() {
  if (!(await chrome.alarms.get("usage-checkpoint")))
    await chrome.alarms.create("usage-checkpoint", { periodInMinutes: 0.5 });
}

function settle(time) {
  if (checkpoint && state.tracking)
    addUsage(state.usage, checkpoint.host, checkpoint.at, time);
  checkpoint = null;
}

async function redirectExisting() {
  if (!state.shield.enabled) return;
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs
      .filter(
        (tab) =>
          !tab.incognito &&
          matchesDomain(hostnameOf(tab.pendingUrl || tab.url), state.domains),
      )
      .map((tab) =>
        chrome.tabs.update(tab.id, {
          url: chrome.runtime.getURL(
            `blocked.html?site=${encodeURIComponent(hostnameOf(tab.pendingUrl || tab.url))}`,
          ),
        }),
      ),
  );
}

async function refreshTracking() {
  settle(now());
  if (state.tracking && (await chrome.idle.queryState(60)) === "active") {
    const win = await chrome.windows.getLastFocused().catch(() => null);
    if (win?.focused) {
      const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
      const host = tab && !tab.incognito ? hostnameOf(tab.url) : null;
      if (host && !(state.shield.enabled && matchesDomain(host, state.domains)))
        checkpoint = { host, at: now() };
    }
  }
  await chrome.storage.session.set({ checkpoint });
  await save();
}

async function initialize() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  const stored = await chrome.storage.local.get("state");
  state = stored.state ?? initialState();
  const session = await chrome.storage.session.get(["checkpoint", "challenge"]);
  checkpoint = session.checkpoint ?? null;
  challenge = session.challenge ?? null;
  chrome.idle.setDetectionInterval(60);
  await syncRules();
  await ensureAlarm();
  await redirectExisting();
  await refreshTracking();
}

// Serialize events and UI mutations so overlapping tab events cannot double-count usage.
let queue = initialize();
function enqueue(operation, reportError = true) {
  const job = queue.then(operation);
  queue = job.catch((error) => {
    if (reportError) console.error("Mind Shield:", error);
  });
  return job;
}

function trusted(sender) {
  // blocked.html is web-accessible, so it is deliberately excluded from mutation callers.
  return (
    sender.id === chrome.runtime.id &&
    ["popup.html", "dashboard.html", "challenge.html"].some(
      (page) => sender.url === chrome.runtime.getURL(page),
    )
  );
}

async function applyProtectedAction(action) {
  const time = now();
  settle(time);
  const previous = structuredClone(state);
  if (action.type === "disable") stopShield(state.shield, time);
  else if (action.type === "remove")
    state.domains = state.domains.filter((domain) => domain !== action.domain);
  else throw new Error("Unknown action.");
  try {
    await syncRules();
    await save();
  } catch (error) {
    state = previous;
    await syncRules();
    throw error;
  }
  challenge = null;
  await chrome.storage.session.remove("challenge");
  await redirectExisting();
  await refreshTracking();
}

function publicChallenge() {
  return challenge
    ? {
        id: challenge.id,
        action: challenge.action,
        questions: challenge.questions.map((q) => q.text),
        expiresAt: challenge.expiresAt,
      }
    : null;
}

async function handle(message) {
  switch (message.type) {
    case "GET_STATE":
      await refreshTracking();
      return { state };
    case "ENABLE": {
      if (state.shield.enabled) return { state };
      if (!state.domains.length)
        throw new Error("Add at least one blocked website first.");
      settle(now());
      const previous = structuredClone(state);
      state.shield.enabled = true;
      state.shield.startedAt = now();
      try {
        await syncRules();
        await save();
      } catch (error) {
        state = previous;
        await syncRules();
        throw error;
      }
      await redirectExisting();
      await refreshTracking();
      return { state };
    }
    case "ADD_DOMAIN": {
      const domain = normalizeDomain(message.domain);
      if (state.domains.includes(domain))
        throw new Error("That website is already on your list.");
      if (state.domains.length >= MAX_DOMAINS)
        throw new Error(`You can block up to ${MAX_DOMAINS} websites.`);
      const previous = [...state.domains];
      state.domains.push(domain);
      try {
        await syncRules();
        await save();
      } catch (error) {
        state.domains = previous;
        await syncRules();
        throw error;
      }
      await redirectExisting();
      await refreshTracking();
      return { state };
    }
    case "REQUEST_ACTION": {
      const action = message.action;
      if (!action || !["disable", "remove"].includes(action.type))
        throw new Error("Unknown action.");
      if (action.type === "remove" && !state.domains.includes(action.domain))
        throw new Error("Website not found.");
      if (!state.shield.enabled) {
        await applyProtectedAction(action);
        return { completed: true };
      }
      challenge = {
        id: crypto.randomUUID(),
        action,
        questions: makeChallenge(),
        expiresAt: now() + 30 * 60_000,
      };
      await chrome.storage.session.set({ challenge });
      return { challenge: publicChallenge() };
    }
    case "GET_CHALLENGE":
      return { challenge: publicChallenge() };
    case "SUBMIT_CHALLENGE": {
      if (!challenge || challenge.id !== message.id)
        throw new Error(
          "This challenge has changed. Start again from the dashboard.",
        );
      if (now() > challenge.expiresAt)
        throw new Error(
          "This challenge expired. Start a new one from the dashboard.",
        );
      if (!answersMatch(challenge.questions, message.answers))
        throw new Error(
          "Some answers are incorrect. Check all seven and try again.",
        );
      await applyProtectedAction(challenge.action);
      return { completed: true };
    }
    case "CANCEL_CHALLENGE":
      if (challenge && challenge.id === message.id) {
        challenge = null;
        await chrome.storage.session.remove("challenge");
      }
      return {};
    case "SET_TRACKING":
      settle(now());
      state.tracking = message.enabled === true;
      await refreshTracking();
      return { state };
    case "CLEAR_STATS":
      checkpoint = null;
      state.usage = {};
      state.shield.sessions = [];
      state.shield.totalMs = 0;
      // Clearing statistics never changes the active Shield session or its start time.
      await refreshTracking();
      return { state };
    default:
      throw new Error("Unknown request.");
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!trusted(sender)) {
    respond({ ok: false, error: "This page cannot change Mind Shield." });
    return false;
  }
  enqueue(() => handle(message), false).then(
    (result) => respond({ ok: true, ...result }),
    (error) => respond({ ok: false, error: error.message }),
  );
  return true;
});

const tick = () => enqueue(refreshTracking);
chrome.tabs.onActivated.addListener(tick);
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.url || info.status === "complete")
    enqueue(async () => {
      await redirectExisting();
      await refreshTracking();
    });
});
chrome.tabs.onRemoved.addListener(tick);
chrome.windows.onFocusChanged.addListener(tick);
chrome.idle.onStateChanged.addListener(tick);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "usage-checkpoint") tick();
});
chrome.runtime.onStartup.addListener(() =>
  enqueue(async () => {
    await ensureAlarm();
    await syncRules();
    await redirectExisting();
    await refreshTracking();
  }),
);
chrome.runtime.onInstalled.addListener(() =>
  enqueue(async () => {
    await ensureAlarm();
    await syncRules();
  }),
);
