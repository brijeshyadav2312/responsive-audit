# Check matrix

All measurements run in the page's layout viewport using `document.documentElement.clientWidth` and `visualViewport.width`. Widths are CSS pixels. A finding is only created when the condition is measured, not inferred from source code alone.

## Core checks

| ID | Severity | Condition | Notes |
|----|----------|-----------|-------|
| `viewport-meta` | P1 | no `<meta name="viewport">` | mobile browsers use a wide layout viewport and scale the page down |
| `viewport-meta-width` | P1 | viewport meta omits `width=device-width` | same symptom, explicit cause |
| `zoom-blocked` | P2 | `user-scalable=no` or `maximum-scale=1` | WCAG 1.4.4 failure |
| `horizontal-overflow` | P0 if > 8px and an offender is visible, else P1 | `scrollWidth - clientWidth > 1` | fixed elements are included when they intersect the viewport; transparent/pre-reveal-only offenders are P1 |
| `layout-viewport-expanded` | P1 | `window.innerWidth > visualViewport.width + 2` | mobile browsers widen the layout viewport when content cannot fit; fixed navigation can be clipped |
| `fixed-viewport-fit` | P1 | fixed/sticky element intersects the viewport and extends more than 1px past an edge | off-canvas, clipped, transparent, and `pointer-events: none` elements are excluded |
| `text-clip` | P1 | `overflow-x: hidden/clip`, `scrollWidth > clientWidth + 2`, text length >= 12 | ellipsis, line-clamp, inline elements, and horizontal scrollers are excluded |
| `clipped-content` | P1 | visible text, media, or control extends more than 6px past an `overflow-x: hidden/clip` ancestor | scroll containers, ellipsis/line-clamp, transparent ancestors, and elements outside the viewport horizontally are excluded |
| `tap-target-critical` | P1 | interactive rect < 23.5px in either dimension on touch or <= 900px | WCAG 2.2 target size 24x24; inline prose links, spacing-exception targets, and label-expanded controls excluded |
| `tap-target-advisory` | P3 | interactive rect < 43.5px in either dimension | comfortable touch size; not a conformance failure |
| `image-distortion` | P2 | rendered ratio differs from natural ratio by > 15% | only when computed `object-fit` is `fill` |
| `fixed-overlay` | P2 | fixed/sticky element covers >= 40% of width and height | `pointer-events: none` elements are excluded |

## Platform checks

| ID | Severity | Condition | Notes |
|----|----------|-----------|-------|
| `ios-input-zoom` | P2 | iOS profile and a visible form control has font-size < 16px | Safari zooms when the field is focused |
| `safe-area-inset` | P2 | notched iOS profile with `viewport-fit=cover`, fixed/sticky element touches an edge, no `env(safe-area-inset-*)` in CSS | without `viewport-fit=cover`, Safari already insets the layout viewport |
| `viewport-height-units` | P3 | CSS uses `vh` units and no `svh/lvh/dvh` | mobile chrome changes the visible height |
| `tv-focus` | P1 | TV profile and no `:focus` or `:focus-visible` rules | D-pad users cannot see the active control |
| `tv-overscan` | P2 | TV profile and text, interactive, or media content enters the outer 5% band | TVs may crop edge content |
| `tv-font-size` | P2 | TV profile and text element renders below 12px | viewing distance makes small text unreadable |
| `tv-target-size` | P2 | TV profile and focusable rect < 48px in either dimension | remote navigation needs larger targets |
| `tv-scroll` | P3 | TV profile and document height > 2 viewports | long scrolling is awkward with a remote |

## Scoring

Each occurrence at a viewport subtracts:

| Severity | Penalty |
|----------|---------|
| P0 | 40 |
| P1 | 18 |
| P2 | 7 |
| P3 | 2 |

Widths are clamped to 0-100. The overall score is the rounded mean of all tested viewports. Grades: A >= 90, B >= 75, C >= 60, D otherwise.

Scores are deterministic rule penalties, not a claim of visual correctness. A page with no measured failures can still be ugly or unusable for reasons this harness does not measure.

## Overflow isolation

Overflow is only reported when the document actually scrolls horizontally. For each candidate element the harness:

1. skips `display: none`, `visibility: hidden`, `content-visibility: hidden`, `aria-hidden`, and `inert` subtrees
2. keeps laid-out transparent/pre-reveal elements because they still widen the document; if every offender is transparent the finding is P1
3. skips fixed/sticky elements that do not intersect the viewport, and skips elements inside `overflow-x: auto/scroll` containers
4. skips elements clipped by an ancestor whose box is inside the viewport
5. promotes inline descendants to their nearest overflowing block ancestor
6. removes ancestor duplicates so evidence points at the most specific overflowing box
7. caps evidence at 8 selectors

Fixed/sticky elements that intersect the viewport are also checked directly by `fixed-viewport-fit`; this catches navigation that is clipped because the mobile layout viewport expanded. Negative offsets (off-canvas menus parked to the left) do not create horizontal scroll in left-to-right documents and are not reported.

## False-positive policy

The following are deliberately not findings:

- ellipsis or `-webkit-line-clamp` truncation
- `object-fit: cover/contain/scale-down/none`
- inline text links inside prose blocks, including short contact links
- undersized targets that clear the WCAG 2.2 spacing exception (no 24px circle overlap)
- controls whose wrapping `<label>` is at least 44x44
- horizontal carousels and scrollable tables
- fixed headers, sidebars, and modals under 40% of both viewport dimensions
- sticky elements with `pointer-events: none`
- hidden breakpoint duplicates and off-canvas drawers
- offscreen reveal transforms that are completely clipped and do not widen the document
- 2-6px border/rounding drift inside a clipping ancestor

When a rule still produces a questionable finding, inspect the annotated screenshot and the selector before reporting it. Findings are evidence, not verdicts.

## Cross-origin and dynamic content

Cross-origin stylesheets cannot be read during discovery. Pass `--widths` when the site hides its CSS. Canvas, WebGL, and cross-origin iframes cannot be measured from the DOM. Loading, empty, error, and authenticated states require explicit navigation or storage state.
