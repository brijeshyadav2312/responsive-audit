# Device coverage

The matrix favors breakpoint-adjacent and common real-world CSS widths over an exhaustive catalog. Source of truth: `scripts/devices.mjs`. The JSON mirror is `references/devices.json`.

## Profiles

| Name | Group | OS | CSS viewport | DPR | Touch |
|------|-------|----|--------------|-----|-------|
| phone-se | phone | iOS | 320x568 | 2 | yes |
| phone-ios-se3 | phone | iOS | 375x667 | 2 | yes |
| phone-android-compact | phone | Android | 360x640 | 3 | yes |
| phone-android | phone | Android | 360x800 | 3 | yes |
| phone-ios | phone | iOS | 390x844 | 3 | yes |
| phone-pixel | phone | Android | 412x915 | 2.625 | yes |
| phone-ios-max | phone | iOS | 430x932 | 3 | yes |
| foldable-cover | foldable | Android | 344x882 | 2.5 | yes |
| foldable-open | foldable | Android | 884x1104 | 2.5 | yes |
| tablet-ipad-mini | tablet | iOS | 768x1024 | 2 | yes |
| tablet-android | tablet | Android | 800x1280 | 2 | yes |
| tablet-ipad-air | tablet | iOS | 820x1180 | 2 | yes |
| tablet-ipad-pro | tablet | iOS | 1024x1366 | 2 | yes |
| laptop-1280 | laptop | Windows | 1280x720 | 1 | no |
| laptop-1366 | laptop | Windows | 1366x768 | 1 | no |
| laptop-mac | laptop | macOS | 1440x900 | 2 | no |
| laptop-win-hidpi | laptop | Windows | 1536x864 | 1.25 | no |
| desktop-1920 | desktop | Windows | 1920x1080 | 1 | no |
| desktop-2560 | desktop | Windows | 2560x1440 | 1 | no |
| ultrawide-3440 | desktop | Windows | 3440x1440 | 1 | no |
| tv-720 | tv | TV | 1280x720 | 1 | no |
| tv-1080 | tv | TV | 1920x1080 | 1 | no |

## Groups

| Group | Contents | Default count |
|-------|----------|---------------|
| `phone` | seven phone profiles | 7 |
| `foldable` | cover and inner screens | 2 |
| `tablet` | four tablet profiles | 4 |
| `mobile` | phone + tablet + foldable | 13 |
| `laptop` | four laptop profiles | 4 |
| `desktop` | three desktop profiles | 3 |
| `tv` | HD and Full HD | 2 |
| `web` | everything except TV | 20 |
| `all` | every profile | 22 |

The CLI defaults to `web` (20 profiles). TV is opt-in with `--devices tv` or `--devices all`.

## Orientation

- `auto` (default): portable profiles use portrait; laptops, desktops, and TVs use landscape.
- `both`: portable profiles are tested in portrait and landscape. Each landscape variant gets a `-landscape` suffix. Non-portable profiles are not rotated.
- `landscape`: portable profiles are rotated. Already-landscape profiles keep their dimensions.
- `portrait`: portable profiles stay portrait. Non-portable profiles stay in their natural landscape orientation.

Rotation swaps width and height but keeps DPR, touch, and UA. It does not simulate a hinge, posture, or app continuity.

## Emulation details

Each profile sets:

- `viewport` and `screen` in CSS pixels
- `deviceScaleFactor`
- `hasTouch`
- `isMobile` for portable profiles on Chromium and WebKit (omitted for Firefox)
- a representative user agent for the OS and browser family
- `reducedMotion: no-preference` by default; `--reduced-motion` switches to `reduce`

This changes UA sniffing, media features, touch events, and DPR. It does not reproduce real Safari rendering, notch geometry, virtual keyboards, or TV platform browsers.

## TV guidance

- There is no universal "Android TV browser". Common web targets are Fire TV Silk, Samsung Tizen, LG webOS, and embedded WebViews.
- Design at a 960x540 base and scale to 1920x1080 where possible.
- Keep critical text, controls, and media inside a 5% overscan inset: 48px horizontal and 27px vertical at the 960 base.
- Provide a visible `:focus-visible` ring and logical focus order for D-pad navigation.
- Use at least 12px text and 48x48 focus targets.
- Prefer paged or horizontal navigation over long vertical scroll.

The `tv-*` rules encode these heuristics. They are not a Tizen or webOS certification.

## Adding a profile

Add an entry to `PROFILES` in `scripts/devices.mjs` with a unique name, group, OS, width, height, DPR, touch, mobile, notch, and UA. Add the same name to `references/devices.json`, then run `npm run validate` and `npm test`. Groups are selected by the `group` field, so no extra registry edit is needed.
