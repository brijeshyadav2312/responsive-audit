#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runAudit, WAIT_IMAGES } from './audit.mjs';
import { printSummary } from './report.mjs';
import { PROFILES, getProfiles, listGroups } from './devices.mjs';

const VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8').replace(/^\uFEFF/, '')
).version;
const SEVERITIES = ['P0', 'P1', 'P2', 'P3'];
const MODES = ['sweep', 'devices', 'all'];
const ENGINES = ['chromium', 'webkit', 'firefox'];
const ORIENTATIONS = ['auto', 'portrait', 'landscape', 'both'];
const SHOTS = ['critical', 'all', 'none'];

const HELP = `
responsive-audit ${VERSION} - find where a UI breaks across viewports

Usage:
  node scripts/cli.mjs <url|file> [options]

Options:
  --mode <name>          sweep | devices | all (default: sweep)
  --devices <group>      all | web | mobile | phone | tablet | foldable | laptop | desktop | tv
                         (default: web; TV profiles are opt-in)
  --orientations <mode>  auto | portrait | landscape | both (default: both)
                         auto = natural orientation, a faster partial pass
  --widths <list>        comma-separated widths, skips breakpoint discovery
  --engine <name>        chromium | webkit | firefox (default: chromium)
  --channel <name>       chromium channel: chrome | msedge (default: auto fallback)
  --concurrency <n>      parallel contexts (default: 4, max: 8)
  --shots <mode>         critical | all | none (default: critical)
  --wait-images <mode>   visible | all | none (default: visible)
  --full                 screenshot every tested viewport
  --full-page            force full-page screenshots
  --scroll               scroll through the page before measuring (reveals lazy/animated content)
  --reduced-motion       emulate prefers-reduced-motion: reduce (default: no-preference)
  --out <dir>            output root (default: out)
  --settle <ms>          wait after resize (default: 350)
  --timeout <ms>         navigation timeout (default: 30000)
  --max-widths <n>       cap generated sweep widths (default: 28)
  --fail-on <sev>        exit 1 at or above P0|P1|P2|P3 (default: none)
  --storage-state <path> Playwright storage state for authenticated pages
  --list-devices         print device profiles and exit
  --version              print version and exit
  --json                 print JSON instead of the summary
  --headed               show the browser
  -h, --help             show this help

Examples:
  node scripts/cli.mjs demo/index.html --full
  node scripts/cli.mjs http://localhost:3000 --mode all --devices mobile
  node scripts/cli.mjs http://localhost:3000 --mode devices --devices tv
  node scripts/cli.mjs http://localhost:3000 --widths 320,390,768,1024,1440
  node scripts/cli.mjs http://localhost:3000 --engine webkit --devices phone
  node scripts/cli.mjs http://localhost:3000 --fail-on P1
`;

function parseArgs(argv) {
  const options = {
    out: 'out',
    settle: 350,
    timeout: 30000,
    maxWidths: 28,
    failOn: 'NONE',
    mode: 'sweep',
    devices: 'web',
    orientations: 'both',
    engine: 'chromium',
    concurrency: 4,
    shots: 'critical',
    waitImages: 'visible',
    full: false,
    fullPage: false,
    scroll: false,
    reducedMotion: 'no-preference',
    json: false,
    headed: false,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];

    switch (arg) {
      case '--out':
        options.out = next();
        break;
      case '--mode':
        options.mode = String(next() || '').toLowerCase();
        break;
      case '--devices':
        options.devices = String(next() || '').toLowerCase();
        break;
      case '--orientations':
        options.orientations = String(next() || '').toLowerCase();
        break;
      case '--widths': {
        const parsed = String(next() || '')
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value) && value > 0);
        options.widths = [...new Set(parsed)];
        break;
      }
      case '--engine':
        options.engine = String(next() || '').toLowerCase();
        break;
      case '--channel':
        options.channel = String(next() || '').trim() || undefined;
        break;
      case '--concurrency':
        options.concurrency = Number(next());
        break;
      case '--shots':
        options.shots = String(next() || '').toLowerCase();
        break;
      case '--wait-images':
        options.waitImages = String(next() || '').toLowerCase();
        break;
      case '--settle':
        options.settle = Number(next());
        break;
      case '--timeout':
        options.timeout = Number(next());
        break;
      case '--max-widths':
        options.maxWidths = Number(next());
        break;
      case '--fail-on':
        options.failOn = String(next() || 'none').toUpperCase();
        break;
      case '--storage-state':
        options.storageState = resolve(String(next() || ''));
        break;
      case '--full':
        options.full = true;
        options.shots = 'all';
        break;
      case '--full-page':
        options.fullPage = true;
        break;
      case '--scroll':
        options.scroll = true;
        break;
      case '--reduced-motion':
        options.reducedMotion = 'reduce';
        break;
      case '--json':
        options.json = true;
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--list-devices':
        options.listDevices = true;
        break;
      case '--version':
        options.version = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error('Unknown flag: ' + arg);
          console.error(HELP);
          process.exit(2);
        }
        positional.push(arg);
    }
  }

  options.target = positional[0];
  return options;
}

function validate(options) {
  const problems = [];
  if (!MODES.includes(options.mode)) problems.push('--mode must be one of ' + MODES.join(', '));
  if (!ENGINES.includes(options.engine)) problems.push('--engine must be one of ' + ENGINES.join(', '));
  if (!ORIENTATIONS.includes(options.orientations)) {
    problems.push('--orientations must be one of ' + ORIENTATIONS.join(', '));
  }
  if (!SHOTS.includes(options.shots)) problems.push('--shots must be one of ' + SHOTS.join(', '));
  if (!WAIT_IMAGES.includes(options.waitImages)) {
    problems.push('--wait-images must be one of ' + WAIT_IMAGES.join(', '));
  }
  if (options.failOn !== 'NONE' && !SEVERITIES.includes(options.failOn)) {
    problems.push('--fail-on must be P0, P1, P2, P3, or none');
  }
  if (!Number.isFinite(options.settle) || options.settle < 0) problems.push('--settle must be >= 0');
  if (!Number.isFinite(options.timeout) || options.timeout < 1000) {
    problems.push('--timeout must be >= 1000');
  }
  if (!Number.isFinite(options.maxWidths) || options.maxWidths < 1) {
    problems.push('--max-widths must be >= 1');
  }
  if (options.widths && options.widths.length === 0) {
    problems.push('--widths must contain at least one positive number');
  }
  if (options.widths && options.widths.some((width) => width > 10000)) {
    problems.push('--widths values must be 10000 or less');
  }
  if (!Number.isFinite(options.concurrency)) options.concurrency = 4;
  options.concurrency = Math.max(1, Math.min(8, Math.floor(options.concurrency)));
  if (options.storageState && !existsSync(options.storageState)) {
    problems.push('--storage-state file not found: ' + options.storageState);
  }
  if (!listGroups().includes(options.devices)) {
    problems.push('--devices must be one of ' + listGroups().join(', '));
  }

  if (problems.length) {
    console.error('');
    for (const problem of problems) console.error('Invalid option: ' + problem);
    console.error('');
    process.exit(2);
  }
}

function resolveTarget(target) {
  if (/^https?:\/\//i.test(target)) return target;

  if (/^file:\/\//i.test(target)) {
    let absolute;
    try {
      absolute = fileURLToPath(target);
    } catch {
      console.error('Invalid file URL: ' + target);
      process.exit(2);
    }
    if (!existsSync(absolute)) {
      console.error('File not found: ' + absolute);
      process.exit(2);
    }
    return pathToFileURL(absolute).href;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) {
    console.error('Unsupported URL scheme. Use http://, https://, or a local file path.');
    process.exit(2);
  }

  const absolute = resolve(target);
  if (!existsSync(absolute)) {
    console.error('Target not found: ' + absolute);
    console.error(
      'Pass an http(s) URL (for example http://localhost:3000) or an existing HTML file.'
    );
    process.exit(2);
  }
  return pathToFileURL(absolute).href;
}

function shouldFail(report, failOn) {
  if (failOn === 'NONE') return false;
  const threshold = SEVERITIES.indexOf(failOn);
  if (threshold === -1) return false;
  return report.findings.some((finding) => SEVERITIES.indexOf(finding.severity) <= threshold);
}

function printDevices() {
  console.log('');
  console.log('Groups: ' + listGroups().join(', '));
  console.log('');
  console.log('Profiles:');
  for (const profile of PROFILES) {
    console.log(
      '  ' +
        profile.name.padEnd(24) +
        profile.group.padEnd(10) +
        (profile.width + 'x' + profile.height).padEnd(11) +
        ('dpr ' + profile.dpr).padEnd(11) +
        profile.os
    );
  }
  const counts = {};
  for (const profile of PROFILES) counts[profile.group] = (counts[profile.group] || 0) + 1;
  console.log('');
  console.log('Total profiles: ' + PROFILES.length);
  console.log(
    'Total by group: ' +
      Object.entries(counts)
        .map(([group, count]) => group + '=' + count)
        .join(' ')
  );
  console.log('');
  const webBoth = getProfiles({ group: 'web', orientations: 'both' });
  const webLandscape = webBoth.filter((profile) => profile.orientation === 'landscape');
  const webAuto = getProfiles({ group: 'web', orientations: 'auto' });
  console.log(
    'Default audit expansion (web, both): ' +
      webBoth.length +
      ' profiles (' +
      webLandscape.length +
      ' landscape)'
  );
  console.log(
    'Quick natural-orientation pass (web, auto): ' +
      webAuto.length +
      ' profiles (' +
      webAuto.filter((profile) => profile.orientation === 'landscape').length +
      ' landscape)'
  );
  console.log('');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.version) {
    console.log(VERSION);
    return;
  }
  if (options.listDevices) {
    printDevices();
    return;
  }
  if (options.help || !options.target) {
    console.log(HELP);
    process.exit(options.target ? 0 : 2);
  }

  validate(options);
  const target = resolveTarget(options.target);

  try {
    const { report, runDir } = await runAudit(target, options);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printSummary(report, runDir);
    }

    if (shouldFail(report, options.failOn)) {
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('Audit failed: ' + (error instanceof Error ? error.message : String(error)));
    console.error('');
    process.exit(2);
  }
}

main();
