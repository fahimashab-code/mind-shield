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
    version: 3,
    shield: { enabled: false, startedAt: null, totalMs: 0, sessions: [] },
    domains: [...DEFAULT_DOMAINS],
    tracking: true,
    usage: {},
    activity: {},
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

// Keep legacy domain-only entries intact; a path is an explicit, narrower rule.
export function normalizeTarget(input) {
  const host = normalizeDomain(input);
  const text = input.trim();
  const url = new URL(text.includes("://") ? text : `https://${text}`);
  if (url.search || url.hash)
    throw new Error(
      "Use a domain or URL path without a query (?) or fragment (#).",
    );
  const path = url.pathname.replace(/\/+$/, "");
  if (path.length > 1024)
    throw new Error("That path is too long. Use a shorter URL path.");
  return host + path;
}

export function matchingTarget(url, targets) {
  const host = hostnameOf(url);
  if (!host) return null;
  const path = new URL(url).pathname;
  return (
    targets.find((target) => {
      const slash = target.indexOf("/");
      const domain = slash < 0 ? target : target.slice(0, slash);
      const prefix = slash < 0 ? "" : target.slice(slash);
      return (
        matchesDomain(host, [domain]) &&
        (!prefix || path === prefix || path.startsWith(`${prefix}/`))
      );
    }) ?? null
  );
}

export function matchesDomain(host, domains) {
  return (
    !!host &&
    domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
  );
}

export function buildRules(domains, extensionUrl) {
  return domains.map((domain, index) => {
    const slash = domain.indexOf("/");
    const host = slash < 0 ? domain : domain.slice(0, slash);
    const path = slash < 0 ? "" : domain.slice(slash);
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
      id: index + 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: `${extensionUrl}blocked.html?site=${encodeURIComponent(domain)}`,
        },
      },
      condition: {
        requestDomains: [host],
        resourceTypes: ["main_frame"],
        ...(path
          ? {
              regexFilter: `^https?://[^/]+${escaped}([/?#]|$)`,
              isUrlFilterCaseSensitive: true,
            }
          : {}),
      },
    };
  });
}

export function pruneDaily(records, time) {
  const cutoff = new Date(time);
  cutoff.setDate(cutoff.getDate() - 89);
  const keepFrom = dayKey(cutoff.getTime());
  for (const day of Object.keys(records))
    if (day < keepFrom) delete records[day];
}

export function addActivity(activity, host, kind, time) {
  if (!host || !["visits", "hops", "blocked"].includes(kind)) return;
  const day = dayKey(time);
  activity[day] ??= {};
  activity[day][host] ??= { visits: 0, hops: 0, blocked: 0 };
  activity[day][host][kind] += 1;
  pruneDaily(activity, time);
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
  pruneDaily(usage, end);
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
