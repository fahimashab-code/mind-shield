# Validation

## Version 1.2 — 21 October 2026

- `npm test`: **15 tests passed**. Added checks for path normalization, exact path/subpage boundaries, case sensitivity, escaped regex characters, invalid query/fragment input, daily retention, version 1.1 migration, Today/week aggregation, foreground visit counting, reload and history navigation, duplicate events, tab hops, worker restart, paused/background/idle/incognito exclusions, path removal challenges, and clearing counters. Existing protection, math, rollback, and playful-mode tests also pass.
- `npm run check`: manifest resources, JavaScript syntax, local HTML references, and the no-inline-handler check pass. `git diff --check` passes.
- The extension version is 1.2.0 and the persisted state schema is version 3. The only new permission is `webNavigation`; there are no additional hosts, content scripts, or network services.

Verified the actual unpacked extension in an isolated Chromium profile through Playwright:

- Added `sms.scpc.com/revenue` through the dashboard; the stored rule retained `/revenue`, and Chrome accepted its case-sensitive dynamic regex filter restricted to that hostname and main-frame requests.
- Used a local HTTP test website with a separate `127.0.0.1/revenue` rule. `/uptime` and `/revenue-other` loaded while Shield was enabled. `/revenue?month=october` redirected to the blocked page, which displayed the path. This test did not access the user's live management website.
- Clicking a local test button that changed the URL to `/revenue/monthly` through `history.pushState` also redirected to the blocked page.
- The recorded sequence produced four successful foreground visits, one return by tab switching, and two blocked encounters. Reloading the blocked page retained one encounter until navigation away and another attempt.
- Search for an absent site displayed the empty result and zero filtered totals. The rendered activity rows and totals agreed with the real extension storage.
- Closing and reopening the isolated browser retained the exact Shield start timestamp, blocked rules, daily usage, and visit/hop/blocked totals without adding phantom counts.
- Desktop (1440 px) and narrow (390 px) dashboard/activity screenshots were visually inspected. The narrow document width equaled the viewport width, with all four activity values readable.

Migration from state version 2 and privacy exclusions are covered by automated tests using controlled data. The user's personal Chrome installation was not modified. Visit and hop counters begin with this version and do not reconstruct earlier browsing.

## Earlier validation — 5 October 2026

## Version 1.1 update

- `npm test`: **11 tests passed**, including upgrade preservation, badge thresholds, partial-answer validation, receipt retention, blocked-page caller restrictions, preference validation, reload deduplication, and rollback of achievements/receipts after a failed rule change.
- `npm run check`: module syntax, manifest resources, local page assets, and all new image assets passed. The manifest permission list and host access are unchanged.
- The supplied GIF was copied unchanged; source and bundled asset SHA-256 hashes match.

Verified the actual unpacked extension in a separate Chromium profile using Playwright:

- Reloading from version 1 retained the exact active start timestamp (`1791173018128`), all 17 blocking rules, website list, usage, and completed session history. New state version is 2; installed extension version is 1.1.0.
- Mascot, achievements, and settings loaded. A saved reminder containing HTML-like text displayed as plain text; it persisted across page loads and appeared on blocked pages.
- A wrong math answer kept Shield enabled and monster health at seven. A correct answer reduced health to six, disabled that input, and remained verified after reloading the challenge.
- GIFs started with two copies and grew to twelve; all loaded locally. Decorations have `pointer-events: none`. At 390 px width, there was no horizontal overflow and the GIF gallery sat below the form.
- Reduced motion removed all GIFs. The separate GIF switch removed them live; Playful mode hid the boss while retaining saved math progress and Shield protection.
- After all seven answers were verified, Shield remained enabled until final confirmation. Confirmation removed all rules, stopped the GIFs, saved the session, and issued an escape receipt.
- Re-enabling Shield and visiting Facebook, Instagram, LinkedIn, X, and Chess.com redirected each to the new blocked page. Five encounters earned Professional Tab Resister; reloading a blocked tab kept the count unchanged. Blocked pages showed the raised-eyebrow mascot, a random message, reminder, and twelve GIFs.
- The blocked page could read presentation preferences but its `GET_STATE` request was rejected.
- Desktop dashboard, challenge, receipt, blocked-page, and narrow challenge screenshots were visually inspected. The blocked page had no console errors or warnings during these checks.

These update checks used an isolated browser profile. The user's personal Chrome installation still needs its Reload button clicked to use the new code.

## Original version 1.0 checks

## Automated checks

- `npm test`: **7 tests passed**. Covers domain normalization and boundary matching, five multiplication/two division challenges, exact answer validation, local-midnight usage splitting, delayed interval limits, retention, single session completion, and background-worker integration.
- Background integration uses a mocked Chrome API: rejected callers, wrong answers, cancelled/expired/forged challenges, rule-install failure rollback, protected list removal, existing-tab redirection, preserving Shield when tracking is paused or statistics are cleared, and foreground/idle accounting.
- `npm run check`: manifest resources, module syntax, local HTML asset references, and absence of inline event handlers passed.
- `git diff --check` passed.

## Real browser verification

Loaded the actual extension as unpacked into a separate bundled Chromium profile using Playwright. This did not install it into the user's personal Chrome profile.

Verified:

- Popup and dashboard loaded with no page console errors.
- Enabling Shield installed 17 dynamic main-frame redirect rules.
- Navigations to `m.facebook.com`, `instagram.com`, `linkedin.com`, `x.com`, `twitter.com`, `chess.com`, and `lichess.org` redirected to the local blocked page.
- The seven-input math challenge rejected all-zero answers while retaining Shield.
- Solving the visible questions disabled Shield, removed all dynamic rules, and saved one completed session.
- Pasted website URLs were normalized; websites could be added and removed while Shield was off.
- Tracking could be paused and resumed through the settings switch.
- The export control produced a local JSON download.
- A real foreground visit to a local HTTP test page recorded approximately 2.4 seconds of usage. The browser reported an active computer and a focused window during this check.
- Closing and reopening the isolated browser preserved the exact Shield start timestamp, all 17 rules, and recorded usage.
- The dashboard had no horizontal overflow at 1440 px or 390 px viewport width. The popup had no horizontal overflow at its intended 360 px width.
- Dashboard, challenge, and popup screenshots were visually inspected.

## Remaining practical limits

Native OS locking, extended idle sessions, machine sleep, crashes, timezone changes, and conflicting third-party extensions were not exercised end-to-end. Relevant time-accounting boundaries are covered in the automated checks. Usage remains an estimate as explained in the README. Normal Chrome settings can disable or remove the extension without the math challenge.

Personal Chrome installation and Chrome Web Store publication were not performed.
