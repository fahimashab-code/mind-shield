import test from "node:test";
import assert from "node:assert/strict";
import { initialState, dayKey } from "../core.js";

const events = {};
function event(name) {
  return {
    addListener(fn) {
      events[name] ??= [];
      events[name].push(fn);
    },
  };
}
function storage() {
  const data = {};
  return {
    data,
    async get(keys) {
      const selected = typeof keys === "string" ? [keys] : keys;
      return structuredClone(
        Object.fromEntries(
          selected.filter((key) => key in data).map((key) => [key, data[key]]),
        ),
      );
    },
    async set(values) {
      Object.assign(data, structuredClone(values));
    },
    async remove(key) {
      delete data[key];
    },
    async setAccessLevel() {},
  };
}
const local = storage(),
  session = storage();
let rules = [],
  failRules = false,
  focused = true,
  idle = "active",
  tab = {
    id: 1,
    url: "https://example.com",
    incognito: false,
    active: true,
    windowId: 1,
  };
let time = new Date(2026, 9, 5, 12).getTime();
const realNow = Date.now;
Date.now = () => time;
globalThis.chrome = {
  storage: { local, session },
  runtime: {
    id: "mind-shield-test",
    getURL: (path) => `chrome-extension://mind-shield-test/${path}`,
    onMessage: event("message"),
    onStartup: event("startup"),
    onInstalled: event("installed"),
  },
  declarativeNetRequest: {
    async isRegexSupported() {
      return { isSupported: true };
    },
    async getDynamicRules() {
      return structuredClone(rules);
    },
    async updateDynamicRules(update) {
      if (failRules) {
        failRules = false;
        throw new Error("Injected rule failure");
      }
      rules = structuredClone(update.addRules);
    },
  },
  action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} },
  alarms: {
    async get() {
      return null;
    },
    async create() {},
    onAlarm: event("alarm"),
  },
  idle: {
    setDetectionInterval() {},
    async queryState() {
      return idle;
    },
    onStateChanged: event("idle"),
  },
  windows: {
    async getLastFocused() {
      return { focused, id: 1 };
    },
    onFocusChanged: event("focus"),
  },
  tabs: {
    async get(id) {
      if (id === tab.id) return structuredClone(tab);
      throw new Error("No tab");
    },
    async query() {
      return [structuredClone(tab)];
    },
    async update(id, update) {
      tab = { ...tab, ...update };
    },
    onActivated: event("activated"),
    onUpdated: event("updated"),
    onRemoved: event("removed"),
  },
  webNavigation: {
    onCommitted: event("committed"),
    onHistoryStateUpdated: event("history"),
  },
};
await import("../background.js");
const sender = {
  id: chrome.runtime.id,
  url: chrome.runtime.getURL("dashboard.html"),
};
function send(type, payload = {}, from = sender) {
  return new Promise((resolve) =>
    events.message[0]({ type, ...payload }, from, resolve),
  );
}
async function state() {
  const result = await send("GET_STATE");
  assert.ok(result.ok, result.error);
  return result.state;
}

test("background worker enforces protection, accounts foreground time, and handles failures", async () => {
  try {
    assert.equal((await state()).shield.enabled, false);
    time += 10_000;
    let current = await state();
    assert.equal(current.usage[dayKey(time)]["example.com"], 10_000);
    focused = false;
    time += 1000;
    await state();
    time += 30_000;
    current = await state();
    assert.equal(
      current.usage[dayKey(time)]["example.com"],
      11_000,
      "background Chrome must not count",
    );
    focused = true;
    idle = "idle";
    await state();
    time += 30_000;
    current = await state();
    assert.equal(
      current.usage[dayKey(time)]["example.com"],
      11_000,
      "idle computer must not count",
    );
    idle = "active";
    await state();

    assert.equal(
      (
        await send(
          "ENABLE",
          {},
          { id: chrome.runtime.id, url: chrome.runtime.getURL("blocked.html") },
        )
      ).ok,
      false,
    );
    assert.equal(
      (await send("ENABLE", {}, { id: "external", url: "https://evil.test" }))
        .ok,
      false,
    );
    failRules = true;
    assert.equal((await send("ENABLE")).ok, false);
    assert.equal(
      (await state()).shield.enabled,
      false,
      "failed rule installation must roll back",
    );
    assert.equal((await send("ENABLE")).ok, true);
    assert.equal(
      (await state()).milestones.sessionsStarted,
      1,
      "failed activation must not award a badge",
    );
    const blockedFrom = {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL("blocked.html?site=facebook.com"),
    };
    const presentation = await send("GET_BLOCKED_VIEW", {}, blockedFrom);
    assert.equal(presentation.ok, true);
    assert.equal(presentation.state, undefined);
    assert.equal((await send("GET_STATE", {}, blockedFrom)).ok, false);
    assert.equal(
      (
        await send(
          "SET_PREFERENCES",
          { playful: false, reminder: "test" },
          blockedFrom,
        )
      ).ok,
      false,
    );
    assert.equal(
      (
        await send("SET_PREFERENCES", {
          playful: true,
          memeEffects: false,
          reminder: " Keep working ",
        })
      ).ok,
      true,
    );
    assert.equal((await state()).preferences.reminder, "Keep working");
    assert.equal(
      (
        await send("SET_PREFERENCES", {
          playful: true,
          reminder: "x".repeat(241),
        })
      ).ok,
      false,
    );
    for (let i = 0; i < 5; i++) {
      const blockedTab = {
        id: 10 + i,
        incognito: false,
        url: chrome.runtime.getURL("blocked.html?site=facebook.com"),
      };
      events.updated[0](blockedTab.id, { status: "complete" }, blockedTab);
      await state();
      events.updated[0](blockedTab.id, { status: "complete" }, blockedTab);
      await state();
    }
    assert.equal(
      (await state()).milestones.blockedVisits,
      5,
      "blocked reloads must not inflate badges",
    );
    assert.ok((await state()).milestones.earned.tabResister);
    const startedAt = (await state()).shield.startedAt;
    assert.equal(rules.length, initialState().domains.length);
    const challenge = (
      await send("REQUEST_ACTION", { action: { type: "disable" } })
    ).challenge;
    assert.equal(challenge.questions.length, 7);
    assert.equal(
      typeof challenge.questions[0],
      "string",
      "answers must not be returned",
    );
    assert.equal(
      (
        await send("SUBMIT_CHALLENGE", {
          id: challenge.id,
          answers: Array(7).fill("0"),
        })
      ).ok,
      false,
    );
    assert.equal((await state()).shield.enabled, true);
    assert.equal((await state()).receipts.length, 0);
    await send("CANCEL_CHALLENGE", { id: challenge.id });
    assert.equal((await state()).shield.enabled, true);
    await send("CLEAR_STATS");
    assert.equal(
      (await state()).shield.startedAt,
      startedAt,
      "clearing statistics must retain protection",
    );

    let next = (
      await send("REQUEST_ACTION", {
        action: { type: "remove", domain: "facebook.com" },
      })
    ).challenge;
    let answers = session.data.challenge.questions.map((q) => String(q.answer));
    assert.equal(
      (await send("SUBMIT_CHALLENGE", { id: next.id, answers })).ok,
      true,
    );
    assert.equal((await state()).domains.includes("facebook.com"), false);
    assert.equal(
      (await state()).shield.enabled,
      true,
      "approved removal keeps Shield enabled",
    );
    await send("ADD_DOMAIN", { domain: "facebook.com" });
    tab = {
      id: 1,
      url: "https://m.facebook.com/already-open",
      incognito: false,
    };
    await send("ADD_DOMAIN", { domain: "new.test" });
    assert.ok(
      tab.url.startsWith(chrome.runtime.getURL("blocked.html")),
      "already-open blocked tabs must redirect",
    );
    assert.equal((await send("SET_TRACKING", { enabled: false })).ok, true);
    assert.equal(
      (await state()).shield.enabled,
      true,
      "pausing usage tracking must retain protection",
    );

    next = (await send("REQUEST_ACTION", { action: { type: "disable" } }))
      .challenge;
    answers = session.data.challenge.questions.map((q) => String(q.answer));
    time += 31 * 60_000;
    assert.equal(
      (await send("SUBMIT_CHALLENGE", { id: next.id, answers })).ok,
      false,
      "expired challenge cannot disable",
    );
    assert.equal((await state()).shield.enabled, true);
    next = (await send("REQUEST_ACTION", { action: { type: "disable" } }))
      .challenge;
    answers = session.data.challenge.questions.map((q) => String(q.answer));
    assert.equal(
      (await send("SUBMIT_CHALLENGE", { id: "forged-id", answers })).ok,
      false,
    );
    const partial = answers.map((answer, index) => (index === 0 ? answer : ""));
    const checked = await send("CHECK_ANSWERS", {
      id: next.id,
      answers: partial,
    });
    assert.equal(checked.challenge.solved[0], true);
    assert.equal(typeof checked.challenge.questions[0], "string");
    assert.equal(
      (
        await send("SUBMIT_CHALLENGE", {
          id: next.id,
          answers: [],
          solved: Array(7).fill(true),
        })
      ).ok,
      false,
    );
    await send("CHECK_ANSWERS", { id: next.id, answers });
    failRules = true;
    const beforeFailure = structuredClone(await state());
    assert.equal(
      (await send("SUBMIT_CHALLENGE", { id: next.id, answers: [] })).ok,
      false,
    );
    assert.equal((await state()).shield.enabled, true);
    assert.deepEqual(
      (await state()).receipts,
      beforeFailure.receipts,
      "failed unlock must not issue a receipt",
    );
    assert.deepEqual((await state()).milestones, beforeFailure.milestones);
    assert.equal(
      (await send("SUBMIT_CHALLENGE", { id: next.id, answers: [] })).ok,
      true,
    );
    current = await state();
    assert.equal(current.shield.enabled, false);
    assert.equal(rules.length, 0);
    assert.equal(current.shield.sessions.length, 1);
    assert.ok(current.shield.totalMs >= 31 * 60_000);
    assert.equal(current.receipts.length, 2);
    assert.equal(current.receipts[0].shieldStillOn, false);
    assert.equal(current.receipts[1].shieldStillOn, true);
    assert.ok(current.milestones.earned.mathEscape);

    // Existing broad rules cannot silently override a narrower entry.
    assert.equal(
      (await send("ADD_DOMAIN", { domain: "facebook.com/watch" })).ok,
      false,
    );
    assert.equal(
      (await send("ADD_DOMAIN", { domain: "sms.scpc.com/revenue" })).ok,
      true,
    );
    assert.ok((await state()).domains.includes("sms.scpc.com/revenue"));
    assert.equal(
      (await send("ADD_DOMAIN", { domain: "sms.scpc.com/revenue?secret=1" }))
        .ok,
      false,
    );
    await send("SET_TRACKING", { enabled: true });
    tab = {
      id: 1,
      url: "https://youtube.com/watch",
      incognito: false,
      active: true,
      windowId: 1,
    };
    await state();
    let stamp = 100;
    const navigate = async (kind = "committed", extras = {}) => {
      const details = {
        tabId: tab.id,
        frameId: 0,
        documentId: "document-1",
        timeStamp: ++stamp,
        url: tab.url,
        ...extras,
      };
      events[kind][0](details);
      await state();
      return details;
    };
    const first = await navigate();
    assert.equal(
      (await state()).activity[dayKey(time)]["youtube.com"].visits,
      1,
    );
    events.committed[0](first);
    events.updated[0](tab.id, { status: "complete" }, tab);
    events.alarm[0]({ name: "usage-checkpoint" });
    await state();
    assert.equal(
      (await state()).activity[dayKey(time)]["youtube.com"].visits,
      1,
      "duplicate, complete, and polling events cannot add visits",
    );
    await navigate(); // An actual reload counts.
    tab.url = "https://youtube.com/shorts";
    await navigate("history");
    await navigate("committed", { frameId: 1 });
    assert.equal(
      (await state()).activity[dayKey(time)]["youtube.com"].visits,
      3,
    );

    tab = { ...tab, id: 2, url: "https://x.com/home" };
    events.activated[0]({ tabId: 2, windowId: 1 });
    await state();
    events.activated[0]({ tabId: 2, windowId: 1 });
    await state();
    assert.equal((await state()).activity[dayKey(time)]["x.com"].hops, 1);
    assert.equal((await state()).activity[dayKey(time)]["x.com"].visits, 0);
    tab = { ...tab, id: 1, url: "https://youtube.com/shorts" };
    events.activated[0]({ tabId: 1, windowId: 1 });
    await state();
    assert.equal((await state()).activity[dayKey(time)]["youtube.com"].hops, 1);

    const beforeRestart = structuredClone((await state()).activity);
    for (const name of Object.keys(events)) events[name] = [];
    await import("../background.js?worker-restart");
    assert.deepEqual(
      (await state()).activity,
      beforeRestart,
      "worker restart must not add visits or hops",
    );
    events.activated[0]({ tabId: 1, windowId: 1 });
    await state();
    assert.deepEqual(
      (await state()).activity,
      beforeRestart,
      "duplicate activation after restart must not add hops",
    );

    const beforePaused = structuredClone((await state()).activity);
    await send("SET_TRACKING", { enabled: false });
    await navigate();
    events.activated[0]({ tabId: 1, windowId: 1 });
    await state();
    assert.deepEqual((await state()).activity, beforePaused);
    await send("SET_TRACKING", { enabled: true });
    for (const mode of ["background", "unfocused", "idle", "incognito"]) {
      tab.active = mode !== "background";
      focused = mode !== "unfocused";
      idle = mode === "idle" ? "idle" : "active";
      tab.incognito = mode === "incognito";
      await navigate();
    }
    assert.deepEqual(
      (await state()).activity,
      beforePaused,
      "excluded activity must not add visits",
    );
    tab = { ...tab, active: true, incognito: false };
    focused = true;
    idle = "active";
    await send("ENABLE");
    tab.url = "https://sms.scpc.com/uptime";
    await navigate("history");
    assert.equal(tab.url, "https://sms.scpc.com/uptime");
    tab.url = "https://sms.scpc.com/revenue/monthly";
    await navigate("history");
    assert.ok(
      tab.url.includes("blocked.html?site=sms.scpc.com%2Frevenue"),
      "SPA navigation must redirect only the blocked path",
    );
    events.updated[0](tab.id, { status: "complete" }, tab);
    await state();
    assert.equal(
      (await state()).activity[dayKey(time)]["sms.scpc.com"].blocked,
      1,
    );
    const removal = (
      await send("REQUEST_ACTION", {
        action: { type: "remove", domain: "sms.scpc.com/revenue" },
      })
    ).challenge;
    assert.ok(removal, "path removal must retain the math gate");
    await send("CLEAR_STATS");
    assert.deepEqual((await state()).activity, {});
    assert.equal((await state()).shield.enabled, true);
  } finally {
    Date.now = realNow;
  }
});
