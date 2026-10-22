import test from 'node:test';
import assert from 'node:assert/strict';
import { collectFindings } from '../scripts/score.mjs';

test('finding detail follows the worst severity', () => {
  const issue = (severity, detail) => ({
    id: 'horizontal-overflow',
    severity,
    title: 'Horizontal overflow',
    detail,
    evidence: [{ selector: 'body > nav', detail: null, rect: null }],
  });
  const findings = collectFindings([
    {
      kind: 'sweep',
      width: 320,
      label: '320px',
      issues: [issue('P1', 'Transparent only')],
    },
    {
      kind: 'device',
      profile: { name: 'phone-se' },
      width: 320,
      label: 'phone-se',
      issues: [issue('P0', 'Visible overflow')],
    },
  ]);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'P0');
  assert.equal(findings[0].detail, 'Visible overflow');
  assert.equal(findings[0].occurrences, 2);
});
