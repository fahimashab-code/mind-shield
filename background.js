import {
  initialState,
  normalizeTarget,
  hostnameOf,
  matchingTarget,
  buildRules,
  makeChallenge,
  answersMatch,
  addUsage,
  addActivity,
  pruneDaily,
  stopShield,
  MAX_DOMAINS,
} from "./core.js";
import {
  upgradeState,
  registerMilestone,
  createReceipt,
  checkChallengeAnswers,
} from "./playful.js";

let state;
let checkpoint = null;
let challenge = null;
let viewedBlockedTabs = {};
let activityCursor = null;
let navigationEvents = {};
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
          matchingTarget(tab.pendingUrl || tab.url, state.domains),
      )
      .map((tab) =>
        chrome.tabs.update(tab.id, {
          url: chrome.runtime.getURL(
            `blocked.html?site=${encodeURIComponent(matchingTarget(tab.pendingUrl || tab.url, state.domains))}`,
          ),
        }),
      ),
  );
}

async function refreshTracking(countHop = false) {
  settle(now());
  pruneDaily(state.usage, now());
  pruneDaily(state.activity, now());
  let nextCursor = null;
  if (state.tracking && (await chrome.idle.queryState(60)) === "active") {
    const win = await chrome.windows.getLastFocused().catch(() => null);
    if (win?.focused) {
      const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
      const host = tab && !tab.incognito ? hostnameOf(tab.url) : null;
      // Remember internal pages too, so returning from the dashboard is a hop.
      if (tab && !tab.incognito) nextCursor = { tabId: tab.id };
      if (
        host &&
        !(state.shield.enabled && matchingTarget(tab.url, state.domains))
      ) {
        if (countHop && activityCursor && activityCursor.tabId !== tab.id)
          addActivity(state.activity, host, "hops", now());
        checkpoint = { host, at: now() };
      }
    }
  }
  activityCursor = nextCursor;
  await chrome.storage.session.set({ checkpoint, activityCursor });
  await save();
}

async function initialize() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  const stored = await chrome.storage.local.get("state");
  state = upgradeState(stored.state ?? initialState());
  const session = await chrome.storage.session.get([
    "checkpoint",
    "challenge",
    "viewedBlockedTabs",
    "activityCursor",
    "navigationEvents",
  ]);
  checkpoint = session.checkpoint ?? null;
  challenge = session.challenge ?? null;
  viewedBlockedTabs = session.viewedBlockedTabs ?? {};
  activityCursor = session.activityCursor ?? null;
  navigationEvents = session.navigationEvents ?? {};
  if (challenge) challenge.solved ??= Array(7).fill(false);
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

async function applyProtectedAction(action, solvedUnlock = false) {
  const time = now();
  settle(time);
  const previous = structuredClone(state);
  if (action.type === "disable") stopShield(state.shield, time);
  else if (action.type === "remove")
    state.domains = state.domains.filter((domain) => domain !== action.domain);
  else throw new Error("Unknown action.");
  let receipt = null;
  if (solvedUnlock) {
    registerMilestone(state, "mathUnlocks", time);
    receipt = createReceipt(state, action, time, previous.shield.startedAt);
  }
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
  return receipt;
}

function currentChallenge(id) {
  if (!challenge || challenge.id !== id)
    throw new Error(
      "This challenge has changed. Start again from the dashboard.",
    );
  if (now() > challenge.expiresAt)
    throw new Error(
      "This challenge expired. Start a new one from the dashboard.",
    );
  return challenge;
}

function blockedSender(sender) {
  try {
    const url = new URL(sender.url);
    return (
      sender.id === chrome.runtime.id &&
      url.protocol === "chrome-extension:" &&
      url.host === chrome.runtime.id &&
      url.pathname === "/blocked.html"
    );
  } catch {
    return false;
  }
}

async function recordBlockedVisit(tabId, info, tab) {
  const url = tab?.url || info.url;
  let site = null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "chrome-extension:" &&
      parsed.host === chrome.runtime.id &&
      parsed.pathname === "/blocked.html"
    )
      site = normalizeTarget(parsed.searchParams.get("site"));
  } catch {
    /* Ignore pages without a known blocked domain. */
  }
  if (!site && info.url) delete viewedBlockedTabs[tabId];
  if (
    info.status === "complete" &&
    state.shield.enabled &&
    !tab?.incognito &&
    matchingTarget(`https://${site}`, state.domains) &&
    viewedBlockedTabs[tabId] !== url
  ) {
    viewedBlockedTabs[tabId] = url;
    registerMilestone(state, "blockedVisits", now());
    if (state.tracking)
      addActivity(
        state.activity,
        hostnameOf(`https://${site}`),
        "blocked",
        now(),
      );
  }
  await chrome.storage.session.set({ viewedBlockedTabs });
}

async function recordNavigation(details, kind) {
  if (details.frameId !== 0 || details.documentLifecycle === "prerender")
    return;
  const tab = await chrome.tabs.get(details.tabId).catch(() => null);
  if (!tab || tab.incognito) return;
  // DNR handles network loads; this also covers client-side history routes.
  if (state.shield.enabled && matchingTarget(details.url, state.domains)) {
    await chrome.tabs.update(tab.id, {
      url: chrome.runtime.getURL(
        `blocked.html?site=${encodeURIComponent(matchingTarget(details.url, state.domains))}`,
      ),
    });
    await refreshTracking();
    return;
  }
  const signature = `${kind}:${details.documentId}:${details.timeStamp}`;
  if (navigationEvents[tab.id] === signature) return;
  navigationEvents[tab.id] = signature;
  await chrome.storage.session.set({ navigationEvents });
  const win = await chrome.windows.getLastFocused().catch(() => null);
  const host = hostnameOf(details.url);
  if (
    state.tracking &&
    host &&
    tab.active &&
    win?.focused &&
    tab.windowId === win.id &&
    (await chrome.idle.queryState(60)) === "active"
  )
    addActivity(state.activity, host, "visits", now());
  await refreshTracking();
}

function publicChallenge() {
  return challenge
    ? {
        id: challenge.id,
        action: challenge.action,
        questions: challenge.questions.map((q) => q.text),
        expiresAt: challenge.expiresAt,
        solved: challenge.solved || Array(7).fill(false),
      }
    : null;
}

async function handle(message) {
  switch (message.type) {
    case "GET_STATE":
      await refreshTracking();
      return { state };
    case "GET_BLOCKED_VIEW":
      return {
        presentation: {
          enabled: state.shield.enabled,
          preferences: state.preferences,
        },
      };
    case "ENABLE": {
      if (state.shield.enabled) return { state };
      if (!state.domains.length)
        throw new Error("Add at least one blocked website first.");
      settle(now());
      const previous = structuredClone(state);
      state.shield.enabled = true;
      state.shield.startedAt = now();
      registerMilestone(state, "sessionsStarted", now());
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
      const domain = normalizeTarget(message.domain);
      if (state.domains.includes(domain))
        throw new Error("That website is already on your list.");
      if (state.domains.length >= MAX_DOMAINS)
        throw new Error(`You can block up to ${MAX_DOMAINS} websites.`);
      if (matchingTarget(`https://${domain}`, state.domains))
        throw new Error(
          "That address is already covered by a broader rule. Remove the broader rule first to block only a path.",
        );
      const rule = buildRules([domain], chrome.runtime.getURL(""))[0];
      if (rule.condition.regexFilter) {
        const supported = await chrome.declarativeNetRequest.isRegexSupported({
          regex: rule.condition.regexFilter,
          isCaseSensitive: true,
        });
        if (!supported.isSupported)
          throw new Error(
            "Chrome cannot use that path. Try a shorter URL path.",
          );
      }
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
        solved: Array(7).fill(false),
      };
      await chrome.storage.session.set({ challenge });
      return { challenge: publicChallenge() };
    }
    case "GET_CHALLENGE":
      return { challenge: publicChallenge() };
    case "CHECK_ANSWERS": {
      currentChallenge(message.id);
      const checked = checkChallengeAnswers(challenge, message.answers);
      await chrome.storage.session.set({ challenge });
      return { challenge: publicChallenge(), checked };
    }
    case "SUBMIT_CHALLENGE": {
      currentChallenge(message.id);
      if (
        !(challenge.solved?.length === 7 && challenge.solved.every(Boolean)) &&
        !answersMatch(challenge.questions, message.answers)
      )
        throw new Error(
          "Some answers are incorrect. Check all seven and try again.",
        );
      const receipt = await applyProtectedAction({ ...challenge.action }, true);
      return { completed: true, receipt, preferences: state.preferences };
    }
    case "CANCEL_CHALLENGE":
      if (challenge && challenge.id === message.id) {
        challenge = null;
        await chrome.storage.session.remove("challenge");
      }
      return {};
    case "SET_TRACKING":
      settle(now());
      activityCursor = null;
      state.tracking = message.enabled === true;
      await refreshTracking();
      return { state };
    case "SET_PREFERENCES": {
      if (
        typeof message.playful !== "boolean" ||
        typeof message.reminder !== "string" ||
        message.reminder.length > 240 ||
        (message.memeEffects !== undefined &&
          typeof message.memeEffects !== "boolean")
      )
        throw new Error(
          "Choose valid preferences and keep your reminder within 240 characters.",
        );
      state.preferences = {
        playful: message.playful,
        reminder: message.reminder.trim(),
      };
      state.preferences.memeEffects = message.memeEffects !== false;
      await save();
      return { state };
    }
    case "CLEAR_STATS":
      checkpoint = null;
      state.usage = {};
      state.activity = {};
      state.shield.sessions = [];
      state.shield.totalMs = 0;
      state.milestones = {
        sessionsStarted: 0,
        mathUnlocks: 0,
        blockedVisits: 0,
        earned: {},
      };
      state.receipts = [];
      // Clearing statistics never changes the active Shield session or its start time.
      await refreshTracking();
      return { state };
    default:
      throw new Error("Unknown request.");
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    !trusted(sender) &&
    !(message?.type === "GET_BLOCKED_VIEW" && blockedSender(sender))
  ) {
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
chrome.tabs.onActivated.addListener(() => enqueue(() => refreshTracking(true)));
chrome.webNavigation.onCommitted.addListener((details) =>
  enqueue(() => recordNavigation(details, "page")),
);
chrome.webNavigation.onHistoryStateUpdated.addListener((details) =>
  enqueue(() => recordNavigation(details, "history")),
);
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === "complete")
    enqueue(async () => {
      await recordBlockedVisit(tabId, info, tab);
      await redirectExisting();
      await refreshTracking();
    });
});
chrome.tabs.onRemoved.addListener((tabId) =>
  enqueue(async () => {
    delete viewedBlockedTabs[tabId];
    delete navigationEvents[tabId];
    await chrome.storage.session.set({ viewedBlockedTabs, navigationEvents });
    await refreshTracking();
  }),
);
chrome.windows.onFocusChanged.addListener(() =>
  enqueue(() => refreshTracking(true)),
);
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
