import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const cli = resolve('scripts/cli.mjs');
const options = { timeout: 120000, maxBuffer: 20 * 1024 * 1024 };

test('lists device profiles without launching a browser', async () => {
  const { stdout } = await run(process.execPath, [cli, '--list-devices'], options);
  assert.match(stdout, /phone-ios/);
  assert.match(stdout, /tv-1080/);
  assert.match(stdout, /Total by group/);
  assert.match(stdout, /Default audit expansion \(web, both\): 33 profiles \(20 landscape\)/);
});

test('prints the package version', async () => {
  const { stdout } = await run(process.execPath, [cli, '--version'], options);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('rejects invalid option values before launching an audit', async () => {
  for (const args of [
    ['demo/index.html', '--wait-images', 'bogus'],
    ['demo/index.html', '--orientations', 'sideways'],
    ['demo/index.html', '--widths', 'abc'],
    ['demo/index.html', '--widths', '10001'],
  ]) {
    let failure = null;
    try {
      await run(process.execPath, [cli, ...args], options);
    } catch (error) {
      failure = error;
    }
    assert.ok(failure, 'expected a non-zero exit for ' + args.join(' '));
    assert.equal(failure.code, 2);
    assert.match(failure.stderr, /Invalid option/);
  }
});

test('accepts file URLs and rejects unsupported URL schemes', async () => {
  const fileUrl = pathToFileURL(resolve('demo/index.html')).href;
  const { stdout } = await run(
    process.execPath,
    [cli, fileUrl, '--widths', '360', '--shots', 'none', '--json'],
    options
  );
  const report = JSON.parse(stdout);
  assert.equal(report.target, fileUrl);

  let failure = null;
  try {
    await run(process.execPath, [cli, 'ftp://example.com'], options);
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, 'expected a non-zero exit for an unsupported scheme');
  assert.equal(failure.code, 2);
  assert.match(failure.stderr, /Unsupported URL scheme/);
});

test('deduplicates repeated sweep widths', async () => {
  const { stdout } = await run(
    process.execPath,
    [cli, 'demo/index.html', '--widths', '360,360,360', '--shots', 'none', '--json'],
    options
  );
  const report = JSON.parse(stdout);
  assert.deepEqual(report.widths, [360]);
  assert.equal(report.results.length, 1);
});

test('json sweep returns a stable report', async () => {
  const { stdout } = await run(
    process.execPath,
    [cli, 'demo/index.html', '--widths', '360', '--shots', 'none', '--json'],
    options
  );
  const report = JSON.parse(stdout);
  assert.deepEqual(report.widths, [360]);
  assert.equal(report.mode, 'sweep');
  assert.equal(report.engine.name, 'chromium');
  assert.ok(report.findings.length > 0);
  assert.ok(report.findings.every((finding) => finding.selector));
});

test('fail-on exits with code 1 when the threshold is met', async () => {
  let failure = null;
  try {
    await run(
      process.execPath,
      [cli, 'demo/index.html', '--widths', '360', '--shots', 'none', '--fail-on', 'P1'],
      options
    );
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, 'expected a non-zero exit');
  assert.equal(failure.code, 1);
});

test('device mode audits TV profiles end to end', async () => {
  const { stdout } = await run(
    process.execPath,
    [
      cli,
      'demo/index.html',
      '--mode',
      'devices',
      '--devices',
      'tv',
      '--shots',
      'none',
      '--json',
    ],
    options
  );
  const report = JSON.parse(stdout);
  assert.equal(report.mode, 'devices');
  assert.deepEqual(report.widths, []);
  assert.equal(report.profilesTested.length, 2);
  assert.deepEqual(
    report.profilesTested.map((profile) => profile.width + 'x' + profile.height),
    ['1280x720', '1920x1080']
  );
  assert.ok(report.results.every((result) => result.kind === 'device'));
});

test('device mode defaults to portrait and landscape coverage', async () => {
  const out = await mkdtemp(join(tmpdir(), 'responsive-audit-'));
  try {
    const { stdout } = await run(
      process.execPath,
      [
        cli,
        'demo/index.html',
        '--mode',
        'devices',
        '--devices',
        'phone',
        '--shots',
        'none',
        '--json',
        '--out',
        out,
      ],
      options
    );
    const report = JSON.parse(stdout);
    assert.equal(report.options.orientations, 'both');
    assert.equal(report.options.waitImages, 'visible');
    assert.equal(report.profilesTested.length, 14);
    assert.equal(
      report.profilesTested.filter((profile) => profile.orientation === 'landscape').length,
      7
    );
    assert.ok(
      report.profilesTested.some((profile) => profile.name === 'phone-ios-landscape')
    );
    assert.equal(typeof report.timings.totalMs, 'number');
    assert.equal(typeof report.timings.discoveryMs, 'number');
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test('sweep reloads at each width and keeps no-preference motion', async () => {
  const out = await mkdtemp(join(tmpdir(), 'responsive-audit-'));
  try {
    const { stdout } = await run(
      process.execPath,
      [
        cli,
        'test/fixtures/motion-overflow.html',
        '--widths',
        '360',
        '--shots',
        'none',
        '--json',
        '--out',
        out,
      ],
      options
    );
    const report = JSON.parse(stdout);
    assert.equal(report.options.reducedMotion, 'no-preference');
    assert.ok(report.findings.some((finding) => finding.id === 'horizontal-overflow'));
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test('--scroll reveals below-fold animated content', async () => {
  const out = await mkdtemp(join(tmpdir(), 'responsive-audit-'));
  try {
    const { stdout } = await run(
      process.execPath,
      [
        cli,
        'test/fixtures/reveal.html',
        '--widths',
        '360',
        '--shots',
        'none',
        '--scroll',
        '--json',
        '--out',
        out,
      ],
      options
    );
    const report = JSON.parse(stdout);
    assert.ok(
      report.findings.some((finding) => finding.id === 'tap-target-advisory'),
      'expected the revealed 20x20 button to be measured'
    );
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
