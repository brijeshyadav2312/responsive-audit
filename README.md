# responsive-audit

An agent skill and CLI that audits a web UI's responsiveness at **breakpoint edges** and across **realistic device profiles**, then reports deterministic evidence instead of vibes.

Most tools test a handful of arbitrary widths and take screenshots. This one:

1. discovers real breakpoints from CSSOM, including range syntax, em/rem units, and container queries
2. reloads a fresh page at each `breakpoint - 1`, `breakpoint`, `breakpoint + 1`, and representative device width
3. optionally runs 22 device profiles with UA, DPR, touch, orientation, and safe-area checks
4. measures the DOM for overflow, ancestor clipping, fixed/sticky fit, layout-viewport expansion, tap targets, distortion, overlays, iOS input zoom, and TV rules
5. captures annotated screenshots only for the viewports you ask for
6. deduplicates findings by rule + selector, scores each viewport, and writes a report an agent can act on

## Why breakpoint edges

Layouts do not break at `375px`. They break when a media query flips. Testing `b-1 / b / b+1` finds the exact pixel where the layout dies, which is what you actually want to fix. Device profiles then confirm that the fix survives realistic UA, DPR, touch, and orientation combinations.

## Requirements

- Node.js 20 or newer
- Git
- About 350 MB of free disk space for the Playwright Chromium download

## Install

```bash
git clone https://github.com/brijeshyadav2312/responsive-audit.git
cd responsive-audit
npm install
npx playwright install chromium
```

`npm install` at the repository root installs the workspace that contains the skill and CLI.

No browser download? The CLI auto-falls back to an installed Chrome or Edge. You can be explicit:

```bash
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --channel chrome
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --channel msedge
```

For Safari-sensitive work:

```bash
npx playwright install webkit
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --engine webkit --devices phone
```

## Quick start

The bundled demo page intentionally contains responsive defects so you can see what the
audit detects. A grade of C on `skills/responsive-audit/demo/index.html` is expected.

```bash
# local file or URL
node skills/responsive-audit/scripts/cli.mjs skills/responsive-audit/demo/index.html --full
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000

# realistic device matrix
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --mode devices --devices mobile
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --mode devices --devices tv

# both sweep and devices
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --mode all --shots all

# only the widths you care about
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --widths 320,390,768,1024,1440

# trigger scroll-reveal and lazy content before measuring
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --scroll

# audit the reduced-motion variant instead of the default normal-motion state
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --reduced-motion

# CI gate: exit 1 on any P0 or P1
node skills/responsive-audit/scripts/cli.mjs http://localhost:3000 --fail-on P1
```

Output goes to `out/<timestamp>/`:

```text
report.md              human-readable findings, coverage, and screenshots
report.json            stable machine-readable output
shots/width-768.png    annotated evidence for sweep results
shots/phone-ios.png    annotated evidence for device profiles
```

## Modes

| Mode | What runs | Use when |
|------|-----------|----------|
| `sweep` (default) | breakpoint edges + representative widths, each on a fresh page | finding the exact failing pixel |
| `devices` | web profiles by default (20), with UA, DPR, touch, and orientation | checking phones, tablets, laptops, desktops |
| `all` | both, deduplicated in the report | release check |

TV profiles are opt-in because most web targets do not ship to TVs. Add `--devices tv` or `--devices all` when TV is part of the target. Android phone/tablet web is included in `web`; Android TV is not unless you select `tv` or `all`.

## Flags

| Flag | Default | Meaning |
|------|---------|---------|
| `--mode <name>` | `sweep` | `sweep`, `devices`, or `all` |
| `--devices <group>` | `web` | `all`, `web`, `mobile`, `phone`, `tablet`, `foldable`, `laptop`, `desktop`, `tv` |
| `--orientations <mode>` | `auto` | `auto`, `portrait`, `landscape`, `both` |
| `--widths <list>` | discovered | comma-separated widths, skips discovery |
| `--engine <name>` | `chromium` | `chromium`, `webkit`, or `firefox` |
| `--channel <name>` | auto | Chromium channel: `chrome` or `msedge` |
| `--concurrency <n>` | `4` | parallel device contexts, clamped to 1-8 |
| `--shots <mode>` | `critical` | `critical`, `all`, or `none` |
| `--full` | off | screenshot every tested viewport |
| `--full-page` | off | force full-page screenshots |
| `--scroll` | off | scroll the page before measuring to trigger reveal/lazy content |
| `--reduced-motion` | off | emulate `prefers-reduced-motion: reduce` instead of normal motion |
| `--out <dir>` | `out` | output root |
| `--settle <ms>` | `350` | wait after resize for reflow/fonts |
| `--timeout <ms>` | `30000` | navigation timeout |
| `--max-widths <n>` | `28` | cap on generated sweep widths |
| `--fail-on <P0-P3\|none>` | `none` | exit non-zero at or above this severity |
| `--storage-state <path>` | none | Playwright storage state for authenticated pages |
| `--list-devices` | - | print profiles and exit |
| `--version` | - | print version and exit |
| `--json` | off | print JSON instead of the summary |
| `--headed` | off | show the browser |

## Checks

| ID | Severity | What it proves |
|----|----------|----------------|
| `viewport-meta` | P1 | missing `<meta name="viewport">` |
| `viewport-meta-width` | P1 | viewport meta omits `width=device-width` |
| `zoom-blocked` | P2 | `user-scalable=no` / `maximum-scale=1` |
| `horizontal-overflow` | P0/P1 | document wider than viewport, with isolated offenders; transparent/pre-reveal-only offenders are P1 |
| `layout-viewport-expanded` | P1 | mobile layout viewport is wider than the visual viewport |
| `fixed-viewport-fit` | P1 | fixed/sticky element extends past the viewport edge |
| `text-clip` | P1 | `overflow: hidden/clip` box whose text is cut off |
| `clipped-content` | P1 | text, media, or control extends past an `overflow: hidden/clip` ancestor |
| `tap-target-critical` | P1 | interactive element under 24x24 that also fails the WCAG 2.2 spacing exception |
| `tap-target-advisory` | P3 | interactive element under 44x44 |
| `image-distortion` | P2 | `object-fit: fill` drifts >15% from natural ratio |
| `fixed-overlay` | P2 | fixed/sticky overlay covering 40%+ of both dimensions |
| `ios-input-zoom` | P2 | iOS form control font-size below 16px |
| `safe-area-inset` | P2 | notched iOS `viewport-fit=cover` page with fixed edge elements and no `env(safe-area-inset-*)` |
| `viewport-height-units` | P3 | `vh` without `svh/lvh/dvh` on mobile |
| `tv-focus` | P1 | no `:focus` / `:focus-visible` rules for D-pad |
| `tv-overscan` | P2 | content inside the outer 5% TV safe area |
| `tv-font-size` | P2 | TV text below 12px |
| `tv-target-size` | P2 | TV focus target below 48x48 |
| `tv-scroll` | P3 | TV page taller than 2 viewports |

Every finding carries `{ selector, tag, text, rect }` so an agent can `document.querySelector()` it, or a human can jump to it. See `references/checks.md` for thresholds and false-positive rules.

## Device coverage

22 profiles across phones, foldables, tablets, laptops, desktops, ultrawide, and TV. `web` is the default group and contains 20 profiles; TV is opt-in. Highlights:

- 320, 344, 360, 375, 390, 412, 430 CSS px phones
- foldable cover and inner screens
- 768, 800, 820, 1024 tablets
- 1280, 1366, 1440, 1536 laptops
- 1920, 2560, 3440 desktops
- 1280x720 and 1920x1080 TV with 5% overscan heuristics

`--orientations both` adds landscape variants for portable profiles. See `references/devices.md`.

## Use as an agent skill

Copy or symlink **`skills/responsive-audit`** into your agent's skills directory. Keep the
folder name exactly `responsive-audit`; validators require it to match the skill name.

| Tool | Project path | User path |
|------|--------------|-----------|
| Shared open-standard | `.agents/skills/` | `~/.agents/skills/` |
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `.agents/skills/` | `~/.codex/skills/` |
| Cursor | `.agents/skills/`, `.cursor/skills/` | - |
| Kiro | `.kiro/skills/` | `~/.kiro/skills/` |
| Antigravity | `.agents/skills/` | `~/.gemini/config/skills/` or `~/.gemini/antigravity-cli/skills/` |
| Kimi Code | `.agents/skills/`, `.kimi-code/skills/` | `~/.kimi-code/skills/` |
| Copilot / VS Code | `.agents/skills/`, `.claude/skills/`, `.github/skills/` | `~/.copilot/skills/` |

Example for the shared project location:

```bash
mkdir -p .agents/skills
cp -R skills/responsive-audit .agents/skills/
cd .agents/skills/responsive-audit
npm install
npx playwright install chromium
```

OpenCode also supports custom roots through `skills.paths`. For a new session, ask:
*"audit responsiveness of localhost:3000 and fix the breakpoint failures."*

`SKILL.md` defines the workflow, tool priority, output contract, severity model, and autonomy rules.
`evals/evals.json` contains trigger and non-trigger cases.

## Architecture

```text
skills/responsive-audit/
  SKILL.md                agent workflow, output contract, severity model
  scripts/cli.mjs         argument parsing, validation, exit codes
  scripts/audit.mjs       orchestration, modes, worker pool, screenshots
  scripts/browser.mjs     engine launch and Chromium channel fallback
  scripts/discover.mjs    CSSOM breakpoint parsing and width matrix
  scripts/scan-css.mjs    CSS feature facts for platform checks
  scripts/measure.mjs     in-page DOM measurement and all rules
  scripts/devices.mjs     profiles, groups, orientations, context options
  scripts/score.mjs       penalties, grades, unique findings
  scripts/report.mjs      ASCII markdown and JSON reports
  scripts/validate-skill.mjs frontmatter, references, devices, eval validation
  references/             check matrix, devices, platforms, limits, report schema
  evals/                  trigger and non-trigger cases
  demo/                   intentionally broken demo page
  test/                   unit, fixture, and CLI integration tests
```

## Development

```bash
npm run validate
npm run validate:skill
npm test
npm run demo
npm run demo:devices
npm run audit:full
npm run devices
```

The test suite uses `node:test` with unit tests for discovery and devices, integration fixtures
for every measurement rule, and CLI end-to-end tests. Fixtures live in
`skills/responsive-audit/test/fixtures/`.

## Design decisions

- Overflow avoids scrollbar false positives by measuring `documentElement.clientWidth` and `visualViewport.width`.
- Every sweep width gets a fresh page so AOS/scroll-reveal state from a larger width cannot mask a narrow-screen defect.
- Normal motion is the default; `--reduced-motion` is opt-in. Forcing reduced motion globally would hide transform-driven layout bugs.
- Fixed/sticky elements are measured for viewport fit instead of being skipped; off-canvas drawers are excluded by intersection and clipping checks.
- Ancestor clipping is measured only on visible content, ignoring scroll containers and intentional ellipsis/line-clamp truncation.
- `--scroll` reveals scroll-triggered content before measuring; it is opt-in because it can hide defects that exist before a reveal.
- Device contexts use real UA/DPR/touch emulation, but the report still names the engine and avoids claiming device parity.
- Reports are ASCII-only for reliable Windows and GitHub rendering.
- Non-Chromium engines fail loudly when not installed; they never silently fall back.

## Limits

- Emulated viewports are not real devices. iOS Safari URL bars, text autosizing, notch geometry, virtual keyboards, and TV platform browsers need a real-device pass.
- Cross-origin stylesheets are skipped during discovery; pass `--widths` if the site hides its CSS.
- Canvas, WebGL, and cross-origin iframes cannot be measured from the DOM.
- The audit sees one page state per navigation. Loading, empty, error, RTL, dark mode, and 200% zoom need separate runs.
- Scroll-reveal, lazy-loaded, and infinite-scroll content may be hidden unless `--scroll` is used. The default run intentionally measures the pre-reveal state, which is what a user sees first; scroll-jacking pages can still defeat a revealed pass.
- Animation state is sampled after `--settle`, not across every animation frame. A defect that exists for only a few milliseconds may not be captured.
- It never claims a page is "fully responsive". It reports measured failures and their severity.

## Roadmap

- [ ] Binary search for the exact breaking pixel between breakpoints
- [ ] Source-mapped `file:line` hints for fix-ready output
- [ ] GitHub Action + PR comment with annotated screenshots
- [ ] HTML dashboard with a breakpoint map
- [ ] MCP server wrapper (`audit_responsive` tool)
- [ ] State matrix: loading, empty, error, RTL, dark, 200% zoom
- [ ] Optional real-device provider adapter

## License

MIT (c) 2026 Brijesh Yadav
