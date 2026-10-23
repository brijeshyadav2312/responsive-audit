# Changelog

All notable changes to this project are documented here.

## 0.3.0 - 2026-10-22

### Changed

- Device audits now default to `--orientations both`. The default web matrix tests
  33 profiles, including landscape variants for every portable profile.
- Image waiting defaults to `--wait-images visible`: eager and in-viewport images are
  awaited, while offscreen lazy images are skipped instead of forcing a multi-second
  timeout.
- Navigation now uses one settle window instead of two.
- Sweep and device jobs share one worker pool in `--mode all`.
- Measurement caches layout facts and selectors, and tap-target spacing uses a spatial
  index. A 25k-element fixture dropped from about 5.0s to 0.5s per viewport.
- Reports include portrait/landscape coverage, duration, discovery time, audit time, and
  the slowest target.

### Added

- `--wait-images visible|all|none`.
- Regression tests for default landscape coverage, lazy-image waits, large tap-target
  sets, portable-landscape coverage reporting, and CLI option validation.
- Feedback issue template, pull request template, code of conduct, and repository
  discoverability guidance.

### Fixed

- Report coverage counted expanded portable profiles in the "Portable landscape"
  denominator, so a complete `--orientations both` run was reported as partial.
- Visible image waiting now skips hidden and zero-size images, which previously could
  stall a run until the image timeout.
- `--widths` now deduplicates repeated values and rejects a list with no positive number.
- `validate-skill` now fails on version drift between `package.json`, `SKILL.md`, and
  `evals/evals.json`, and on a mismatched skill folder name.

### Docs

- Expanded the README, skill description, npm keywords, and search terms for responsive UI
  skill, responsive page, UI responsive report, and responsive audit report discovery.

## 0.2.0 - 2026-10-22

Initial public release.

### Added

- Agent Skill with workflow, output contract, severity model, and autonomy rules.
- Breakpoint discovery from CSSOM, including range syntax, em/rem units, and container queries.
- Sweep, device, and combined audit modes with 22 device profiles.
- Deterministic checks for overflow, clipping, fixed/sticky fit, layout viewport expansion,
  tap targets, image distortion, overlays, iOS input zoom, safe areas, and TV behavior.
- Markdown and JSON reports with annotated screenshots and evidence selectors.
- CLI validation, exit-code gating, authenticated storage state, motion, and scroll options.
- 54 unit, fixture, and end-to-end tests.
- Multi-IDE installation documentation.
- GitHub Actions CI for Node.js 20 and 24.
