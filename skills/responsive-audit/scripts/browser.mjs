import { chromium, firefox, webkit } from 'playwright';

const ENGINES = { chromium, firefox, webkit };

export const SUPPORTED_ENGINES = Object.keys(ENGINES);

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function launchBrowser({ engine = 'chromium', channel, headed = false } = {}) {
  const name = String(engine || 'chromium').toLowerCase();
  const type = ENGINES[name];

  if (!type) {
    throw new Error(
      'Unknown engine "' + engine + '". Use one of: ' + SUPPORTED_ENGINES.join(', ')
    );
  }

  if (name !== 'chromium') {
    try {
      const browser = await type.launch({ headless: !headed });
      return { browser, engine: name, channel: null };
    } catch (error) {
      throw new Error(
        'Could not launch ' +
          name +
          '. Run "npx playwright install ' +
          name +
          '" and retry. ' +
          errorMessage(error)
      );
    }
  }

  const attempts = channel
    ? [{ channel, label: channel }]
    : [
        { label: 'bundled', options: {} },
        { label: 'chrome', options: { channel: 'chrome' } },
        { label: 'msedge', options: { channel: 'msedge' } },
      ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch({
        headless: !headed,
        ...(attempt.options || { channel: attempt.channel }),
      });
      return { browser, engine: 'chromium', channel: attempt.label };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    'Could not launch Chromium. Run "npx playwright install chromium", or pass --channel chrome / --channel msedge. ' +
      errorMessage(lastError)
  );
}
