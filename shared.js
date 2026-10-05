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

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
