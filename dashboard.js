import {
  $,
  send,
  withButton,
  requestAction,
  shieldElapsed,
  formatDuration,
  dayKey,
  aggregateUsage,
  el,
  showError,
} from "./shared.js";
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
  const rows = aggregateUsage(state, days),
    root = $("#usage-list");
  root.replaceChildren();
  if (!rows.length) {
    root.append(
      el(
        "div",
        "empty",
        "Your time has a clean slate. Browse a website to see it here.",
      ),
    );
    return;
  }
  const total = rows.reduce((sum, [, ms]) => sum + ms, 0);
  const header = el("div", "usage-row table-label");
  header.append(
    el("span", "", "WEBSITE"),
    el("span", "", "SHARE OF TIME"),
    el("span", "", "ACTIVE TIME"),
  );
  root.append(header);
  for (const [host, ms] of rows) {
    const row = el("div", "usage-row"),
      name = el("div", "site-name");
    name.append(
      el("span", "site-avatar", host[0].toUpperCase()),
      el("span", "", host),
    );
    const meter = el("div", "meter"),
      fill = el("div", "meter-fill");
    fill.style.width = `${(ms / total) * 100}%`;
    meter.append(fill);
    meter.setAttribute(
      "aria-label",
      `${Math.round((ms / total) * 100)} percent of browsing time`,
    );
    row.append(name, meter, el("strong", "time-value", formatDuration(ms)));
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
    details.append(
      el("span", "site-avatar", domain[0].toUpperCase()),
      el("strong", "", domain),
    );
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
    ? `${state.domains.length} websites out of your way. Make this time yours.`
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
      "Clear website usage and completed Shield history? Your active Shield timer and blocked websites will be kept.",
    )
  )
    withButton($("#clear"), async () => {
      await send("CLEAR_STATS");
      await reload();
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
