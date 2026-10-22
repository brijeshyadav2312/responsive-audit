import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILES,
  contextOptions,
  getProfiles,
  listGroups,
  viewportHeightForWidth,
} from '../scripts/devices.mjs';

test('has 22 unique profiles', () => {
  assert.equal(PROFILES.length, 22);
  assert.equal(new Set(PROFILES.map((profile) => profile.name)).size, PROFILES.length);
});

test('exposes all device groups', () => {
  assert.deepEqual(listGroups(), [
    'phone',
    'tablet',
    'foldable',
    'mobile',
    'laptop',
    'desktop',
    'tv',
    'web',
    'all',
  ]);
});

test('all group returns every profile in its natural orientation', () => {
  const profiles = getProfiles({ group: 'all' });
  assert.equal(profiles.length, 22);
  const tv = profiles.filter((profile) => profile.group === 'tv');
  assert.deepEqual(
    tv.map((profile) => profile.width + 'x' + profile.height),
    ['1280x720', '1920x1080']
  );
  assert.ok(tv.every((profile) => profile.orientation === 'landscape'));
});

test('mobile group includes phones, tablets, and foldables', () => {
  assert.equal(getProfiles({ group: 'mobile' }).length, 13);
});

test('laptop and desktop profiles keep landscape dimensions', () => {
  const laptops = getProfiles({ group: 'laptop' });
  assert.ok(laptops.every((profile) => profile.width > profile.height));
  assert.equal(laptops[0].width + 'x' + laptops[0].height, '1280x720');
  const desktops = getProfiles({ group: 'desktop' });
  assert.ok(desktops.every((profile) => profile.width > profile.height));
});

test('both orientations expands portable profiles only', () => {
  const phones = getProfiles({ group: 'phone', orientations: 'both' });
  assert.equal(phones.length, 14);
  assert.ok(phones.some((profile) => profile.name === 'phone-ios-landscape'));
  assert.equal(
    phones.find((profile) => profile.name === 'phone-ios-landscape').width + 'x' +
      phones.find((profile) => profile.name === 'phone-ios-landscape').height,
    '844x390'
  );
  assert.equal(getProfiles({ group: 'desktop', orientations: 'both' }).length, 3);
});

test('rejects unknown groups and orientations', () => {
  assert.throws(() => getProfiles({ group: 'watch' }), /Unknown device group/);
  assert.throws(() => getProfiles({ group: 'all', orientations: 'sideways' }), /Unknown orientation/);
});

test('maps sweep widths to representative heights', () => {
  assert.equal(viewportHeightForWidth(320), 568);
  assert.equal(viewportHeightForWidth(390), 844);
  assert.equal(viewportHeightForWidth(1440), 900);
  assert.equal(viewportHeightForWidth(1920), 1080);
});

test('contextOptions enables mobile emulation for portable Chromium profiles', () => {
  const profile = getProfiles({ group: 'phone' }).find((item) => item.name === 'phone-ios');
  const options = contextOptions(profile, { engine: 'chromium' });
  assert.equal(options.isMobile, true);
  assert.equal(options.hasTouch, true);
  assert.equal(options.deviceScaleFactor, 3);
  assert.deepEqual(options.viewport, { width: 390, height: 844 });
  assert.match(options.userAgent, /iPhone/);
  assert.equal(options.reducedMotion, 'no-preference');
});

test('contextOptions can emulate reduced motion explicitly', () => {
  const profile = getProfiles({ group: 'phone' })[0];
  const options = contextOptions(profile, { reducedMotion: 'reduce' });
  assert.equal(options.reducedMotion, 'reduce');
});

test('contextOptions omits isMobile for Firefox', () => {
  const profile = getProfiles({ group: 'phone' })[0];
  const options = contextOptions(profile, { engine: 'firefox' });
  assert.equal(options.isMobile, undefined);
  assert.equal(options.hasTouch, true);
});

test('contextOptions does not enable mobile emulation for desktop profiles', () => {
  const profile = getProfiles({ group: 'desktop' })[0];
  const options = contextOptions(profile, { engine: 'chromium' });
  assert.equal(options.isMobile, undefined);
  assert.equal(options.hasTouch, false);
  assert.equal(options.deviceScaleFactor, 1);
});
