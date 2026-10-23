import test from 'node:test';
import assert from 'node:assert/strict';
import { toMarkdown } from '../scripts/report.mjs';

function reportWith(profilesTested, orientations) {
  return {
    target: 'https://example.com',
    title: 'Example',
    generatedAt: '2026-01-01T00:00:00.000Z',
    engine: { name: 'chromium', channel: 'bundled' },
    mode: 'devices',
    options: {
      scroll: false,
      reducedMotion: 'no-preference',
      orientations,
    },
    breakpoints: [],
    widths: [],
    profilesTested,
    timings: {
      launchMs: 100,
      discoveryMs: 200,
      auditMs: 300,
      totalMs: 600,
      slowest: { label: 'phone-ios', kind: 'device', ms: 120 },
    },
    css: {},
    results: [],
    counts: { P0: 0, P1: 0, P2: 0, P3: 0 },
    issueCount: 0,
    uniqueCount: 0,
    findings: [],
    averageScore: 100,
    grade: 'A',
    worstLabel: null,
    worstWidth: null,
    worstScore: null,
  };
}

function portable(name, orientation) {
  return {
    name,
    label: name,
    group: 'phone',
    os: 'ios',
    orientation,
    width: 390,
    height: 844,
  };
}

test('portable landscape reports full coverage for orientations both', () => {
  const profiles = [];
  for (let index = 0; index < 13; index += 1) {
    profiles.push(portable('phone-' + index, 'portrait'));
    profiles.push(portable('phone-' + index + '-landscape', 'landscape'));
  }
  const markdown = toMarkdown(reportWith(profiles, 'both'));
  assert.match(markdown, /Portable landscape: 13\/13/);
  assert.doesNotMatch(markdown, /partial/);
});

test('portable landscape reports partial coverage for orientations portrait', () => {
  const profiles = [];
  for (let index = 0; index < 13; index += 1) {
    profiles.push(portable('phone-' + index, 'portrait'));
  }
  const markdown = toMarkdown(reportWith(profiles, 'portrait'));
  assert.match(markdown, /Portable landscape: 0\/13 - partial by request/);
  assert.match(markdown, /use --orientations both for full coverage/);
});

test('portable landscape reports full coverage for orientations landscape', () => {
  const profiles = [];
  for (let index = 0; index < 13; index += 1) {
    profiles.push(portable('phone-' + index + '-landscape', 'landscape'));
  }
  const markdown = toMarkdown(reportWith(profiles, 'landscape'));
  assert.match(markdown, /Portable landscape: 13\/13/);
  assert.doesNotMatch(markdown, /partial/);
});

test('coverage includes orientation counts, timings, and slowest target', () => {
  const profiles = [portable('phone-a', 'portrait'), portable('phone-a-landscape', 'landscape')];
  const markdown = toMarkdown(reportWith(profiles, 'both'));
  assert.match(markdown, /Device orientation: 1 landscape, 1 portrait \(requested: both\)/);
  assert.match(markdown, /Duration: 0\.6s total, 0\.2s discovery, 0\.3s audit, 0\.1s launch/);
  assert.match(markdown, /Slowest target: phone-ios \(0\.1s\)/);
});
