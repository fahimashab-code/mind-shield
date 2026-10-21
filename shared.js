import { formatDuration, dayKey } from "./core.js";
export { formatDuration, dayKey };
export const $ = (selector) => document.querySelector(selector);

export async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok)
    throw new Error(
      response?.error ||
        "Mind Shield is unavailable. Reload the extension and try again.",
    );
  return response;
}

export function showError(error) {
  const element = $("#notice");
  element.textContent = error.message || String(error);
  element.hidden = false;
}

export async function withButton(button, task) {
  button.disabled = true;
  $("#notice").hidden = true;
  try {
    await task();
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
}

export async function openDashboard() {
  await chrome.runtime.openOptionsPage();
}
export async function requestAction(action) {
  const response = await send("REQUEST_ACTION", { action });
  if (!response.completed)
    await chrome.tabs.create({ url: chrome.runtime.getURL("challenge.html") });
  return response;
}

export function shieldElapsed(state) {
  return state.shield.enabled
    ? Math.max(0, Date.now() - state.shield.startedAt)
    : 0;
}

export function aggregateUsage(state, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  const from = dayKey(cutoff.getTime()),
    to = dayKey(Date.now()),
    totals = {};
  for (const [day, sites] of Object.entries(state.usage))
    if (day >= from && day <= to)
      for (const [host, ms] of Object.entries(sites))
        totals[host] = (totals[host] || 0) + ms;
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

export function aggregateActivity(state, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  const from = dayKey(cutoff.getTime()),
    to = dayKey(Date.now());
  const totals = new Map(
    aggregateUsage(state, days).map(([host, ms]) => [
      host,
      { host, ms, visits: 0, hops: 0, blocked: 0 },
    ]),
  );
  for (const [day, sites] of Object.entries(state.activity || {})) {
    if (day < from || day > to) continue;
    for (const [host, counts] of Object.entries(sites)) {
      if (!totals.has(host))
        totals.set(host, { host, ms: 0, visits: 0, hops: 0, blocked: 0 });
      for (const kind of ["visits", "hops", "blocked"])
        totals.get(host)[kind] += counts[kind] || 0;
    }
  }
  return [...totals.values()].sort(
    (a, b) =>
      b.ms - a.ms ||
      b.visits - a.visits ||
      b.hops - a.hops ||
      a.host.localeCompare(b.host),
  );
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderReceipt(root, receipt) {
  root.replaceChildren();
  root.append(
    el("p", "eyebrow", "MIND SHIELD · ESCAPE RECEIPT"),
    el("h2", "", "Seven calculations completed."),
  );
  const list = el("dl", "receipt-fields");
  const fields = [
    ["Issued", new Date(receipt.time).toLocaleString()],
    [
      "Your choice",
      receipt.action === "remove"
        ? `Allow ${receipt.domain}`
        : "Turn off Shield",
    ],
    [
      receipt.shieldStillOn ? "Protected so far" : "Protected this session",
      formatDuration(receipt.protectedMs),
    ],
    ["Math completed", "5 multiplications + 2 divisions"],
    [
      "Shield",
      receipt.shieldStillOn
        ? "Still protecting other websites"
        : "Off — session saved",
    ],
  ];
  for (const [label, value] of fields)
    list.append(el("dt", "", label), el("dd", "", value));
  root.append(
    list,
    el("p", "receipt-footer", "Please spend this freedom wisely."),
  );
}
