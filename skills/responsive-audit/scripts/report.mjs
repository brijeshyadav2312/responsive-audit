import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SEVERITIES } from './score.mjs';

const NOT_MEASURED = [
  'real iOS Safari rendering, text autosizing, and notch safe areas (emulated only)',
  'real TV browsers (Tizen, webOS, Fire TV Silk) and physical overscan',
  'foldable hinge/posture events and app continuity',
  '200% text zoom, RTL, dark mode, forced colors, and reduced-motion comparison beyond the selected mode',
  'loading, empty, error, and authenticated states',
  'virtual keyboards and scroll-into-view behavior on focus',
  'canvas, WebGL, and cross-origin iframe content',
  'cross-origin stylesheets during breakpoint discovery',
];

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function seconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'n/a';
  return (number / 1000).toFixed(1) + 's';
}

function baseProfileName(name) {
  return String(name).replace(/-(landscape|portrait)$/, '');
}

function gradeOf(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function countBySeverity(issues) {
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const issue of issues) counts[issue.severity] = (counts[issue.severity] || 0) + 1;
  return counts;
}

function viewportList(values, limit = 14) {
  if (!values.length) return '-';
  if (values.length <= limit) return values.join(', ');
  return values.slice(0, limit).join(', ') + ' +' + (values.length - limit) + ' more';
}

function coverageLines(report) {
  const lines = [];
  const css = report.css || {};
  lines.push('## Coverage');
  lines.push('');
  lines.push(
    '- Engine: ' +
      report.engine.name +
      (report.engine.channel ? ' (channel: ' + report.engine.channel + ')' : '')
  );
  lines.push('- Mode: ' + report.mode);
  lines.push('- Scroll pass: ' + (report.options && report.options.scroll ? 'on' : 'off'));
  lines.push(
    '- Motion: prefers-reduced-motion ' +
      ((report.options && report.options.reducedMotion) || 'no-preference')
  );
  lines.push(
    '- Breakpoints: ' +
      (report.breakpoints === null
        ? 'skipped (custom --widths)'
        : report.breakpoints.length
          ? report.breakpoints.join(', ') + 'px'
          : 'none discovered')
  );
  lines.push(
    '- Sweep widths: ' +
      (report.widths.length ? report.widths.length + ' (' + viewportList(report.widths, 30) + ')' : 'none')
  );
  lines.push(
    '- Device profiles: ' +
      (report.profilesTested.length
        ? report.profilesTested.length +
          ' (' +
          report.profilesTested.map((profile) => profile.name).join(', ') +
          ')'
        : 'none')
  );
  if (report.profilesTested.length) {
    const landscape = report.profilesTested.filter(
      (profile) => profile.orientation === 'landscape'
    ).length;
    const portrait = report.profilesTested.filter(
      (profile) => profile.orientation === 'portrait'
    ).length;
    const portable = report.profilesTested.filter((profile) =>
      ['phone', 'tablet', 'foldable'].includes(profile.group)
    );
    lines.push(
      '- Device orientation: ' +
        landscape +
        ' landscape, ' +
        portrait +
        ' portrait' +
        (report.options && report.options.orientations
          ? ' (requested: ' + report.options.orientations + ')'
          : '')
    );
    if (portable.length) {
      const portableBases = new Set(portable.map((profile) => baseProfileName(profile.name)));
      const landscapeBases = new Set(
        portable
          .filter((profile) => profile.orientation === 'landscape')
          .map((profile) => baseProfileName(profile.name))
      );
      const requested = report.options && report.options.orientations;
      const missing = portableBases.size - landscapeBases.size;
      const note =
        missing > 0
          ? requested === 'both'
            ? ' - partial; verify the device matrix'
            : ' - partial by request; use --orientations both for full coverage'
          : '';
      lines.push(
        '- Portable landscape: ' +
          landscapeBases.size +
          '/' +
          portableBases.size +
          note
      );
    }
  }
  if (report.timings) {
    lines.push(
      '- Duration: ' +
        seconds(report.timings.totalMs) +
        ' total, ' +
        seconds(report.timings.discoveryMs) +
        ' discovery, ' +
        seconds(report.timings.auditMs) +
        ' audit, ' +
        seconds(report.timings.launchMs) +
        ' launch'
    );
    if (report.timings.slowest) {
      lines.push(
        '- Slowest target: ' +
          report.timings.slowest.label +
          ' (' +
          seconds(report.timings.slowest.ms) +
          ')'
      );
    }
  }
  lines.push(
    '- Stylesheets read: ' +
      (css.sheets ?? 0) +
      (css.unreadableSheets ? ', unreadable: ' + css.unreadableSheets : '') +
      ', rules: ' +
      (css.ruleCount ?? 0) +
      ', CSS bytes: ' +
      (css.cssBytes ?? 0)
  );
  lines.push(
    '- CSS features: vh units ' +
      (css.vhCount ?? 0) +
      ', modern viewport units: ' +
      (css.usesModernViewportUnits ? 'yes' : 'no') +
      ', safe-area env(): ' +
      (css.usesSafeArea ? 'yes' : 'no') +
      ', focus styles: ' +
      (css.hasFocusRules ? 'yes' : 'no') +
      ', container queries: ' +
      (css.hasContainerQueries ? 'yes' : 'no')
  );
  lines.push('');
  return lines;
}

function findingsLines(report) {
  const lines = [];
  lines.push('## Findings');
  lines.push('');

  if (!report.findings.length) {
    lines.push('No measured responsiveness failures in this run.');
    lines.push('');
    return lines;
  }

  lines.push('| Severity | Rule | Anchor | Occurrences | Viewports |');
  lines.push('|----------|------|--------|-------------|-----------|');
  for (const finding of report.findings) {
    lines.push(
      '| ' +
        finding.severity +
        ' | ' +
        escapeCell(finding.id) +
        ' | `' +
        escapeCell(finding.selector) +
        '` | ' +
        finding.occurrences +
        ' | ' +
        escapeCell(viewportList(finding.viewports)) +
        ' |'
    );
  }
  lines.push('');

  for (const finding of report.findings) {
    lines.push('### ' + finding.severity + ' - ' + finding.id);
    lines.push('');
    lines.push(finding.title + '. ' + finding.detail);
    lines.push('');
    lines.push('- Anchor: `' + finding.selector + '`');
    lines.push('- Occurs at: ' + viewportList(finding.viewports, 30));
    lines.push('');

    for (const sample of finding.samples) {
      if (!sample.evidence.length && !sample.screenshot) continue;
      const shot = sample.screenshot ? ' | [shot](' + sample.screenshot + ')' : '';
      lines.push('Evidence at ' + sample.where + shot + ':');
      for (const item of sample.evidence) {
        const rect = item.rect
          ? ' | ' +
            item.rect.width +
            'x' +
            item.rect.height +
            ' at (' +
            item.rect.x +
            ', ' +
            item.rect.y +
            '), right ' +
            item.rect.right
          : '';
        const text = item.text ? ' | "' + escapeCell(item.text) + '"' : '';
        const extra = item.detail ? ' | ' + escapeCell(item.detail) : '';
        const parent = item.parent ? ' | inside `' + escapeCell(item.parent) + '`' : '';
        const resolved = item.resolved === false ? ' | UNRESOLVED' : '';
        lines.push(
          '- `' + escapeCell(item.selector) + '`' + rect + text + extra + parent + resolved
        );
      }
      lines.push('');
    }
  }

  return lines;
}

function resultsLines(report) {
  const lines = [];
  const sweep = report.results.filter((result) => result.kind === 'sweep');
  const devices = report.results.filter((result) => result.kind === 'device');

  if (sweep.length) {
    lines.push('## Sweep results');
    lines.push('');
    lines.push('| Width | Score | Grade | P0 | P1 | P2 | P3 | Evidence |');
    lines.push('|-------|-------|-------|----|----|----|----|----------|');
    for (const result of [...sweep].sort((a, b) => a.width - b.width)) {
      const counts = countBySeverity(result.issues);
      lines.push(
        '| ' +
          result.width +
          'px | ' +
          result.score +
          ' | ' +
          gradeOf(result.score) +
          ' | ' +
          counts.P0 +
          ' | ' +
          counts.P1 +
          ' | ' +
          counts.P2 +
          ' | ' +
          counts.P3 +
          ' | ' +
          (result.screenshot ? '[shot](' + result.screenshot + ')' : '-') +
          ' |'
      );
    }
    lines.push('');
  }

  if (devices.length) {
    lines.push('## Device results');
    lines.push('');
    lines.push('| Profile | Size | Orientation | Score | Grade | P0 | P1 | P2 | P3 | Evidence |');
    lines.push('|---------|------|-------------|-------|-------|----|----|----|----|----------|');
    for (const result of devices) {
      const counts = countBySeverity(result.issues);
      const profile = result.profile || {};
      lines.push(
        '| ' +
          escapeCell(result.label) +
          ' | ' +
          result.width +
          'x' +
          result.height +
          ' | ' +
          escapeCell(profile.orientation || '-') +
          ' | ' +
          result.score +
          ' | ' +
          gradeOf(result.score) +
          ' | ' +
          counts.P0 +
          ' | ' +
          counts.P1 +
          ' | ' +
          counts.P2 +
          ' | ' +
          counts.P3 +
          ' | ' +
          (result.screenshot ? '[shot](' + result.screenshot + ')' : '-') +
          ' |'
      );
    }
    lines.push('');
  }

  return lines;
}

function limitsLines(report) {
  const lines = [];
  const total = report.results.reduce(
    (sum, result) => sum + ((result.metrics && result.metrics.evidenceTotal) || 0),
    0
  );
  const resolved = report.results.reduce(
    (sum, result) => sum + ((result.metrics && result.metrics.evidenceResolved) || 0),
    0
  );

  lines.push('## Confidence and limits');
  lines.push('');
  lines.push(
    '- Evidence anchors resolved: ' + resolved + '/' + total + ' selectors found again in the DOM.'
  );
  lines.push(
    '- Scores are deterministic penalties for measured rules, not a claim of visual correctness.'
  );
  lines.push(
    '- Emulated viewports are not real devices. Verify critical flows on at least one physical phone.'
  );
  if (report.engine.name !== 'webkit') {
    lines.push(
      '- WebKit/Safari was not executed. iOS-specific results are static heuristics from CSS and DOM.'
    );
  }
  if (report.profilesTested.some((profile) => profile.group === 'tv')) {
    lines.push(
      '- TV checks assume a 5% overscan safe area and D-pad focus. Tizen, webOS, and Silk differ in detail.'
    );
  }
  lines.push('');
  lines.push('Not measured in this run:');
  lines.push('');
  for (const item of NOT_MEASURED) lines.push('- ' + item);
  lines.push('');
  return lines;
}

export function toMarkdown(report) {
  const lines = [];
  lines.push('# Responsive audit - ' + report.target);
  lines.push('');
  if (report.title) lines.push('- Title: ' + report.title);
  lines.push('- Generated: ' + report.generatedAt);
  lines.push(
    '- Overall: **' + report.grade + ' (' + report.averageScore + '/100)** - ' +
      report.uniqueCount +
      ' unique finding(s), ' +
      report.issueCount +
      ' occurrence(s)'
  );
  lines.push(
    '- Severity: P0 ' +
      report.counts.P0 +
      ' | P1 ' +
      report.counts.P1 +
      ' | P2 ' +
      report.counts.P2 +
      ' | P3 ' +
      report.counts.P3
  );
  lines.push(
    '- Worst viewport: ' +
      (report.worstLabel === null
        ? 'none'
        : report.worstLabel + ' (' + report.worstScore + '/100)')
  );
  lines.push('');

  lines.push(...coverageLines(report));
  lines.push(...findingsLines(report));
  lines.push(...resultsLines(report));
  lines.push(...limitsLines(report));

  return lines.join('\n');
}

export async function writeReports(runDir, report) {
  await writeFile(join(runDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(join(runDir, 'report.md'), toMarkdown(report), 'utf8');
}

export function printSummary(report, runDir) {
  console.log('');
  console.log('  responsive-audit  ' + report.target);
  console.log(
    '  engine            ' + report.engine.name + (report.engine.channel ? ' (' + report.engine.channel + ')' : '')
  );
  console.log('  mode              ' + report.mode);
  console.log('  grade             ' + report.grade + ' (' + report.averageScore + '/100)');
  console.log(
    '  findings          ' +
      report.uniqueCount +
      ' unique / ' +
      report.issueCount +
      ' occurrences   P0:' +
      report.counts.P0 +
      ' P1:' +
      report.counts.P1 +
      ' P2:' +
      report.counts.P2 +
      ' P3:' +
      report.counts.P3
  );
  console.log(
    '  worst             ' +
      (report.worstLabel === null ? 'none' : report.worstLabel + ' (' + report.worstScore + '/100)')
  );
  console.log(
    '  breakpoints       ' +
      (report.breakpoints === null
        ? 'skipped (--widths)'
        : report.breakpoints.length
          ? report.breakpoints.join(', ') + 'px'
          : 'none discovered')
  );
  if (report.profilesTested.length) {
    const landscape = report.profilesTested.filter(
      (profile) => profile.orientation === 'landscape'
    ).length;
    console.log(
      '  devices           ' +
        report.profilesTested.length +
        ' profiles (' +
        landscape +
        ' landscape)'
    );
  }
  if (report.timings) {
    console.log(
      '  duration          ' +
        seconds(report.timings.totalMs) +
        ' (discovery ' +
        seconds(report.timings.discoveryMs) +
        ', audit ' +
        seconds(report.timings.auditMs) +
        ')'
    );
  }
  console.log('  report            ' + join(runDir, 'report.md'));

  const urgent = report.findings.filter(
    (finding) => finding.severity === 'P0' || finding.severity === 'P1'
  );

  if (urgent.length) {
    console.log('');
    console.log('  top findings:');
    for (const finding of urgent.slice(0, 8)) {
      console.log(
        '    ' +
          finding.severity +
          '  ' +
          finding.id +
          '  ' +
          finding.selector +
          '  (' +
          finding.viewports.length +
          ' viewport(s))'
      );
    }
  }
  console.log('');
}
