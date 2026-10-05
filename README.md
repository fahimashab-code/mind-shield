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
- **Unlock challenge:** turning Shield off requires five three-digit × two-digit multiplication problems and two exact division problems. Check answers individually or together; verified answers are saved for that challenge and survive closing the tab. Each correct answer damages the Distraction Monster. All seven must be correct, followed by a final confirmation. Answers are checked in the background worker. Closing or cancelling keeps Shield on. Challenges expire after 30 minutes; closing Chrome ends a pending challenge.
- **List protection:** adding a website is always allowed. Removing one while Shield is enabled requires the same math challenge. Shield remains on after an approved removal.
- **Protected time:** elapsed time from enabling Shield to successfully disabling it. Includes time while Chrome is closed. Shield state, rules, and start time persist across browser restarts. This measures protection in this Chrome profile, not verified abstinence on all devices.
- **Usage time:** estimates time for the active website in the focused Chrome window while the computer is active. Background tabs, extension pages, Chrome internal pages, other applications, and incognito are excluded. Tracking works while Shield is off too, and can be paused independently.
- **Dashboard:** today's usage, the last seven days, website totals, the last 100 completed Shield sessions, a blocked website list, data export, and clearing statistics.

Shield stays on until you complete the challenge; there is no automatic countdown expiry. No keyword blocking is included.

## Personality in version 1.1

- **Milo the Shield:** rests during sessions, smiles when off, and raises an eyebrow on blocked pages.
- **Blocked-page jokes:** a random gentle message, including website-specific jokes.
- **Boss battle:** seven points of monster health, reduced by verified math answers. Progress is saved; incorrect answers do not unlock anything.
- **Achievement collection:** First Shield Session for enabling Shield; Math Escape Artist for a successful math unlock; Professional Tab Resister after five blocked-page encounters. Reloading the same blocked tab does not add another encounter. Existing completed sessions count toward the first two badges during upgrade.
- **Escape receipts:** a local record after successful math unlocks, including the choice, session duration, and seven calculations. The dashboard keeps the last twenty; expand a receipt to read it.
- **A reminder from yourself:** save up to 240 characters in Settings & privacy. It appears in the popup, active session card, and blocked page. Clearing the text removes it.
- **Crying GIF effects:** the supplied animated GIF appears twice, then one more copy every 1.8 seconds up to twelve, in mixed sizes around challenge and blocked pages. At narrow widths, copies form a gallery below the controls. Effects pause in hidden tabs and restart on returning. They stop after unlocking, and are suppressed by the device's reduced-motion setting.

Settings & privacy has separate switches for Playful mode and Crying GIF effects. Playful mode controls mascot, jokes, boss, badge/receipt presentation, and GIFs. Your reminder and the seven-answer protection work in either mode. Turning presentation off retains earned milestones and receipts. There are no sounds or notifications; all images are bundled locally.

### Update an existing installation

Keep the **same extension folder** used for Load unpacked. Pull this repository or replace that folder's contents with the new ZIP contents, then click Mind Shield's **Reload** button at `chrome://extensions`. Close old extension pages and reopen the popup/dashboard. The upgrade preserves your blocked list, usage, active Shield start time, and saved sessions. Removing and reinstalling deletes extension data; it is unnecessary for this update.

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

Only domain names, daily time totals, settings, your chosen reminder, Shield session timestamps, achievement counters, and the last twenty unlock receipts are retained. `www.` is grouped with the base hostname; other subdomains have separate usage rows. Usage is automatically trimmed to the latest 90 calendar days when usage is recorded. Completed session history keeps the last 100 entries. Total protected time includes older sessions until statistics are cleared. Clearing statistics also resets badges and receipts; it keeps the active Shield start time, website list, reminder, and preferences. Uninstalling removes the extension's local storage; export first if you want a backup. Export is a backup for your own records; importing is not included.

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
