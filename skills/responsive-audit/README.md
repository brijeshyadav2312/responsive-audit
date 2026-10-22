# responsive-audit

An Agent Skill and CLI that audits responsive layouts at breakpoint edges and across
phone, tablet, foldable, laptop, desktop, and TV profiles.

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
node scripts/cli.mjs https://example.com --mode all --shots all
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

## License

MIT (c) 2026 Brijesh Yadav
