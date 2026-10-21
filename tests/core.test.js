import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  normalizeDomain,
  hostnameOf,
  matchesDomain,
  makeChallenge,
  answersMatch,
  addUsage,
  dayKey,
  stopShield,
  buildRules,
  formatDuration,
  normalizeTarget,
  matchingTarget,
  addActivity,
} from "../core.js";

test("path rules preserve URL boundaries and agree with network filters", () => {
  assert.equal(
    normalizeTarget(" HTTPS://WWW.sms.scpc.com/revenue/ "),
    "sms.scpc.com/revenue",
  );
  assert.equal(normalizeTarget("sms.scpc.com/"), "sms.scpc.com");
  assert.equal(normalizeTarget("example.com/café"), "example.com/caf%C3%A9");
  for (const input of [
    "example.com/revenue?q=1",
    "example.com/#/revenue",
    "https://user:pass@example.com/revenue",
    "example.com/" + "a".repeat(1025),
  ])
    assert.throws(() => normalizeTarget(input));
  for (const target of [
    "sms.scpc.com/revenue",
    "sms.scpc.com/a.b+(c)",
    "example.com/caf%C3%A9",
  ]) {
    const rule = buildRules([target], "chrome-extension://test/")[0];
    const pattern = new RegExp(rule.condition.regexFilter);
    const host = target.split("/")[0];
    const path = target.slice(host.length);
    for (const [url, expected] of [
      [`https://${host}${path}`, true],
      [`http://www.${host}${path}/monthly?q=1`, true],
      [`https://${host}:8443${path}?q=1`, true],
      [`https://${host}${path}-other`, false],
      [`https://${host}/uptime`, false],
      [`https://${host}${path.toUpperCase()}`, false],
    ]) {
      assert.equal(!!matchingTarget(url, [target]), expected, url);
      assert.equal(pattern.test(url), expected, `DNR path: ${url}`);
    }
    for (const url of [
      `https://not${host}${path}`,
      `https://${host}.evil.test${path}`,
      `https://other.test/?next=${host}${path}`,
    ])
      assert.equal(matchingTarget(url, [target]), null);
    assert.deepEqual(rule.condition.requestDomains, [host]);
    assert.equal(rule.condition.isUrlFilterCaseSensitive, true);
    assert.ok(rule.action.redirect.url.includes(encodeURIComponent(target)));
  }
});

test("activity splits by local day and keeps only ninety days", () => {
  const activity = {
    "2025-01-01": { "example.com": { visits: 2, hops: 3, blocked: 0 } },
  };
  const before = new Date(2026, 9, 20, 23, 59, 59).getTime();
  addActivity(activity, "youtube.com", "visits", before);
  addActivity(activity, "youtube.com", "hops", before + 2000);
  addActivity(activity, "youtube.com", "blocked", before + 2000);
  assert.deepEqual(activity["2026-10-20"]["youtube.com"], {
    visits: 1,
    hops: 0,
    blocked: 0,
  });
  assert.deepEqual(activity["2026-10-21"]["youtube.com"], {
    visits: 0,
    hops: 1,
    blocked: 1,
  });
  assert.equal(activity["2025-01-01"], undefined);
});

test("domains accept pasted URLs, normalize www, and reject unsafe input", () => {
  assert.equal(
    normalizeDomain(" HTTPS://WWW.Facebook.com/path?x=y "),
    "facebook.com",
  );
  assert.equal(normalizeDomain("example.com."), "example.com");
  assert.equal(normalizeDomain("例え.jp"), "xn--r8jz45g.jp");
  for (const input of [
    "chrome://extensions",
    "javascript:alert(1)",
    "com",
    "bad domain.com",
    "user:password@example.com",
    "-bad.com",
    "https://",
  ])
    assert.throws(() => normalizeDomain(input), input);
});
test("block matching includes subdomains without matching lookalikes or query strings", () => {
  assert.ok(
    matchesDomain(hostnameOf("https://m.facebook.com/page"), ["facebook.com"]),
  );
  assert.ok(
    matchesDomain(hostnameOf("https://www.facebook.com"), ["facebook.com"]),
  );
  assert.equal(
    matchesDomain(hostnameOf("https://notfacebook.com"), ["facebook.com"]),
    false,
  );
  assert.equal(
    matchesDomain(hostnameOf("https://facebook.com.evil.test"), [
      "facebook.com",
    ]),
    false,
  );
  assert.equal(
    matchesDomain(hostnameOf("https://example.com/?facebook.com"), [
      "facebook.com",
    ]),
    false,
  );
  assert.equal(hostnameOf("chrome://extensions"), null);
});
test("every challenge has five multiplications and two exact divisions", () => {
  for (let i = 0; i < 100; i++) {
    const questions = makeChallenge();
    assert.equal(questions.length, 7);
    for (const [index, q] of questions.entries()) {
      const [a, operator, b] = q.text.split(" ");
      assert.equal(operator, index < 5 ? "×" : "÷");
      assert.equal(
        q.answer,
        index < 5 ? Number(a) * Number(b) : Number(a) / Number(b),
      );
      assert.ok(Number.isInteger(q.answer));
    }
    assert.ok(
      answersMatch(
        questions,
        questions.map((q) => String(q.answer)),
      ),
    );
    assert.equal(
      answersMatch(
        questions,
        questions.map(() => "0"),
      ),
      false,
    );
    assert.equal(
      answersMatch(
        questions,
        questions.map((q) => `${q.answer}e0`),
      ),
      false,
    );
    assert.equal(answersMatch(questions, []), false);
  }
});
test("accounting splits at local midnight and caps sleep or delayed alarm gaps", () => {
  const usage = {},
    end = new Date(2026, 9, 5, 0, 0, 10).getTime();
  addUsage(usage, "example.com", end - 20_000, end);
  assert.equal(usage["2026-10-04"]["example.com"], 10_000);
  assert.equal(usage["2026-10-05"]["example.com"], 10_000);
  addUsage(usage, "sleep.test", end - 3_600_000, end);
  assert.equal(
    Object.values(usage).reduce(
      (sum, row) => sum + (row["sleep.test"] || 0),
      0,
    ),
    45_000,
  );
  addUsage(usage, "backward.test", end, end - 1000);
  assert.equal(usage["2026-10-05"]["backward.test"], undefined);
});
test("old usage expires and disabling records one session once", () => {
  const usage = { "2025-01-01": { "example.com": 3000 } };
  const time = new Date(2026, 9, 5, 12).getTime();
  addUsage(usage, "example.com", time - 1000, time);
  assert.equal(usage["2025-01-01"], undefined);
  assert.equal(usage[dayKey(time)]["example.com"], 1000);
  const { shield } = initialState();
  shield.enabled = true;
  shield.startedAt = time;
  stopShield(shield, time + 90_000);
  stopShield(shield, time + 120_000);
  assert.equal(shield.totalMs, 90_000);
  assert.equal(shield.sessions.length, 1);
  assert.equal(shield.enabled, false);
  assert.equal(shield.startedAt, null);
});
test("rules target only matching domains and main-frame navigations", () => {
  const rules = buildRules(
    ["x.com", "lichess.org"],
    "chrome-extension://test/",
  );
  assert.deepEqual(
    rules.map((rule) => rule.id),
    [1, 2],
  );
  assert.deepEqual(rules[0].condition, {
    requestDomains: ["x.com"],
    resourceTypes: ["main_frame"],
  });
  assert.equal(
    rules[1].action.redirect.url,
    "chrome-extension://test/blocked.html?site=lichess.org",
  );
  assert.equal(formatDuration(3_661_000, true), "01:01:01");
});
