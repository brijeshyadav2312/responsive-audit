import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser } from '../scripts/browser.mjs';
import { waitForImages } from '../scripts/audit.mjs';

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

test('visible image waiting skips offscreen and hidden lazy images', async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page = await context.newPage();
  try {
    await page.route('**/slow.png', () => new Promise(() => {}));
    await page.goto(fixture('lazy-images.html'), { waitUntil: 'load' });

    const startedAt = performance.now();
    await waitForImages(page, 'visible', { timeout: 1000 });
    const visibleMs = performance.now() - startedAt;
    assert.ok(visibleMs < 500, 'visible wait should not wait for offscreen lazy images');

    const strictStartedAt = performance.now();
    await waitForImages(page, 'all', { timeout: 250 });
    const strictMs = performance.now() - strictStartedAt;
    assert.ok(strictMs >= 150, 'strict wait should still wait for pending images');
  } finally {
    await context.close();
  }
});

test('image waiting can be disabled', async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page = await context.newPage();
  try {
    await page.route('**/slow.png', () => new Promise(() => {}));
    await page.goto(fixture('lazy-images.html'), { waitUntil: 'load' });
    const startedAt = performance.now();
    await waitForImages(page, 'none', { timeout: 1000 });
    assert.ok(performance.now() - startedAt < 100);
  } finally {
    await context.close();
  }
});
