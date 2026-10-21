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

- **Shield:** one click to enable. Default blocked sites include Facebook, Instagram, LinkedIn, X/Twitter, TikTok, Reddit, Threads, Snapchat, Pinterest, Tumblr, Discord, Chess.com, and Lichess. Add up to 200 website or path rules. A domain blocks all paths and subdomains; a URL path blocks only that path and its subpages. Existing matching tabs are redirected when Shield is enabled.
- **Unlock challenge:** turning Shield off requires five three-digit × two-digit multiplication problems and two exact division problems. Check answers individually or together; verified answers are saved for that challenge and survive closing the tab. Each correct answer damages the Distraction Monster. All seven must be correct, followed by a final confirmation. Answers are checked in the background worker. Closing or cancelling keeps Shield on. Challenges expire after 30 minutes; closing Chrome ends a pending challenge.
- **List protection:** adding a website is always allowed. Removing one while Shield is enabled requires the same math challenge. Shield remains on after an approved removal.
- **Protected time:** elapsed time from enabling Shield to successfully disabling it. Includes time while Chrome is closed. Shield state, rules, and start time persist across browser restarts. This measures protection in this Chrome profile, not verified abstinence on all devices.
- **Usage time:** estimates time for the active website in the focused Chrome window while the computer is active. Background tabs, extension pages, Chrome internal pages, other applications, and incognito are excluded. Tracking works while Shield is off too, and can be paused independently.
- **Dashboard:** today's usage, the last seven days, per-website visits, tab hops, blocked encounters and active time, searchable website totals, the last 100 completed Shield sessions, a blocked list, data export, and clearing statistics.

Shield stays on until you complete the challenge; there is no automatic countdown expiry. No keyword blocking is included.

## New in version 1.2

### Block just a section of a website

In **Blocked websites**, enter `sms.scpc.com/revenue` to block `/revenue`, `/revenue/`, and `/revenue/monthly`. `/uptime`, the home page, and `/revenue-other` remain available. Add `sms.scpc.com/uptime` separately to block that section too. Entering only `sms.scpc.com` still blocks the entire website.

Paths are case-sensitive and also apply to subdomains of the entered host. Rules cover HTTP and HTTPS on any port. A trailing slash is normalized away. Query strings and fragments in rule input are rejected with an explanation so they cannot accidentally create a broader rule. Query strings on a visited blocked path do not bypass it. Hash-only routing is not a separate blocking target. For web apps that change the pathname through browser history, navigation is caught after the URL changes; network navigations are redirected by Chrome's request rules.

If you previously added a whole-site rule, remove it before adding a narrower path for that site. The dashboard explains when an existing rule already covers your new entry. Removing either a domain or a path while Shield is on still requires seven math answers.

### See repeated visits and tab hopping

Open **Overview → Your browsing patterns**. Choose **Today** or **This week** and search a domain or a name such as Facebook, YouTube, or Twitter (also finds `x.com`). Summary numbers follow the selected period and search.

- **Visits:** top-level page loads, reloads, and history-based in-app URL changes while that website tab is foreground, Chrome is focused, and the computer is active. Switching to an already-loaded tab does not add a visit. Background loads are excluded. A history update that keeps the URL unchanged can still produce a navigation event and a visit; this is a navigation count, not a count of unique pages.
- **Tab hops:** switches to a different loaded website tab, including returns and moves between Chrome windows. Returning to the same tab after using another application, refreshing the dashboard, and timer checkpoints do not add hops. A new tab with no website loaded yet does not add a per-site hop.
- **Blocked:** blocked-page encounters, including attempts that never become successful visits. Reloading the same blocked tab does not add another; navigating away and trying again does. These can include background tabs redirected when Shield starts. The existing lifetime achievement counter remains independent.
- **Active time:** the existing foreground-time estimate. A long visit with no tab changes can have much more time than a day with many brief hops.

All new daily counters start when this version is installed; old time history is preserved without inventing past counts. The tracking switch pauses time, visits, hops, and daily blocked counts. Shield blocking and its lifetime achievement counter continue. Clear statistics and JSON export include the new counters. No scrolling, typing, search terms, page contents, or passwords are recorded.

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

Version 1.2 adds Chrome's `webNavigation` permission to count navigations and catch blocked paths inside web apps. If Chrome asks you to approve the added permission, review and accept it to continue using the updated extension. Loading a different version folder as a separate unpacked extension may give it a different extension ID and separate data. To retain your history, use the same original folder and Reload; do not remove the old installation. If you choose a fresh install from the version folder instead, disable the older copy so two Shields do not run at once.

## Privacy and permissions

All records stay in `chrome.storage.local` on your device. Temporary tracking checkpoints and pending challenges stay in `chrome.storage.session`. There are no analytics, external fonts, network uploads, content scripts, page scraping, or remotely loaded scripts. Export produces a local JSON file.

| Permission | Purpose |
| --- | --- |
| `declarativeNetRequestWithHostAccess` | Redirect matching website navigations to the local blocked page. |
| `http://*/*`, `https://*/*` | Allow blocking arbitrary websites you add. Chrome may display a broad website-access warning. |
| `tabs` | Identify the foreground domain and redirect already-open blocked sites. Browsing URLs are read transiently; activity history stores per-domain totals. |
| `webNavigation` | Count top-level foreground page loads and history changes, and redirect blocked paths inside web apps. |
| `idle` | Pause usage measurement when the computer is idle or locked. |
| `alarms` | Checkpoint usage approximately every 30 seconds. |
| `storage` | Keep local settings, statistics, and session history. |

Only blocked domains and paths, daily per-domain time/visit/hop/blocked totals, settings, your chosen reminder, Shield session timestamps, achievement counters, and the last twenty unlock receipts are retained. Temporary navigation deduplication IDs are stored in session storage without browsing URLs. `www.` is grouped with the base hostname; other subdomains have separate activity rows. Daily records are automatically trimmed to the latest 90 calendar days when tracking refreshes. Completed session history keeps the last 100 entries. Total protected time includes older sessions until statistics are cleared. Clearing statistics also resets activity counters, badges, and receipts; it keeps the active Shield start time, website list, reminder, and preferences. Uninstalling removes the extension's local storage; export first if you want a backup. Export is a backup for your own records; importing is not included.

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
