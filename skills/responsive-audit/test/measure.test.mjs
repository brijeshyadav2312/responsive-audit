import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser } from '../scripts/browser.mjs';
import { scanCss } from '../scripts/scan-css.mjs';
import { measureViewport } from '../scripts/measure.mjs';
import { discoverBreakpoints } from '../scripts/discover.mjs';

let browser = null;

before(async () => {
  const launched = await launchBrowser({ engine: 'chromium' });
  browser = launched.browser;
});

after(async () => {
  if (browser) await browser.close();
});

function fixture(name) {
  return pathToFileURL(resolve('test/fixtures', name)).href;
}

async function withPage(name, { width = 360, height = 800, context: extra = {} } = {}, fn) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    ...extra,
  });
  const page = await context.newPage();
  try {
    await page.goto(fixture(name), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await page
      .waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, {
        timeout: 3000,
      })
      .catch(() => {});
    return await fn(page);
  } finally {
    await context.close();
  }
}

async function measure(
  name,
  { width = 360, height = 800, profile = null, context = {} } = {}
) {
  return withPage(name, { width, height, context }, async (page) => {
    const cssFacts = await scanCss(page);
    return measureViewport(page, {
      width,
      height,
      settle: 0,
      profile,
      cssFacts,
      resize: false,
    });
  });
}

function ids(result) {
  return result.issues.map((issue) => issue.id);
}

function evidenceFor(result, id) {
  const issue = result.issues.find((item) => item.id === id);
  return issue ? issue.evidence.map((item) => item.selector) : [];
}

test('clean fixture has no measured failures', async () => {
  const result = await measure('clean.html');
  assert.deepEqual(ids(result), []);
});

test('fixed-width content produces P0 horizontal overflow', async () => {
  const result = await measure('overflow.html');
  assert.ok(ids(result).includes('horizontal-overflow'));
  assert.ok(evidenceFor(result, 'horizontal-overflow').includes('#wide'));
  const issue = result.issues.find((item) => item.id === 'horizontal-overflow');
  assert.equal(issue.severity, 'P0');
});

test('ellipsis is allowed but silent clipping is reported', async () => {
  const result = await measure('ellipsis.html');
  assert.ok(ids(result).includes('text-clip'));
  const evidence = evidenceFor(result, 'text-clip');
  assert.ok(evidence.includes('#clip'));
  assert.ok(!evidence.includes('#ellipsis'));
});

test('object-fit cover and contain are not distortion', async () => {
  const result = await measure('objectfit.html');
  assert.ok(ids(result).includes('image-distortion'));
  const evidence = evidenceFor(result, 'image-distortion');
  assert.ok(evidence.includes('#fill'));
  assert.ok(!evidence.includes('#cover'));
  assert.ok(!evidence.includes('#contain'));
});

test('inline prose links are not tap target failures', async () => {
  const result = await measure('inline-link.html');
  assert.ok(!ids(result).includes('tap-target-critical'));
  assert.ok(ids(result).includes('tap-target-advisory'));
});

test('offscreen skip links are not tap targets', async () => {
  const result = await measure('skip-link.html');
  const evidence = JSON.stringify(result.issues);
  assert.ok(!ids(result).includes('tap-target-critical'));
  assert.ok(!ids(result).includes('tap-target-advisory'));
  assert.ok(!evidence.includes('Skip to content'));
});

test('horizontal scrollers are not document overflow', async () => {
  const result = await measure('scroller.html');
  assert.ok(!ids(result).includes('horizontal-overflow'));
});

test('content clipped by an ancestor is reported without document overflow', async () => {
  const result = await measure('clipped-content.html');
  assert.ok(ids(result).includes('clipped-content'));
  assert.ok(evidenceFor(result, 'clipped-content').includes('#clip'));
  assert.ok(!JSON.stringify(result.issues).includes('This paragraph fits'));
});

test('fixed elements wider than the viewport are reported', async () => {
  const result = await measure('fixed-wide.html');
  assert.ok(ids(result).includes('fixed-viewport-fit'));
  assert.ok(
    evidenceFor(result, 'fixed-viewport-fit').some((selector) =>
      selector.endsWith('nav:nth-of-type(1)')
    )
  );
});

test('motion-driven overflow is measured with no-preference motion', async () => {
  const result = await measure('motion-overflow.html', {
    context: { reducedMotion: 'no-preference' },
  });
  assert.ok(ids(result).includes('horizontal-overflow'));

  const reduced = await measure('motion-overflow.html');
  assert.ok(!ids(reduced).includes('horizontal-overflow'));
});

test('mobile layout viewport expansion is reported', async () => {
  const result = await measure('motion-overflow.html', {
    context: {
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'no-preference',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    },
  });
  assert.ok(ids(result).includes('layout-viewport-expanded'));
});

test('off-canvas panels are not document overflow', async () => {
  const result = await measure('offcanvas.html');
  assert.ok(!ids(result).includes('horizontal-overflow'));
  assert.ok(!ids(result).includes('tap-target-critical'));
});

test('iOS reports form fields below 16px', async () => {
  const profile = { name: 'ios-test', os: 'ios', notch: false, touch: true, group: 'phone' };
  const result = await measure('ios-input.html', { width: 390, height: 844, profile });
  assert.ok(ids(result).includes('ios-input-zoom'));
  const evidence = evidenceFor(result, 'ios-input-zoom');
  assert.ok(evidence.includes('#email'));
  assert.ok(evidence.includes('#country'));
  assert.ok(!evidence.includes('#notes'));
});

test('Android does not report iOS input zoom', async () => {
  const profile = { name: 'android-test', os: 'android', notch: false, touch: true, group: 'phone' };
  const result = await measure('ios-input.html', { width: 390, height: 844, profile });
  assert.ok(!ids(result).includes('ios-input-zoom'));
});

test('notched iOS profiles warn about missing safe-area insets', async () => {
  const notched = { name: 'ios-notch', os: 'ios', notch: true, touch: true, group: 'phone' };
  const result = await measure('safe-area.html', { width: 390, height: 844, profile: notched });
  assert.ok(ids(result).includes('safe-area-inset'));

  const flat = { name: 'ios-flat', os: 'ios', notch: false, touch: true, group: 'phone' };
  const flatResult = await measure('safe-area.html', { width: 390, height: 844, profile: flat });
  assert.ok(!ids(flatResult).includes('safe-area-inset'));

  const noCover = await measure('safe-area-no-cover.html', {
    width: 390,
    height: 844,
    profile: notched,
  });
  assert.ok(!ids(noCover).includes('safe-area-inset'));
});

test('TV profile reports focus, overscan, text, and target failures', async () => {
  const profile = { name: 'tv-test', os: 'tv', notch: false, touch: false, group: 'tv' };
  const result = await measure('tv.html', { width: 1280, height: 720, profile });
  const found = ids(result);
  assert.ok(found.includes('tv-focus'));
  assert.ok(found.includes('tv-overscan'));
  assert.ok(found.includes('tv-font-size'));
  assert.ok(found.includes('tv-target-size'));
});

test('desktop profile does not report TV-specific failures', async () => {
  const profile = { name: 'desktop-test', os: 'windows', notch: false, touch: false, group: 'desktop' };
  const result = await measure('tv.html', { width: 1280, height: 720, profile });
  assert.ok(!ids(result).some((id) => id.startsWith('tv-')));
});

test('fixed panels covering half the viewport are reported', async () => {
  const result = await measure('fixed.html');
  assert.ok(ids(result).includes('fixed-overlay'));
});

test('evidence selectors resolve back to the DOM', async () => {
  const result = await measure('overflow.html');
  assert.ok(result.metrics.evidenceTotal > 0);
  assert.equal(result.metrics.evidenceResolved, result.metrics.evidenceTotal);
});

test('discovers container and range-syntax breakpoints', async () => {
  const found = await withPage('container.html', {}, async (page) => {
    const breakpoints = await discoverBreakpoints(page);
    const cssFacts = await scanCss(page);
    return { breakpoints, cssFacts };
  });
  assert.deepEqual(found.breakpoints, [400, 700, 768]);
  assert.equal(found.cssFacts.hasContainerQueries, true);
});
