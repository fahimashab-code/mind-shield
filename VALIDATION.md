# Validation — 5 October 2026

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
