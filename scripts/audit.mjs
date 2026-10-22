import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { discoverBreakpointsDetailed, buildWidths } from './discover.mjs';
import { scanCss } from './scan-css.mjs';
import { measureViewport } from './measure.mjs';
import { contextOptions, getProfiles, viewportHeightForWidth } from './devices.mjs';
import { scoreWidth, summarize } from './score.mjs';
import { writeReports } from './report.mjs';

const HIGHLIGHT_COLOR = '#ff2d55';
const KILL_ANIMATIONS =
  '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}';

const MODES = ['sweep', 'devices', 'all'];

async function annotate(page, selectors) {
  return page.evaluate(
    ({ selectors, color }) => {
      let count = 0;
      for (const selector of selectors) {
        let el = null;
        try {
          el = document.querySelector(selector);
        } catch {
          continue;
        }
        if (!el) continue;
        el.dataset.raOutline = el.style.outline || '';
        el.dataset.raOffset = el.style.outlineOffset || '';
        el.style.outline = '3px solid ' + color;
        el.style.outlineOffset = '1px';
        count += 1;
      }
      return count;
    },
    { selectors, color: HIGHLIGHT_COLOR }
  );
}

async function clearAnnotations(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-ra-outline]')) {
      el.style.outline = el.dataset.raOutline || '';
      el.style.outlineOffset = el.dataset.raOffset || '';
      delete el.dataset.raOutline;
      delete el.dataset.raOffset;
    }
  });
}

async function revealPage(page) {
  await page
    .evaluate(async () => {
      const scroller = document.scrollingElement || document.documentElement;
      const height = Math.max(
        scroller.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      );
      const step = Math.max(320, Math.floor(window.innerHeight * 0.8));
      const limit = Math.min(height, window.innerHeight * 20);
      for (let y = 0; y < limit; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      window.scrollTo(0, limit);
      await new Promise((resolve) => setTimeout(resolve, 60));
      window.scrollTo(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 60));
    })
    .catch(() => {});
}

async function preparePage(page, target, { timeout, settle, scroll }) {
  page.setDefaultTimeout(timeout);
  await page.goto(target, { waitUntil: 'load', timeout });
  await page.addStyleTag({ content: KILL_ANIMATIONS }).catch(() => {});
  await page.waitForTimeout(settle);
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  if (scroll) await revealPage(page);
  await page
    .waitForFunction(
      () => Array.from(document.images).every((image) => image.complete),
      undefined,
      { timeout: Math.min(3000, timeout) }
    )
    .catch(() => {});
}

function selectorsFor(issues) {
  return [
    ...new Set(
      issues
        .flatMap((issue) => (issue.evidence || []).map((item) => item.selector))
        .filter(Boolean)
    ),
  ].slice(0, 25);
}

function wantsShot(issues, mode) {
  if (mode === 'none') return false;
  if (mode === 'all') return true;
  return issues.some((issue) => issue.severity === 'P0' || issue.severity === 'P1');
}

async function capture(page, filePath, { fullPage, selectors }) {
  const marked = selectors.length ? await annotate(page, selectors) : 0;
  try {
    await page.screenshot({ path: filePath, fullPage, animations: 'disabled' });
  } finally {
    if (marked) await clearAnnotations(page);
  }
}

async function pageHeight(page) {
  return page
    .evaluate(() =>
      Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      )
    )
    .catch(() => 0);
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));

  const runners = Array.from({ length: size }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

function profileSummary(profile) {
  return {
    name: profile.name,
    label: profile.label,
    group: profile.group,
    os: profile.os,
    orientation: profile.orientation,
    width: profile.width,
    height: profile.height,
    dpr: profile.dpr,
    touch: Boolean(profile.touch),
    notch: Boolean(profile.notch),
  };
}

async function runSweep(browser, target, options, { discovered, cssFacts }) {
  const widths =
    options.widths && options.widths.length
      ? options.widths
      : buildWidths(discovered, { max: options.maxWidths ?? 28 });

  if (!widths.length) {
    throw new Error('No widths to test. Pass --widths or audit a page with readable CSS.');
  }

  const shots = options.shots || 'critical';
  const runDir = options.runDir;

  const results = await runPool(widths, options.concurrency ?? 4, async (width) => {
    const height = viewportHeightForWidth(width);
    const contextOptionsValue = {
      viewport: { width, height },
      screen: { width, height },
      deviceScaleFactor: 1,
      hasTouch: false,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: options.reducedMotion || 'no-preference',
    };
    if (options.storageState) contextOptionsValue.storageState = options.storageState;

    const context = await browser.newContext(contextOptionsValue);
    try {
      const page = await context.newPage();
      await preparePage(page, target, options);

      const measurement = await measureViewport(page, {
        width,
        height,
        settle: options.settle,
        cssFacts,
        resize: false,
      });

      let screenshot = null;
      if (wantsShot(measurement.issues, shots)) {
        const documentHeight = await pageHeight(page);
        const fullPage = options.fullPage === true || documentHeight <= 3000;
        const file = 'shots/width-' + width + '.png';
        try {
          await capture(page, join(runDir, file), {
            fullPage,
            selectors: selectorsFor(measurement.issues),
          });
          screenshot = file;
        } catch {
          screenshot = null;
        }
      }

      return {
        kind: 'sweep',
        label: width + 'px',
        width,
        height,
        score: scoreWidth(measurement.issues),
        metrics: measurement.metrics,
        issues: measurement.issues,
        screenshot,
      };
    } finally {
      await context.close();
    }
  });

  return { widths, results };
}

async function runDevices(browser, target, options, { cssFacts, engine }) {
  const profiles = getProfiles({
    group: options.devices || 'web',
    orientations: options.orientations || 'auto',
  });

  if (!profiles.length) {
    throw new Error('No device profiles matched group "' + options.devices + '".');
  }

  const shots = options.shots || 'critical';
  const runDir = options.runDir;

  const results = await runPool(profiles, options.concurrency ?? 4, async (profile) => {
    const contextOptionsValue = contextOptions(profile, {
      engine,
      reducedMotion: options.reducedMotion || 'no-preference',
    });
    if (options.storageState) contextOptionsValue.storageState = options.storageState;

    const context = await browser.newContext(contextOptionsValue);
    try {
      const page = await context.newPage();
      await preparePage(page, target, options);

      const measurement = await measureViewport(page, {
        width: profile.width,
        height: profile.height,
        settle: options.settle,
        profile,
        cssFacts,
        resize: false,
      });

      let screenshot = null;
      if (wantsShot(measurement.issues, shots)) {
        const documentHeight = await pageHeight(page);
        const fullPage = options.fullPage === true || documentHeight <= 3000;
        const file = 'shots/' + profile.name + '.png';
        try {
          await capture(page, join(runDir, file), {
            fullPage,
            selectors: selectorsFor(measurement.issues),
          });
          screenshot = file;
        } catch {
          screenshot = null;
        }
      }

      return {
        kind: 'device',
        label: profile.name,
        width: profile.width,
        height: profile.height,
        profile: profileSummary(profile),
        score: scoreWidth(measurement.issues),
        metrics: measurement.metrics,
        issues: measurement.issues,
        screenshot,
      };
    } finally {
      await context.close();
    }
  });

  return { profiles, results };
}

export async function runAudit(target, options = {}) {
  const mode = String(options.mode || 'sweep').toLowerCase();
  if (!MODES.includes(mode)) {
    throw new Error('Unknown mode "' + options.mode + '". Use sweep, devices, or all.');
  }

  const outRoot = options.out || 'out';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
  const runDir = join(outRoot, stamp);
  const shotsDir = join(runDir, 'shots');

  const settle = options.settle ?? 350;
  const timeout = options.timeout ?? 30000;
  const reducedMotion = options.reducedMotion || 'no-preference';
  const settings = { ...options, settle, timeout, reducedMotion, runDir };

  const launched = await launchBrowser({
    engine: options.engine || 'chromium',
    channel: options.channel,
    headed: options.headed,
  });
  const { browser } = launched;

  try {
    await mkdir(shotsDir, { recursive: true });
    const discoveryOptions = {
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    };
    if (options.storageState) discoveryOptions.storageState = options.storageState;
    const discoveryContext = await browser.newContext(discoveryOptions);

    let sweepPage = null;
    let discovered = [];
    let cssFacts = null;
    let title = null;

    try {
      sweepPage = await discoveryContext.newPage();
      await preparePage(sweepPage, target, settings);
      title = await sweepPage.title().catch(() => null);
      const detailed = await discoverBreakpointsDetailed(sweepPage);
      discovered = detailed.breakpoints;
      cssFacts = await scanCss(sweepPage);

      let widths = [];
      let sweepResults = [];

      if (mode === 'sweep' || mode === 'all') {
        const sweep = await runSweep(browser, target, settings, { discovered, cssFacts });
        widths = sweep.widths;
        sweepResults = sweep.results;
      }

      let profiles = [];
      let deviceResults = [];

      if (mode === 'devices' || mode === 'all') {
        const deviceRun = await runDevices(browser, target, settings, {
          cssFacts,
          engine: launched.engine,
        });
        profiles = deviceRun.profiles;
        deviceResults = deviceRun.results;
      }

      const results = [...sweepResults, ...deviceResults];

      const report = {
        target,
        title,
        generatedAt: new Date().toISOString(),
        engine: { name: launched.engine, channel: launched.channel },
        mode,
        options: {
          scroll: Boolean(options.scroll),
          fullPage: Boolean(options.fullPage),
          shots: options.shots || 'critical',
          reducedMotion,
          settle,
          timeout,
        },
        breakpoints: options.widths && options.widths.length ? null : discovered,
        widths,
        profilesTested: profiles.map(profileSummary),
        css: cssFacts,
        results,
        ...summarize(results),
      };

      await writeReports(runDir, report);
      return { report, runDir };
    } finally {
      await discoveryContext.close();
    }
  } finally {
    await browser.close();
  }
}
