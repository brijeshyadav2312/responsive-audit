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
const IMAGE_WAIT_MARGIN = 200;
const IMAGE_WAIT_TIMEOUT = 1200;
const FONT_WAIT_TIMEOUT = 1500;

export const WAIT_IMAGES = ['visible', 'all', 'none'];

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

export async function waitForImages(page, mode = 'visible', { timeout = IMAGE_WAIT_TIMEOUT } = {}) {
  const selected = WAIT_IMAGES.includes(mode) ? mode : 'visible';
  if (selected === 'none') return;

  await page
    .waitForFunction(
      ({ selectedMode, margin }) => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const metrics = (image) => {
          const rect = image.getBoundingClientRect();
          return {
            rect,
            hasBox: rect.width > 0 || rect.height > 0,
            nearViewport:
              rect.bottom >= -margin &&
              rect.top <= viewportHeight + margin &&
              rect.right >= -margin &&
              rect.left <= viewportWidth + margin,
          };
        };

        return Array.from(document.images).every((image) => {
          if (image.complete) return true;
          if (selectedMode === 'all') return false;
          const box = metrics(image);
          if (!box.hasBox) return true;
          return image.loading === 'lazy' && !box.nearViewport;
        });
      },
      { selectedMode: selected, margin: IMAGE_WAIT_MARGIN },
      { timeout: Math.max(50, timeout), polling: 100 }
    )
    .catch(() => {});
}

async function preparePage(page, target, { timeout, settle, scroll, waitImages }) {
  page.setDefaultTimeout(timeout);
  await page.goto(target, { waitUntil: 'load', timeout });
  await page.addStyleTag({ content: KILL_ANIMATIONS }).catch(() => {});
  await page
    .evaluate(
      (limit) =>
        document.fonts
          ? Promise.race([
              document.fonts.ready,
              new Promise((resolve) => setTimeout(resolve, limit)),
            ])
          : undefined,
      Math.min(FONT_WAIT_TIMEOUT, timeout)
    )
    .catch(() => {});
  await waitForImages(page, waitImages, {
    timeout: Math.min(waitImages === 'all' ? 3000 : IMAGE_WAIT_TIMEOUT, timeout),
  });
  if (scroll) await revealPage(page);
  await page.waitForTimeout(settle);
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

async function runSweepJob(browser, target, options, width, cssFacts) {
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
      settle: 0,
      cssFacts,
      resize: false,
    });

    let screenshot = null;
    if (wantsShot(measurement.issues, options.shots || 'critical')) {
      const documentHeight = await pageHeight(page);
      const fullPage = options.fullPage === true || documentHeight <= 3000;
      const file = 'shots/width-' + width + '.png';
      try {
        await capture(page, join(options.runDir, file), {
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
}

async function runDeviceJob(browser, target, options, profile, cssFacts, engine) {
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
      settle: 0,
      profile,
      cssFacts,
      resize: false,
    });

    let screenshot = null;
    if (wantsShot(measurement.issues, options.shots || 'critical')) {
      const documentHeight = await pageHeight(page);
      const fullPage = options.fullPage === true || documentHeight <= 3000;
      const file = 'shots/' + profile.name + '.png';
      try {
        await capture(page, join(options.runDir, file), {
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
  const waitImages = WAIT_IMAGES.includes(options.waitImages) ? options.waitImages : 'visible';
  const orientations = options.orientations || 'both';
  const deviceGroup = options.devices || 'web';
  const requestedConcurrency = Number(options.concurrency ?? 4);
  const concurrency = Number.isFinite(requestedConcurrency)
    ? Math.max(1, Math.min(8, Math.floor(requestedConcurrency)))
    : 4;
  const settings = {
    ...options,
    settle,
    timeout,
    reducedMotion,
    waitImages,
    orientations,
    devices: deviceGroup,
    concurrency,
    runDir,
  };

  const startedAt = performance.now();
  const launched = await launchBrowser({
    engine: options.engine || 'chromium',
    channel: options.channel,
    headed: options.headed,
  });
  const launchMs = Math.round(performance.now() - startedAt);
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
      const discoveryStartedAt = performance.now();
      sweepPage = await discoveryContext.newPage();
      await preparePage(sweepPage, target, {
        ...settings,
        waitImages: 'none',
        scroll: false,
      });
      title = await sweepPage.title().catch(() => null);
      const detailed = await discoverBreakpointsDetailed(sweepPage);
      discovered = detailed.breakpoints;
      cssFacts = await scanCss(sweepPage);
      const discoveryMs = Math.round(performance.now() - discoveryStartedAt);

      const widths =
        mode === 'sweep' || mode === 'all'
          ? options.widths && options.widths.length
            ? options.widths
            : buildWidths(discovered, { max: options.maxWidths ?? 28 })
          : [];

      if ((mode === 'sweep' || mode === 'all') && !widths.length) {
        throw new Error('No widths to test. Pass --widths or audit a page with readable CSS.');
      }

      const profiles =
        mode === 'devices' || mode === 'all'
          ? getProfiles({ group: deviceGroup, orientations })
          : [];

      if ((mode === 'devices' || mode === 'all') && !profiles.length) {
        throw new Error('No device profiles matched group "' + deviceGroup + '".');
      }

      const jobs = [
        ...widths.map((width) => ({ kind: 'sweep', width })),
        ...profiles.map((profile) => ({ kind: 'device', profile })),
      ];

      const auditStartedAt = performance.now();
      const results = await runPool(jobs, concurrency, async (job) => {
        const jobStartedAt = performance.now();
        const result =
          job.kind === 'sweep'
            ? await runSweepJob(browser, target, settings, job.width, cssFacts)
            : await runDeviceJob(
                browser,
                target,
                settings,
                job.profile,
                cssFacts,
                launched.engine
              );
        result.durationMs = Math.round(performance.now() - jobStartedAt);
        return result;
      });
      const auditMs = Math.round(performance.now() - auditStartedAt);

      const slowest = results.reduce((current, result) => {
        if (!current || result.durationMs > current.ms) {
          return { label: result.label, kind: result.kind, ms: result.durationMs };
        }
        return current;
      }, null);

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
          waitImages,
          devices: deviceGroup,
          orientations,
          concurrency,
        },
        timings: {
          launchMs,
          discoveryMs,
          auditMs,
          totalMs: Math.round(performance.now() - startedAt),
          slowest,
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
