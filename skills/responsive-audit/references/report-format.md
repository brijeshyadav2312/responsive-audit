# Report format

Every run writes `report.json` and `report.md` into `out/<timestamp>/`. Screenshots go to `out/<timestamp>/shots/`.

## JSON schema

Top level:

| Field | Type | Meaning |
|-------|------|---------|
| `target` | string | audited URL or `file://` URL |
| `title` | string \| null | `document.title` |
| `generatedAt` | ISO string | run timestamp |
| `engine` | `{ name, channel }` | engine actually launched, and Chromium channel if any |
| `mode` | `sweep` \| `devices` \| `all` | requested mode |
| `options` | object | `scroll`, `fullPage`, `shots`, `reducedMotion`, `settle`, and `timeout` used for the run |
| `breakpoints` | number[] \| null | discovered widths, or null when `--widths` was used |
| `widths` | number[] | sweep widths tested (empty in device-only mode) |
| `profilesTested` | object[] | device profiles tested (empty in sweep-only mode) |
| `css` | object | CSS facts: sheets, rules, bytes, vh count, safe-area, focus, containers |
| `results` | object[] | one entry per width or device profile |
| `counts` | `{ P0, P1, P2, P3 }` | occurrence counts |
| `issueCount` | number | total occurrences |
| `uniqueCount` | number | unique rule + selector findings |
| `findings` | object[] | deduplicated findings with affected viewports |
| `averageScore` | number | rounded mean of result scores |
| `grade` | A \| B \| C \| D | grade for `averageScore` |
| `worstWidth` | number \| null | width of the lowest-scoring result |
| `worstLabel` | string \| null | `"768px"` or a device name |
| `worstScore` | number \| null | lowest score |

Result object:

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | `sweep` \| `device` | result type |
| `label` | string | `"768px"` or profile name |
| `width`, `height` | number | viewport in CSS pixels |
| `profile` | object? | name, label, group, os, orientation, dpr, touch, notch |
| `score` | number | 0-100 |
| `metrics` | object | viewportWidth, layoutViewportWidth, visualViewportWidth, scrollWidth, overflow, documentHeight, evidenceTotal, evidenceResolved |
| `issues` | object[] | measured issues |
| `screenshot` | string \| null | relative path such as `shots/width-768.png` |

Issue object:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | rule id from `references/checks.md` |
| `severity` | P0 \| P1 \| P2 \| P3 | score penalty |
| `title` | string | short human label |
| `detail` | string | measured explanation |
| `evidence` | object[] | selectors, tags, text, rects, details |

Evidence object:

| Field | Type | Meaning |
|-------|------|---------|
| `selector` | string | `document.querySelector`-compatible anchor |
| `parent` | string \| null | parent anchor for overflow context |
| `tag` | string | lowercase tag name |
| `text` | string | truncated text or accessible label |
| `rect` | `{ x, y, width, height, right, bottom }` \| null | viewport rectangle |
| `detail` | string? | rule-specific value |
| `resolved` | boolean? | selector resolved again after measurement |

Finding object:

| Field | Type | Meaning |
|-------|------|---------|
| `id`, `severity`, `title`, `detail` | | copied from the worst occurrence |
| `selector` | string | anchor of the first occurrence |
| `occurrences` | number | how many result viewports produced it |
| `viewports` | string[] | affected widths or device names |
| `samples` | object[] | up to 4 unique evidence samples with `where`, `screenshot`, `evidence` |

## Markdown sections

1. Header: target, title, timestamp, grade, severity counts, worst viewport.
2. Coverage: engine, mode, scroll pass, reduced-motion preference, breakpoints, sweep widths, device profiles, CSS facts.
3. Findings: unique findings table followed by per-rule evidence.
4. Sweep results: width, score, grade, severity counts, screenshot link.
5. Device results: profile, size, orientation, score, grade, severity counts, screenshot link.
6. Confidence and limits: evidence resolution, emulation disclaimer, engine caveat, not-measured list.

## Conventions

- Output is ASCII only so it renders correctly in Windows terminals and GitHub.
- Selectors are generated from unique ids or `:nth-of-type` paths.
- Screenshots are annotated with a 3px red outline on offending elements and restored afterwards.
- Full-page screenshots are used for pages up to 3000px tall; taller pages use the viewport unless `--full-page` is passed.
- `--shots critical` captures P0/P1 results; `--shots all` captures every result; `--shots none` disables screenshots.
