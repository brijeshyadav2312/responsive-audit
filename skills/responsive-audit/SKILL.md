---
name: responsive-audit
description: Audit a web UI's responsiveness at breakpoint edges and across phone, tablet, foldable, laptop, desktop, and TV profiles using a deterministic Playwright harness. Use when asked to check responsive layout, find where a layout breaks, verify AI-generated UI, test mobile or tablet widths, check TV safe areas, or gate a PR on responsive regressions. Do not use for accessibility semantics, visual baselines, performance, or end-to-end behavior.
license: MIT
metadata:
  author: Brijesh Yadav
  version: 0.2.0
---

# Responsive Audit

Find the exact viewports where a UI breaks, with evidence an agent or a human can act on.

The harness discovers breakpoints from CSSOM, tests `b-1 / b / b+1`, scans device profiles, and measures the DOM. Every finding is deterministic: rule + selector + rect + computed value.

## When to use

- "Check if this page is responsive", "test mobile/tablet", "find where the layout breaks"
- After generating or editing UI with an AI coding agent
- Before merging a frontend PR, or as a CI gate
- When a bug report says "broken on phone" and you need the failing width and element
- When a design must fit TVs, foldables, or safe areas

## When not to use

- Accessibility semantics (alt text, focus order, labels) - use an a11y audit
- Visual pixel regressions against a baseline - use visual regression testing
- Performance, SEO, bundle size, or API security
- End-to-end user flows, forms, or checkout logic

## Tool priority

1. **This repo's CLI** (preferred, deterministic evidence):
   `node scripts/cli.mjs <url|file> [--mode sweep|devices|all]`
2. **Playwright MCP** - only if the CLI cannot run; emulate viewports manually
3. **Chrome DevTools MCP** - last resort; limited measurement, no report

Run the CLI from this skill directory. From the repository root, prefix paths with `skills/responsive-audit/`.
If the CLI is missing, run `npm install` in this skill directory, then `npx playwright install chromium`.
If the browser download is blocked, the CLI auto-falls back to installed Chrome or Edge, or pass `--channel chrome` / `--channel msedge`.
If the app needs a dev server, start it and confirm the URL responds before auditing.

## Workflow

1. **Confirm the target.** A URL, or a file path converted to `file://`. Do not audit authenticated or production pages without explicit permission and a Playwright storage state.
2. **Pick a mode.** `sweep` for breakpoint edges (default), `devices` for a realistic web device matrix, `all` for both. TV profiles are opt-in with `--devices tv`.
3. **Run a sample pass.** Start without `--full`; screenshots are captured for critical findings by default. The sweep reloads a fresh page at each width and uses normal motion by default. Add `--scroll` only for a revealed-state pass; add `--reduced-motion` to audit the reduced-motion variant.
4. **Read the report.** Open `out/<timestamp>/report.md`. Findings are grouped by unique rule + selector, with every affected viewport listed.
5. **Inspect evidence.** Open the annotated screenshots for P0/P1 findings. Do not report a finding you have not looked at.
6. **Fix in priority order.** P0 overflow -> P1 clipping and tap targets -> P2 platform issues -> P3 advisory. Prefer `min-width: 0`, `flex-wrap`, `max-width: 100%`, and `repeat(auto-fit, minmax(...))` over new magic breakpoints.
7. **Re-run and compare.** Report the before/after score and the findings that disappeared. Never claim a fix works without a re-run.

## Modes and commands

```bash
# breakpoint-edge sweep
node scripts/cli.mjs http://localhost:3000

# realistic device matrix, phones only, parallel contexts
node scripts/cli.mjs http://localhost:3000 --mode devices --devices mobile

# both, with screenshots for every viewport
node scripts/cli.mjs http://localhost:3000 --mode all --shots all

# TV safe-area and D-pad checks
node scripts/cli.mjs http://localhost:3000 --mode devices --devices tv

# WebKit engine for closer Safari fidelity (requires: npx playwright install webkit)
node scripts/cli.mjs http://localhost:3000 --engine webkit --devices phone

# targeted widths, no discovery
node scripts/cli.mjs http://localhost:3000 --widths 320,390,768,1024,1440

# reveal scroll-triggered or lazy content before measuring
node scripts/cli.mjs http://localhost:3000 --scroll

# audit the reduced-motion variant
node scripts/cli.mjs http://localhost:3000 --reduced-motion

# CI gate
node scripts/cli.mjs http://localhost:3000 --fail-on P1
```

Modes:

| Mode | What it tests | Best for |
|------|---------------|----------|
| `sweep` | discovered breakpoint edges plus representative widths, each on a fresh page | finding the exact failing pixel |
| `devices` | web profiles by default (20) with UA, DPR, touch, orientation | realistic phone/tablet/laptop/desktop coverage |
| `all` | both sets, deduplicated in the report | a release check |

`web` includes Android phone/tablet browsers. TV is a separate target: use `--devices tv` or `--devices all` only when the page must work on TVs.

## Output contract

Always report:

- target URL, timestamp, engine, and mode
- discovered breakpoints, sweep widths, and device profiles tested
- overall score and grade (A/B/C/D), plus unique findings vs occurrences
- the worst viewport and why
- findings grouped by severity, each with `rule`, `selector`, `rect`, affected viewports, and screenshot path
- evidence resolution count (`resolved/total`)
- concrete next actions (file/component to change when known)

Never say "fully responsive", "passes on all devices", "100% compliant", or "works on every TV". Say what was measured, at which viewports, with which engine. Emulation is not a real device.

## Severity model

| Severity | Meaning | Examples |
|----------|---------|----------|
| P0 | Page-level breakage | horizontal overflow > 8px |
| P1 | Content or control failure | clipped content, fixed navigation wider than the viewport, expanded mobile layout viewport, clustered tap targets < 24px, missing viewport meta, no TV focus ring |
| P2 | Platform or usability risk | image distortion, oversized fixed overlay, iOS input zoom, safe-area collision, TV overscan |
| P3 | Advisory | tap targets < 44px, vh units without dvh fallback, long TV page |

## Evidence and false positives

Every finding must have a deterministic anchor (selector + rect or computed style). If a visual model flags something without a measurable anchor, downgrade it to an observation, not a finding.

The harness already suppresses common false positives:

- off-canvas menus parked with negative offsets or clipping ancestors
- carousels and horizontal scrollers (`overflow-x: auto/scroll`)
- `aria-hidden` / `inert` duplicate layouts
- ellipsis and line-clamp truncation
- `object-fit` other than `fill`
- inline prose links inside paragraphs
- label-expanded checkbox/radio hit areas
- fixed overlays covering less than 40% of both viewport dimensions
- fully clipped offscreen reveal transforms that do not widen the document
- 2-6px border/rounding drift inside a clipping ancestor
- repeated selectors across widths (deduplicated in the report)

Normal motion is measured by default. Forcing reduced motion globally can hide transform-driven layout defects, so use `--reduced-motion` as a separate pass rather than as the default.

Verify any finding you are about to report. A selector that no longer resolves is marked `UNRESOLVED` and must not be reported as a defect.

## Platform notes

- **iOS:** `100vh` and browser chrome, safe-area insets on notched devices that use `viewport-fit=cover`, input auto-zoom below 16px, text autosizing. Run with `--engine webkit` for closer rendering; static checks still apply.
- **Android:** 360px is the common logical width; Chrome UI can change the visual viewport; use `dvh` where full-height layout matters.
- **TV:** no universal browser. Target Fire TV Silk, Samsung Tizen, LG webOS, or a WebView. Design base is commonly 960x540 with 1920x1080 output; keep content inside a 5% overscan safe area, provide visible D-pad focus, use at least 12px text and 48x48 targets.
- **Foldables:** cover and inner screens differ sharply; test both and avoid assuming a fixed aspect ratio or hinge behavior.

See `references/platforms.md` for fixes and `references/limits.md` for what emulation cannot prove.

## Autonomy rules

- Read-only by default: audit and report without changing code.
- Ask before installing dependencies, starting long-lived servers, or editing more than one file.
- Ask before auditing authenticated or production URLs.
- Do not generate more than about 30 screenshots in one run; `--shots critical` is the default.
- Do not run `--mode all --shots all` on a large site without warning about runtime and disk use.
- Do not claim a fix works without a re-run.
- Do not commit generated `out/` artifacts unless asked.

## Reference

- `references/checks.md` - full check matrix, thresholds, severity rationale, false-positive rules
- `references/devices.md` - device profile table, groups, orientation rules, TV safe area
- `references/platforms.md` - iOS, Android, TV, and foldable behavior and fixes
- `references/limits.md` - what the harness cannot verify and when to escalate
- `references/report-format.md` - JSON schema and report sections
