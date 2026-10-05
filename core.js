export const DEFAULT_DOMAINS = [
  "facebook.com",
  "fb.com",
  "messenger.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "reddit.com",
  "threads.net",
  "threads.com",
  "snapchat.com",
  "pinterest.com",
  "tumblr.com",
  "discord.com",
  "chess.com",
  "lichess.org",
];
export const MAX_DOMAINS = 200;
export const CHECKPOINT_LIMIT_MS = 45_000;

export function initialState() {
  return {
    version: 2,
    shield: { enabled: false, startedAt: null, totalMs: 0, sessions: [] },
    domains: [...DEFAULT_DOMAINS],
    tracking: true,
    usage: {},
    preferences: { playful: true, memeEffects: true, reminder: "" },
    milestones: {
      sessionsStarted: 0,
      mathUnlocks: 0,
      blockedVisits: 0,
      earned: {},
    },
    receipts: [],
  };
}

export function normalizeDomain(input) {
  if (typeof input !== "string" || input.length > 2048)
    throw new Error("Enter a valid website domain.");
  const text = input.trim();
  let url;
  try {
    url = new URL(text.includes("://") ? text : `https://${text}`);
  } catch {
    throw new Error("Enter a domain such as example.com.");
  }
  const host = url.hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    host.length > 253 ||
    !host.includes(".") ||
    !host
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    throw new Error("Enter a valid HTTP or HTTPS website domain.");
  }
  return host;
}

export function hostnameOf(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.hostname
          .toLowerCase()
          .replace(/^www\./, "")
          .replace(/\.$/, "")
      : null;
  } catch {
    return null;
  }
}

export function matchesDomain(host, domains) {
  return (
    !!host &&
    domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
  );
}

export function buildRules(domains, extensionUrl) {
  return domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        url: `${extensionUrl}blocked.html?site=${encodeURIComponent(domain)}`,
      },
    },
    condition: { requestDomains: [domain], resourceTypes: ["main_frame"] },
  }));
}

export function makeChallenge(
  random = (max) => crypto.getRandomValues(new Uint32Array(1))[0] % max,
) {
  const questions = [];
  for (let i = 0; i < 5; i++) {
    const a = 100 + random(900),
      b = 12 + random(88);
    questions.push({ text: `${a} × ${b}`, answer: a * b });
  }
  for (let i = 0; i < 2; i++) {
    const divisor = 12 + random(88),
      quotient = 100 + random(900);
    questions.push({
      text: `${divisor * quotient} ÷ ${divisor}`,
      answer: quotient,
    });
  }
  return questions;
}

export function answersMatch(questions, answers) {
  return (
    Array.isArray(answers) &&
    answers.length === 7 &&
    questions.length === 7 &&
    questions.every(
      (q, i) =>
        typeof answers[i] === "string" &&
        /^\d{1,8}$/.test(answers[i].trim()) &&
        Number(answers[i].trim()) === q.answer,
    )
  );
}

export function dayKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addUsage(usage, host, start, end) {
  if (!host || end <= start) return;
  // A delayed alarm or computer sleep must never credit hours to an abandoned tab.
  let cursor = Math.max(start, end - CHECKPOINT_LIMIT_MS);
  while (cursor < end) {
    const next = new Date(cursor);
    next.setHours(24, 0, 0, 0);
    const stop = Math.min(end, next.getTime()),
      day = dayKey(cursor);
    usage[day] ??= {};
    usage[day][host] = (usage[day][host] ?? 0) + stop - cursor;
    cursor = stop;
  }
  const cutoff = new Date(end);
  cutoff.setDate(cutoff.getDate() - 89);
  const keepFrom = dayKey(cutoff.getTime());
  for (const day of Object.keys(usage)) if (day < keepFrom) delete usage[day];
}

export function stopShield(shield, now) {
  if (!shield.enabled) return;
  const durationMs = Math.max(0, now - shield.startedAt);
  shield.totalMs += durationMs;
  shield.sessions.unshift({
    startedAt: shield.startedAt,
    endedAt: now,
    durationMs,
  });
  shield.sessions = shield.sessions.slice(0, 100);
  shield.enabled = false;
  shield.startedAt = null;
}

export function formatDuration(ms, clock = false) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(seconds / 3600),
    m = Math.floor(seconds / 60) % 60,
    s = seconds % 60;
  if (clock)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}
