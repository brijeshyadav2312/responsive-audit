const IOS_PHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IOS_TABLET_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const ANDROID_FOLD_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-F946B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TV_UA =
  'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7233) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Silk/124.0.0';

export const PROFILES = [
  {
    name: 'phone-se',
    label: 'iPhone SE (1st gen)',
    group: 'phone',
    os: 'ios',
    engine: 'webkit',
    width: 320,
    height: 568,
    dpr: 2,
    touch: true,
    mobile: true,
    notch: false,
    ua: IOS_PHONE_UA,
  },
  {
    name: 'phone-ios-se3',
    label: 'iPhone SE (2nd/3rd gen)',
    group: 'phone',
    os: 'ios',
    engine: 'webkit',
    width: 375,
    height: 667,
    dpr: 2,
    touch: true,
    mobile: true,
    notch: false,
    ua: IOS_PHONE_UA,
  },
  {
    name: 'phone-android-compact',
    label: 'Android compact phone',
    group: 'phone',
    os: 'android',
    engine: 'chromium',
    width: 360,
    height: 640,
    dpr: 3,
    touch: true,
    mobile: true,
    notch: false,
    ua: ANDROID_PHONE_UA,
  },
  {
    name: 'phone-android',
    label: 'Android phone (360)',
    group: 'phone',
    os: 'android',
    engine: 'chromium',
    width: 360,
    height: 800,
    dpr: 3,
    touch: true,
    mobile: true,
    notch: false,
    ua: ANDROID_PHONE_UA,
  },
  {
    name: 'phone-ios',
    label: 'iPhone 14/15',
    group: 'phone',
    os: 'ios',
    engine: 'webkit',
    width: 390,
    height: 844,
    dpr: 3,
    touch: true,
    mobile: true,
    notch: true,
    ua: IOS_PHONE_UA,
  },
  {
    name: 'phone-pixel',
    label: 'Google Pixel 8',
    group: 'phone',
    os: 'android',
    engine: 'chromium',
    width: 412,
    height: 915,
    dpr: 2.625,
    touch: true,
    mobile: true,
    notch: false,
    ua: ANDROID_PHONE_UA,
  },
  {
    name: 'phone-ios-max',
    label: 'iPhone Pro Max',
    group: 'phone',
    os: 'ios',
    engine: 'webkit',
    width: 430,
    height: 932,
    dpr: 3,
    touch: true,
    mobile: true,
    notch: true,
    ua: IOS_PHONE_UA,
  },
  {
    name: 'foldable-cover',
    label: 'Foldable cover screen',
    group: 'foldable',
    os: 'android',
    engine: 'chromium',
    width: 344,
    height: 882,
    dpr: 2.5,
    touch: true,
    mobile: true,
    notch: false,
    ua: ANDROID_FOLD_UA,
  },
  {
    name: 'foldable-open',
    label: 'Foldable inner screen',
    group: 'foldable',
    os: 'android',
    engine: 'chromium',
    width: 884,
    height: 1104,
    dpr: 2.5,
    touch: true,
    mobile: true,
    notch: false,
    ua: ANDROID_FOLD_UA,
  },
  {
    name: 'tablet-ipad-mini',
    label: 'iPad mini',
    group: 'tablet',
    os: 'ios',
    engine: 'webkit',
    width: 768,
    height: 1024,
    dpr: 2,
    touch: true,
    mobile: true,
    notch: false,
    ua: IOS_TABLET_UA,
  },
  {
    name: 'tablet-android',
    label: 'Android tablet',
    group: 'tablet',
    os: 'android',
    engine: 'chromium',
    width: 800,
    height: 1280,
    dpr: 2,
    touch: true,
    mobile: true,
    notch: false,
    ua: ANDROID_TABLET_UA,
  },
  {
    name: 'tablet-ipad-air',
    label: 'iPad Air',
    group: 'tablet',
    os: 'ios',
    engine: 'webkit',
    width: 820,
    height: 1180,
    dpr: 2,
    touch: true,
    mobile: true,
    notch: false,
    ua: IOS_TABLET_UA,
  },
  {
    name: 'tablet-ipad-pro',
    label: 'iPad Pro 12.9',
    group: 'tablet',
    os: 'ios',
    engine: 'webkit',
    width: 1024,
    height: 1366,
    dpr: 2,
    touch: true,
    mobile: true,
    notch: false,
    ua: IOS_TABLET_UA,
  },
  {
    name: 'laptop-1280',
    label: 'Small laptop (1280x720)',
    group: 'laptop',
    os: 'windows',
    engine: 'chromium',
    width: 1280,
    height: 720,
    dpr: 1,
    touch: false,
    mobile: false,
    notch: false,
    ua: DESKTOP_UA,
  },
  {
    name: 'laptop-1366',
    label: 'Common Windows laptop',
    group: 'laptop',
    os: 'windows',
    engine: 'chromium',
    width: 1366,
    height: 768,
    dpr: 1,
    touch: false,
    mobile: false,
    notch: false,
    ua: DESKTOP_UA,
  },
  {
    name: 'laptop-mac',
    label: 'MacBook Air',
    group: 'laptop',
    os: 'macos',
    engine: 'chromium',
    width: 1440,
    height: 900,
    dpr: 2,
    touch: false,
    mobile: false,
    notch: false,
    ua: MAC_UA,
  },
  {
    name: 'laptop-win-hidpi',
    label: 'Windows 150% scaling',
    group: 'laptop',
    os: 'windows',
    engine: 'chromium',
    width: 1536,
    height: 864,
    dpr: 1.25,
    touch: false,
    mobile: false,
    notch: false,
    ua: DESKTOP_UA,
  },
  {
    name: 'desktop-1920',
    label: '1080p desktop',
    group: 'desktop',
    os: 'windows',
    engine: 'chromium',
    width: 1920,
    height: 1080,
    dpr: 1,
    touch: false,
    mobile: false,
    notch: false,
    ua: DESKTOP_UA,
  },
  {
    name: 'desktop-2560',
    label: 'QHD desktop',
    group: 'desktop',
    os: 'windows',
    engine: 'chromium',
    width: 2560,
    height: 1440,
    dpr: 1,
    touch: false,
    mobile: false,
    notch: false,
    ua: DESKTOP_UA,
  },
  {
    name: 'ultrawide-3440',
    label: 'Ultrawide monitor',
    group: 'desktop',
    os: 'windows',
    engine: 'chromium',
    width: 3440,
    height: 1440,
    dpr: 1,
    touch: false,
    mobile: false,
    notch: false,
    ua: DESKTOP_UA,
  },
  {
    name: 'tv-720',
    label: 'HD TV (1280x720)',
    group: 'tv',
    os: 'tv',
    engine: 'chromium',
    width: 1280,
    height: 720,
    dpr: 1,
    touch: false,
    mobile: false,
    notch: false,
    ua: TV_UA,
  },
  {
    name: 'tv-1080',
    label: 'Full HD TV (1920x1080)',
    group: 'tv',
    os: 'tv',
    engine: 'chromium',
    width: 1920,
    height: 1080,
    dpr: 1,
    touch: false,
    mobile: false,
    notch: false,
    ua: TV_UA,
  },
];

export const GROUPS = {
  phone: ['phone'],
  tablet: ['tablet'],
  foldable: ['foldable'],
  mobile: ['phone', 'tablet', 'foldable'],
  laptop: ['laptop'],
  desktop: ['desktop'],
  tv: ['tv'],
  web: ['phone', 'tablet', 'foldable', 'laptop', 'desktop'],
  all: ['phone', 'tablet', 'foldable', 'laptop', 'desktop', 'tv'],
};

const PORTABLE = new Set(['phone', 'tablet', 'foldable']);

export function listGroups() {
  return Object.keys(GROUPS);
}

function cloneProfile(profile, orientation) {
  const natural = profile.width >= profile.height ? 'landscape' : 'portrait';
  const target = orientation === 'landscape' || orientation === 'portrait' ? orientation : natural;
  const swap = target !== natural && profile.width !== profile.height;

  if (!swap) {
    return { ...profile, orientation: target };
  }

  return {
    ...profile,
    name: profile.name + '-' + target,
    label: profile.label + ' (' + target + ')',
    width: profile.height,
    height: profile.width,
    orientation: target,
  };
}

export function getProfiles({ group = 'all', orientations = 'auto' } = {}) {
  const classes = GROUPS[String(group).toLowerCase()];
  if (!classes) {
    throw new Error(
      'Unknown device group "' + group + '". Use one of: ' + listGroups().join(', ')
    );
  }

  const base = PROFILES.filter((profile) => classes.includes(profile.group));
  const mode = String(orientations || 'auto').toLowerCase();
  if (!['auto', 'portrait', 'landscape', 'both'].includes(mode)) {
    throw new Error('Unknown orientation mode "' + orientations + '". Use auto, portrait, landscape, or both.');
  }

  const out = [];
  for (const profile of base) {
    const portable = PORTABLE.has(profile.group);
    if (mode === 'auto') {
      out.push(cloneProfile(profile, portable ? 'portrait' : 'landscape'));
    } else if (mode === 'both') {
      out.push(cloneProfile(profile, portable ? 'portrait' : 'landscape'));
      if (portable) out.push(cloneProfile(profile, 'landscape'));
    } else if (mode === 'landscape') {
      out.push(cloneProfile(profile, 'landscape'));
    } else {
      out.push(cloneProfile(profile, portable ? 'portrait' : 'landscape'));
    }
  }

  const seen = new Set();
  return out.filter((profile) => {
    if (seen.has(profile.name)) return false;
    seen.add(profile.name);
    return true;
  });
}

export function contextOptions(
  profile,
  { engine = 'chromium', reducedMotion = 'no-preference' } = {}
) {
  const options = {
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    hasTouch: Boolean(profile.touch),
    userAgent: profile.ua,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion,
  };

  if (profile.mobile && engine !== 'firefox') {
    options.isMobile = true;
  }

  return options;
}

const SWEEP_SOURCES = PROFILES.filter((profile) =>
  ['phone', 'tablet', 'laptop', 'desktop'].includes(profile.group)
);

export function viewportHeightForWidth(width) {
  let best = null;
  let bestDistance = Infinity;
  for (const profile of SWEEP_SOURCES) {
    const distance = Math.abs(profile.width - width);
    if (distance < bestDistance) {
      best = profile;
      bestDistance = distance;
    }
  }
  if (!best) return 900;
  return best.height;
}

export function deviceWidths() {
  return [...new Set(SWEEP_SOURCES.map((profile) => profile.width))].sort((a, b) => a - b);
}
