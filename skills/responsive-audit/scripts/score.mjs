const WEIGHTS = { P0: 40, P1: 18, P2: 7, P3: 2 };

export const SEVERITIES = ['P0', 'P1', 'P2', 'P3'];

export function scoreWidth(issues) {
  const penalty = issues.reduce((sum, issue) => sum + (WEIGHTS[issue.severity] || 0), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

export function collectFindings(results) {
  const map = new Map();
  const sampleKeys = new Map();

  for (const result of results) {
    const where =
      result.kind === 'device' && result.profile ? result.profile.name : result.width + 'px';

    for (const issue of result.issues || []) {
      const first = issue.evidence && issue.evidence[0];
      const anchor = (first && first.selector) || '(document)';
      const key = issue.id + '|' + anchor;
      let finding = map.get(key);

      if (!finding) {
        finding = {
          id: issue.id,
          severity: issue.severity,
          title: issue.title,
          detail: issue.detail,
          selector: anchor,
          occurrences: 0,
          viewports: [],
          samples: [],
        };
        map.set(key, finding);
      }

      finding.occurrences += 1;
      if (!finding.viewports.includes(where)) finding.viewports.push(where);

      const evidence = (issue.evidence || []).slice(0, 2);
      const signature = evidence
        .map(
          (item) =>
            (item.selector || '') +
            '|' +
            (item.detail || '') +
            '|' +
            (item.rect ? item.rect.width + 'x' + item.rect.height : '')
        )
        .join(';');
      const seen = sampleKeys.get(finding) || [];
      if (finding.samples.length < 4 && !seen.includes(signature)) {
        seen.push(signature);
        sampleKeys.set(finding, seen);
        finding.samples.push({
          where,
          screenshot: result.screenshot || null,
          evidence,
        });
      }
      if (
        SEVERITIES.indexOf(issue.severity) !== -1 &&
        SEVERITIES.indexOf(issue.severity) < SEVERITIES.indexOf(finding.severity)
      ) {
        finding.severity = issue.severity;
        finding.title = issue.title;
        finding.detail = issue.detail;
      }
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
      b.occurrences - a.occurrences
  );
}

export function summarize(results) {
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const result of results) {
    for (const issue of result.issues) {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    }
  }

  const averageScore = results.length
    ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length)
    : 100;

  const worst = results.reduce(
    (current, result) => (current === null || result.score < current.score ? result : current),
    null
  );

  const findings = collectFindings(results);

  return {
    counts,
    issueCount: counts.P0 + counts.P1 + counts.P2 + counts.P3,
    uniqueCount: findings.length,
    findings,
    averageScore,
    grade: grade(averageScore),
    worstWidth: worst ? worst.width : null,
    worstLabel: worst ? worst.label : null,
    worstScore: worst ? worst.score : null,
  };
}
