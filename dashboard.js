import {
  $,
  send,
  withButton,
  requestAction,
  shieldElapsed,
  formatDuration,
  dayKey,
  aggregateUsage,
  aggregateActivity,
  el,
  showError,
  renderReceipt,
} from "./shared.js";
import { BADGES } from "./playful.js";
import { renderMascot, renderReminder } from "./mascot.js";
let state,
  days = 1;

function renderTimers() {
  if (!state) return;
  $("#timer").textContent = formatDuration(shieldElapsed(state), true);
  $("#total-protected").textContent = formatDuration(
    state.shield.totalMs + shieldElapsed(state),
  );
}

function renderUsage() {
  const all = aggregateActivity(state, days),
    root = $("#usage-list");
  const search = $("#site-search").value.trim().toLowerCase();
  const rows = all.filter(
    ({ host }) =>
      host.includes(search) || (host === "x.com" && "twitter".includes(search)),
  );
  $("#period-visits").textContent = rows
    .reduce((n, row) => n + row.visits, 0)
    .toLocaleString();
  $("#period-hops").textContent = rows
    .reduce((n, row) => n + row.hops, 0)
    .toLocaleString();
  $("#period-blocked").textContent = rows
    .reduce((n, row) => n + row.blocked, 0)
    .toLocaleString();
  $("#activity-scope").textContent =
    `${days === 1 ? "Today" : "Last 7 days"}${search ? " · matching websites" : " · all websites"}${state.tracking ? "" : " · tracking paused"}`;
  root.replaceChildren();
  if (!rows.length) {
    root.append(
      el(
        "div",
        "empty",
        search
          ? "No matching websites in this period."
          : "Browse a website to start seeing your time, visits, and tab hops here.",
      ),
    );
    return;
  }
  const header = el("div", "activity-row table-label");
  header.append(
    el("span", "", "WEBSITE"),
    el("span", "", "VISITS"),
    el("span", "", "TAB HOPS"),
    el("span", "", "BLOCKED"),
    el("span", "", "ACTIVE TIME"),
  );
  root.append(header);
  for (const { host, ms, visits, hops, blocked } of rows) {
    const row = el("div", "activity-row"),
      name = el("div", "site-name");
    name.append(
      el("span", "site-avatar", host[0].toUpperCase()),
      el("span", "", host),
    );
    row.append(name);
    for (const [label, value] of [
      ["Visits", visits],
      ["Tab hops", hops],
      ["Blocked", blocked],
      ["Active time", formatDuration(ms)],
    ]) {
      const cell = el(
        "strong",
        "activity-value",
        typeof value === "number" ? value.toLocaleString() : value,
      );
      cell.dataset.label = label;
      cell.setAttribute("aria-label", `${label}: ${value}`);
      row.append(cell);
    }
    root.append(row);
  }
}

function renderWeek() {
  const root = $("#week-chart");
  root.replaceChildren();
  const points = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    return {
      date,
      ms: Object.values(state.usage[dayKey(date.getTime())] || {}).reduce(
        (sum, ms) => sum + ms,
        0,
      ),
    };
  });
  const max = Math.max(1, ...points.map((point) => point.ms));
  for (const { date, ms } of points) {
    const column = el("div", "chart-column"),
      track = el("div", "chart-track"),
      bar = el("div", "chart-bar");
    bar.style.height = `${ms ? Math.max(3, (ms / max) * 100) : 0}%`;
    if (dayKey(date.getTime()) === dayKey(Date.now()))
      bar.classList.add("today");
    track.append(bar);
    column.append(
      el("span", "chart-value", formatDuration(ms)),
      track,
      el(
        "span",
        "chart-day",
        date.toLocaleDateString(undefined, { weekday: "short" }),
      ),
    );
    column.title = `${date.toLocaleDateString()}: ${formatDuration(ms)}`;
    root.append(column);
  }
}

function renderDomains() {
  const root = $("#domain-list");
  root.replaceChildren();
  $("#domain-count").textContent = state.domains.length;
  $("#list-hint").textContent = state.shield.enabled
    ? "Removing a website requires 7 correct math answers."
    : "Shield is off. You can edit your list freely.";
  if (!state.domains.length)
    root.append(
      el("div", "empty", "Add a website to start your blocked list."),
    );
  for (const domain of state.domains) {
    const card = el("div", "card domain-card"),
      details = el("div", "site-name");
    const label = el("div", "target-label");
    label.append(
      el("strong", "", domain),
      el(
        "small",
        "muted",
        domain.includes("/")
          ? "This path and its subpages"
          : "Entire website and subdomains",
      ),
    );
    details.append(el("span", "site-avatar", domain[0].toUpperCase()), label);
    const remove = el("button", "remove-button", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${domain}`);
    remove.addEventListener("click", () =>
      withButton(remove, async () => {
        await requestAction({ type: "remove", domain });
        await reload();
      }),
    );
    card.append(details, remove);
    root.append(card);
  }
}

function renderSessions() {
  const root = $("#session-list");
  root.replaceChildren();
  if (!state.shield.sessions.length) {
    root.append(
      el("div", "empty", "Your completed Shield sessions will appear here."),
    );
    return;
  }
  for (const session of state.shield.sessions) {
    const row = el("div", "session-row"),
      label = el("div");
    label.append(
      el(
        "strong",
        "",
        new Date(session.startedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      ),
      el(
        "p",
        "muted small",
        `${new Date(session.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} → ${new Date(session.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      ),
    );
    row.append(
      label,
      el("strong", "session-duration", formatDuration(session.durationMs)),
    );
    root.append(row);
  }
}

function render() {
  const active = state.shield.enabled;
  renderMascot(
    $("#dashboard-mascot"),
    state.preferences,
    active ? "resting" : "happy",
    active
      ? "Milo is enjoying the quiet."
      : "Milo is ready for your next session.",
  );
  $(".shield-emblem").classList.toggle("has-mascot", state.preferences.playful);
  renderReminder(
    $("#session-reminder"),
    active ? state.preferences.reminder : "",
  );
  $("#playful").checked = state.preferences.playful;
  $("#meme-effects").checked = state.preferences.memeEffects;
  if (
    document.activeElement !== $("#reminder") &&
    !$("#reminder").dataset.dirty
  )
    $("#reminder").value = state.preferences.reminder;
  renderAchievements();
  renderReceipts();
  $("#date-label").textContent = new Date()
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
  $("#status").textContent = active ? "Shield is active" : "Shield is off";
  $("#status").classList.toggle("on", active);
  $("#live-dot").classList.toggle("active", active);
  $("#shield-heading").textContent = active
    ? "Your focus is protected."
    : "Ready when you are.";
  $("#shield-description").textContent = active
    ? `${state.domains.length} website and path rules protecting your focus.`
    : "Switch on your Shield and step away from distraction.";
  $("#clock-label").textContent = active
    ? "CURRENT SHIELD SESSION"
    : "YOUR NEXT SESSION STARTS HERE";
  $("#toggle").textContent = active ? "Turn off Shield" : "Enable Shield";
  $("#toggle").disabled = false;
  $("#shield-hint").textContent = active
    ? "Turning off takes 7 correct math answers."
    : "One click to start. Seven answers to stop.";
  $("#site-count").textContent = state.domains.length;
  $("#session-count").textContent = state.shield.sessions.length;
  $("#today-total").textContent = formatDuration(
    aggregateUsage(state, 1).reduce((sum, [, ms]) => sum + ms, 0),
  );
  $("#tracking-summary").textContent = state.tracking
    ? "Active browsing across websites"
    : "Usage tracking is paused";
  $("#tracking").checked = state.tracking;
  renderTimers();
  renderUsage();
  renderWeek();
  renderDomains();
  renderSessions();
}
function renderAchievements() {
  $("#achievement-card").hidden = !state.preferences.playful;
  const root = $("#achievement-list");
  root.replaceChildren();
  $("#badge-count").textContent =
    `${BADGES.filter((badge) => state.milestones.earned[badge.id]).length} / 3`;
  $("#blocked-count").textContent =
    `${state.milestones.blockedVisits} blocked-page encounters. Reloading the same blocked tab does not add another.`;
  for (const badge of BADGES) {
    const earned = state.milestones.earned[badge.id],
      card = el("article", `achievement${earned ? " earned" : ""}`);
    const icon = el("span", "badge-icon", badge.icon);
    icon.setAttribute("aria-hidden", "true");
    card.append(
      icon,
      el("h3", "", badge.title),
      el("p", "small muted", badge.description),
      el(
        "span",
        "badge-state",
        earned
          ? `Earned ${new Date(earned).toLocaleDateString()}`
          : `${Math.min(state.milestones[badge.counter], badge.target)} / ${badge.target}`,
      ),
    );
    root.append(card);
  }
}
function renderReceipts() {
  $("#receipts-card").hidden = !state.preferences.playful;
  const root = $("#receipt-list");
  root.replaceChildren();
  if (!state.receipts.length)
    root.append(
      el(
        "div",
        "empty",
        "Your first seven-answer unlock will leave a receipt here.",
      ),
    );
  for (const receipt of state.receipts) {
    const details = el("details", "receipt-details"),
      summary = el(
        "summary",
        "",
        `${new Date(receipt.time).toLocaleString()} · ${receipt.action === "remove" ? `Allowed ${receipt.domain}` : "Shield turned off"}`,
      ),
      content = el("div", "escape-receipt");
    renderReceipt(content, receipt);
    details.append(summary, content);
    root.append(details);
  }
}
async function reload() {
  state = (await send("GET_STATE")).state;
  render();
}

for (const button of document.querySelectorAll("[data-panel]"))
  button.addEventListener("click", () => {
    for (const tab of document.querySelectorAll("[data-panel]")) {
      const selected = tab === button;
      tab.classList.toggle("selected", selected);
      if (selected) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    }
    for (const panel of document.querySelectorAll(".panel"))
      panel.hidden = panel.id !== button.dataset.panel;
    $("#page-label").textContent = button.textContent.trim().slice(2).trim();
  });
for (const button of document.querySelectorAll("[data-days]"))
  button.addEventListener("click", () => {
    days = Number(button.dataset.days);
    for (const option of document.querySelectorAll("[data-days]")) {
      option.classList.toggle("selected", option === button);
      option.setAttribute("aria-pressed", String(option === button));
    }
    if (state) renderUsage();
  });
$("#site-search").addEventListener("input", () => {
  if (state) renderUsage();
});
$("#toggle").addEventListener("click", () =>
  withButton($("#toggle"), async () => {
    if (state.shield.enabled) await requestAction({ type: "disable" });
    else await send("ENABLE");
    await reload();
  }),
);
$("#add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  withButton($("#add-button"), async () => {
    await send("ADD_DOMAIN", { domain: $("#domain").value });
    $("#domain").value = "";
    await reload();
  });
});
$("#tracking").addEventListener("change", async () => {
  const enabled = $("#tracking").checked;
  $("#tracking").disabled = true;
  try {
    await send("SET_TRACKING", { enabled });
    await reload();
  } catch (error) {
    $("#tracking").checked = state.tracking;
    showError(error);
  } finally {
    $("#tracking").disabled = false;
  }
});
$("#export").addEventListener("click", () =>
  withButton($("#export"), async () => {
    await reload();
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), ...state },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = el("a");
    link.href = url;
    link.download = `mind-shield-${dayKey(Date.now())}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }),
);
$("#clear").addEventListener("click", () => {
  if (
    confirm(
      "Clear website time, visit counts, tab hops, blocked counts, completed Shield history, badges, and receipts? Your active Shield timer, blocked websites, reminder, and preferences will be kept.",
    )
  )
    withButton($("#clear"), async () => {
      await send("CLEAR_STATS");
      await reload();
    });
});
for (const id of ["playful", "meme-effects"])
  $("#" + id).addEventListener("change", async () => {
    const control = $("#" + id);
    control.disabled = true;
    try {
      await send("SET_PREFERENCES", {
        ...state.preferences,
        playful: $("#playful").checked,
        memeEffects: $("#meme-effects").checked,
      });
      await reload();
    } catch (error) {
      render();
      showError(error);
    } finally {
      control.disabled = false;
    }
  });
$("#reminder").addEventListener("input", () => {
  $("#reminder").dataset.dirty = "true";
  $("#reminder-status").textContent = "Unsaved changes";
});
$("#reminder-form").addEventListener("submit", (event) => {
  event.preventDefault();
  withButton($("#save-reminder"), async () => {
    await send("SET_PREFERENCES", {
      ...state.preferences,
      reminder: $("#reminder").value,
    });
    delete $("#reminder").dataset.dirty;
    await reload();
    $("#reminder-status").textContent = state.preferences.reminder
      ? "Reminder saved."
      : "Reminder removed.";
  });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.state) {
    state = changes.state.newValue;
    render();
  }
});
reload().catch(showError);
setInterval(renderTimers, 1000);
setInterval(() => {
  if (!document.hidden) reload().catch(showError);
}, 30_000);
