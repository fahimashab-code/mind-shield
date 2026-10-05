# Mind Shield

A private, local-only Chrome extension to give your attention a little more space.

## Install in Chrome

1. Download or clone this repository into a permanent folder.
2. Open `chrome://extensions` in Chrome 120 or newer.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository folder containing `manifest.json`.
5. Pin **Mind Shield** from Chrome's extensions menu. Click its icon to enable Shield or open the dashboard.

There is no build step, server, account, or runtime dependency. Keep the folder in place. After pulling updates, click the extension's Reload button on `chrome://extensions` and reopen its pages. Publishing to the Chrome Web Store is not required for personal use.

## How it works

- **Shield:** one click to enable. Default blocked sites include Facebook, Instagram, LinkedIn, X/Twitter, TikTok, Reddit, Threads, Snapchat, Pinterest, Tumblr, Discord, Chess.com, and Lichess. Domains include all paths and subdomains. Add up to 200 websites. Existing tabs on blocked sites are redirected when Shield is enabled.
- **Unlock challenge:** turning Shield off requires five three-digit × two-digit multiplication problems and two exact division problems. All seven answers must be correct. Answers are checked in the extension's background worker. Closing or cancelling the challenge keeps Shield on. Challenges expire after 30 minutes.
- **List protection:** adding a website is always allowed. Removing one while Shield is enabled requires the same math challenge. Shield remains on after an approved removal.
- **Protected time:** elapsed time from enabling Shield to successfully disabling it. Includes time while Chrome is closed. Shield state, rules, and start time persist across browser restarts. This measures protection in this Chrome profile, not verified abstinence on all devices.
- **Usage time:** estimates time for the active website in the focused Chrome window while the computer is active. Background tabs, extension pages, Chrome internal pages, other applications, and incognito are excluded. Tracking works while Shield is off too, and can be paused independently.
- **Dashboard:** today's usage, the last seven days, website totals, the last 100 completed Shield sessions, a blocked website list, data export, and clearing statistics.

Shield stays on until you complete the challenge; there is no automatic countdown expiry. No keyword blocking is included.

## Privacy and permissions

All records stay in `chrome.storage.local` on your device. Temporary tracking checkpoints and pending challenges stay in `chrome.storage.session`. There are no analytics, external fonts, network uploads, content scripts, page scraping, or remotely loaded scripts. Export produces a local JSON file.

| Permission | Purpose |
| --- | --- |
| `declarativeNetRequestWithHostAccess` | Redirect matching website navigations to the local blocked page. |
| `http://*/*`, `https://*/*` | Allow blocking arbitrary websites you add. Chrome may display a broad website-access warning. |
| `tabs` | Identify the foreground domain and redirect already-open blocked sites. Full URLs are read transiently; only hostnames are saved. |
| `idle` | Pause usage measurement when the computer is idle or locked. |
| `alarms` | Checkpoint usage approximately every 30 seconds. |
| `storage` | Keep local settings, statistics, and session history. |

Only domain names, daily time totals, settings, and Shield session timestamps are retained. `www.` is grouped with the base hostname; other subdomains have separate usage rows. Usage is automatically trimmed to the latest 90 calendar days when usage is recorded. Completed session history keeps the last 100 entries. Total protected time includes older sessions until statistics are cleared. Clearing statistics keeps the active Shield start time and website list. Uninstalling removes the extension's local storage; export first if you want a backup. Export is a backup for your own records; importing is not included.

## Limits and measurement details

- Chrome itself lets you disable or uninstall extensions without the math challenge. This is a voluntary focus tool. Other profiles, browsers, devices, and incognito are outside its scope.
- A 60-second idle threshold means a brief idle period may still count. Passive reading without mouse/keyboard input can be marked idle. Usage is an estimate, not a measure of attention.
- Time is checkpointed on tab, navigation, window, and idle events, and approximately every 30 seconds. Delayed alarms, crashes, or sleep can lose a small amount of usage. Any single delayed interval credits at most 45 seconds, avoiding hours attributed to a sleeping computer. The last small interval before browser shutdown may be lost.
- Daily buckets use the operating system's local timezone. Clock or timezone changes can affect statistics. Shield duration uses the system clock.
- Domain blocking covers top-level website navigation and already-open tabs. Embedded widgets, installed mobile/desktop apps, proxies, and other browsers are outside scope.
- Chrome enterprise policies or other extensions may affect loading or navigation behavior.

## Development

Plain JavaScript modules, HTML, CSS, and Manifest V3. No framework and no dependency installation.

```powershell
npm test
npm run check
```

Node.js 22 or newer is only needed for the developer checks, not to install or use the extension. `npm test` checks domain matching, math validation, time accounting, and background-worker behavior using a mocked Chrome API. Browser verification is described in `VALIDATION.md`.

Key files: `manifest.json` (Chrome permissions), `background.js` (rules and accounting), `core.js` (shared logic), `popup.*` (toolbar controls), `dashboard.*` (statistics and settings), `challenge.*` (math gate), `blocked.*` (focus page), and `styles.css` (interface).

## Security boundary

Ordinary websites cannot directly enable/disable Shield or submit an unlock: mutation messages are restricted to the extension's popup, dashboard, and challenge pages. The web-accessible blocked page is excluded from this allowlist. Challenge answers are not returned to the UI. Storage access is restricted to trusted extension contexts.

Someone controlling the browser, extension source, DevTools, or local storage can bypass a personal extension. Math questions deliberately add friction and cannot make it tamper-proof.
