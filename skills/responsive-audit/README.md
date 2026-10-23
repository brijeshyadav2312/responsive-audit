# responsive-audit

**Responsive UI agent skill + CLI.** Audit responsive layouts at breakpoint edges and
across phone, tablet, foldable, laptop, desktop, and TV profiles, then emit a deterministic
UI responsive report with selectors, rects, severity, screenshots, and CI exit codes.

Use it as a responsive UI skill, responsive agent skill, or standalone Playwright CLI to
check UI responsiveness and find where a responsive page breaks.

## Install

```bash
npm install
npx playwright install chromium
```

No browser download? The CLI falls back to installed Chrome or Edge, or pass
`--channel chrome` / `--channel msedge`.

## Use

Run these commands from this skill directory:

```bash
node scripts/cli.mjs https://example.com
node scripts/cli.mjs https://example.com --mode devices --devices mobile
node scripts/cli.mjs https://example.com --mode devices --orientations auto
node scripts/cli.mjs https://example.com --mode all --shots all
node scripts/cli.mjs https://example.com --wait-images all
node scripts/cli.mjs https://example.com --fail-on P1
```

Reports are written to `out/<timestamp>/report.md` and `report.json`.

The bundled `demo/index.html` intentionally contains responsive defects. A grade of C
is expected.

## Skill

`SKILL.md` defines the agent workflow, output contract, severity model, and autonomy
rules. Keep the containing folder name as `responsive-audit` so validators can match it
to the skill name.

Full repository documentation, the IDE installation matrix, and development notes:
https://github.com/brijeshyadav2312/responsive-audit

## Feedback

- Star the repository if the skill saves you time.
- Rate it 1-5 with the feedback issue template:
  https://github.com/brijeshyadav2312/responsive-audit/issues/new?template=feedback.yml
- Report false positives or request device profiles in the issue tracker.

## License

MIT (c) 2026 Brijesh Yadav
