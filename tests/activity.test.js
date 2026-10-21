import test from "node:test";
import assert from "node:assert/strict";
import { initialState, dayKey } from "../core.js";
import { aggregateActivity } from "../shared.js";
import { upgradeState } from "../playful.js";

test("version 1.1 upgrade retains protection and history without fabricating activity", () => {
  const old = initialState();
  old.version = 2;
  delete old.activity;
  old.domains = ["example.com"];
  old.shield = { enabled: true, startedAt: 12345, totalMs: 999, sessions: [] };
  old.usage = { [dayKey(Date.now())]: { "example.com": 1234 } };
  old.preferences.reminder = "Keep going";
  const expected = structuredClone(old);
  const upgraded = upgradeState(old);
  assert.deepEqual(upgraded, { ...expected, version: 3, activity: {} });
});

test("activity combines counts with legacy time and respects calendar periods", () => {
  const state = initialState();
  const today = dayKey(Date.now());
  const previous = new Date();
  previous.setDate(previous.getDate() - 1);
  const yesterday = dayKey(previous.getTime());
  state.usage = {
    [today]: { "work.test": 2000 },
    [yesterday]: { "youtube.com": 1000 },
  };
  state.activity = {
    [today]: { "youtube.com": { visits: 3, hops: 5, blocked: 1 } },
    [yesterday]: { "youtube.com": { visits: 2, hops: 4, blocked: 0 } },
    "2000-01-01": { "youtube.com": { visits: 100, hops: 100, blocked: 100 } },
  };
  assert.deepEqual(aggregateActivity(state, 1), [
    { host: "work.test", ms: 2000, visits: 0, hops: 0, blocked: 0 },
    { host: "youtube.com", ms: 0, visits: 3, hops: 5, blocked: 1 },
  ]);
  assert.deepEqual(aggregateActivity(state, 7)[1], {
    host: "youtube.com",
    ms: 1000,
    visits: 5,
    hops: 9,
    blocked: 1,
  });
});
