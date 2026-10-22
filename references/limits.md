# Limits and escalation

The harness reports measured DOM and CSS facts. It does not prove a page is correct on real hardware. Use this file to decide what to trust and when to escalate.

## Not verifiable by emulation

| Area | Why | Escalate to |
|------|-----|-------------|
| iOS Safari rendering | Chromium and WebKit differ in layout, fonts, and form behavior | WebKit engine (`--engine webkit`) plus a physical iPhone |
| Notch and home indicator | Playwright emulates viewport size, not hardware safe-area geometry | real notched device, or Safari responsive design mode |
| Text autosizing | iOS-specific text inflation is not modeled | physical iPhone in landscape |
| Virtual keyboard | keyboard height and scroll-into-view behavior are not simulated | physical device or BrowserStack |
| TV platform browsers | Tizen, webOS, and Silk differ from Chromium | target hardware or vendor emulator |
| TV overscan | physical panels crop different amounts | real TV with the same picture settings |
| Foldable hinge and posture | posture is a platform event, not a CSS media feature | physical foldable or vendor emulator |
| Hover capability | emulated touch does not fully model hybrid input | real tablet with trackpad/keyboard |
| Canvas and WebGL | content is not DOM-addressable | visual comparison or app-specific tests |
| Cross-origin iframes | same-origin policy blocks measurement | iframe owner or manual review |
| Cross-origin CSS | discovery cannot read opaque stylesheets | pass `--widths` or move CSS same-origin |
| Authentication and state | the audit sees one page state per navigation | use `--storage-state` and audit each state |
| Loading, empty, error states | only the rendered state is measured | separate fixtures or controlled data |
| Scroll-reveal and lazy content | reveal animations may hide below-fold elements before measurement; the default run deliberately samples that pre-reveal state | pass `--scroll` for a revealed pass; use a fixture if scroll-jacking prevents it |
| Animation timing | the audit samples after `--settle`, not every animation frame | increase `--settle` or add a deterministic fixture for a specific transition |
| Reduced-motion comparison | normal motion is the default; `--reduced-motion` runs the opposite preference, not both in one run | run both modes and compare when motion changes layout |
| Infinite scroll | the page keeps growing and the state is not deterministic | controlled fixture with a fixed dataset |
| 200% text zoom and RTL | not part of the default matrix | dedicated accessibility and localization passes |

## Engine differences

- `chromium` is the default and has the most reliable device emulation.
- `webkit` requires `npx playwright install webkit`. Use it for Safari-sensitive work, but remember it is still not the same as iOS Safari on a device.
- `firefox` omits `isMobile` because Playwright does not support it there. Touch and DPR still apply.

If a non-Chromium engine is not installed, the CLI fails with an install instruction instead of silently falling back. This is intentional: the report always names the engine that actually ran.

## Evidence confidence

Each result includes `metrics.evidenceTotal` and `metrics.evidenceResolved`. A selector that no longer resolves is marked `UNRESOLVED` in the report. Do not report unresolved evidence as a defect.

Confidence levels:

- **High:** measured geometry or computed style, selector resolves, reproduced at more than one viewport.
- **Medium:** measured once, selector resolves, but the element may be transient (toast, animation, late data).
- **Low:** document-level observation with no isolated selector, or a platform heuristic that depends on hardware.

## When to stop and ask

Ask the user before:

- auditing a production URL or anything behind authentication
- installing browser engines or system dependencies
- running `--mode all --shots all` on a large site
- making code changes beyond the one file needed for a fix
- reporting a finding that depends on a state you cannot reproduce

## Honest reporting

Say:

- "measured 320-3440px across 22 emulated profiles on Chromium"
- "P0 overflow at 768px in `.tablet-banner`"
- "iOS input zoom is a static heuristic; verify on a physical iPhone"

Do not say:

- "fully responsive"
- "works on all devices"
- "TV-ready"
- "accessibility compliant"
- "production-safe"
