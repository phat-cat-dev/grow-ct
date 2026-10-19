# Theme manager workshop

A working HTML/JavaScript model of the floating studio header. The original
header and its scripts are unchanged. No React packages or build step are added.

## Run

From `ab-theme-studio`, run `npm start`, then open:

<http://localhost:5173/site/components/tools/theme-manager/>

Use HTTP, not a `file:` URL: ES modules and the studio API need a server.
Connection and API failures are reported in the component's status area.

## What works

- The Mode icon button opens Light, Dark, Contrast and System modes.
- The Schemes code icon button opens scheme editing and build tools.
- The palette button beside Shuffle opens Colour harmony, with the theory-bar
  swatches first, followed by all studio harmony presets, 3-10 colour counts,
  and foundation hue/saturation/lightness controls. Unlock the source to edit;
  the panel can still be inspected while locked. Select a swatch to apply it
  as the main accent. Scheme and harmony panels share the same panel styling
  and only one of those panels opens at a time; Escape returns focus.
- Harmony settings and selected accents use the existing studio colour-system
  schema and survive save/load/import/build.
  Swatch selection retains the foundation so selecting another does not rotate
  the whole palette. Controls apply when their value is committed.
- A separate padlock immediately left of Palette freezes only the harmony
  preset and colour count. With the base colour unlocked, hue/saturation/lightness,
  paste, Random and swatch selection remain available. This preference is stored
  as `themeManager.harmonyLocked`; loading a scheme restores its saved preference.
  Explicit scheme loads still recall their stored colour settings.
- Locks operate independently for editing and Random:
  | Harmony lock | Base lock | Random changes |
  | --- | --- | --- |
  | Locked | Locked | Nothing (button disabled) |
  | Locked | Unlocked | Base colour only |
  | Unlocked | Locked | Harmony preset/count only |
  | Unlocked | Unlocked | Both |
  A locked base still allows harmony preset/count edits, but not source sliders,
  pasted colours or accent selection. Random chooses a different harmony preset.
- Source-group order: Notifications, harmony lock, Palette, colour field,
  Random, base-colour lock.
- Harmony panel order: swatches; preset/count/button-appearance selectors;
  hue/saturation/lightness sliders; heading and help text. The selector and slider
  rows each have three columns on desktop and stack on mobile.
- Button appearance applies to all manager buttons (including swatches and
  notification arrows): Inverse (solid-to-outline), Shaded, Outline
  (outline-to-solid), Ghost and Soft. These scoped styles follow the studio's
  existing button appearance patterns without importing its global stylesheet.
  The preference is saved as `themeManager.buttonAppearance` and remains editable
  regardless of colour locks. Selected/expanded controls retain an inset marker.
- All control-bar icons use Google Material Symbols Outlined: `contrast`,
  `shuffle`, `lock` / `lock_open`, and `code`. The stylesheet loads the Google
  font; an internet connection is needed for the icons. Buttons retain accessible
  names and native title tooltips independently of the font.
- Independent No-motion toggle, plus live OS reduced-motion preferences.
- Contrast uses black/white text (21:1) and #595959 control borders on white
  (approximately 7:1). The source field becomes black-on-white too. These
  target WCAG 2.2 text and non-text contrast criteria; this is not a claim of
  whole-page WCAG conformance.
- Locked source colour by default; unlock to edit or shuffle.
- Opaque CSS colour entry: Enter applies, Escape restores.
- Expandable tools, keyboard focus indicators and Escape-to-close.
- Refresh/list, load, save and save-and-build using the existing studio API.
- Custom CSS editing, scheme JSON import/export, built CSS copying and downloads.
- Scoped live colour/appearance preview, multiple instances and cleanup.
- A shared notification service delivers tool messages to a separate bar whose
  height tracks the actual control-bar height, including responsive wrapping.
  Long messages scroll inside the keyboard-focusable bar rather than changing
  its height. Each message fades in and expires after 10 seconds; a new message
  restarts the timer. The hidden bar reserves its space to avoid layout jumps
  and is removed from keyboard navigation and the accessibility tree.
- The bell button beside the colour lock switches this instance's notifications
  off/on, including shared tool messages and errors. Muting hides the current
  message immediately; unmuting announces that notifications are enabled rather
  than replaying stale messages. The preference is saved in
  `themeManager.notificationsEnabled`. Other subscribed bars are unaffected.
  No-motion (or system reduced motion) disables fading, not the 10-second timer.
- The notification row uses Back / message / Forward controls, matching the
  source-colour group's inset field colours and icon buttons, with left-aligned
  message text. Contrast mode keeps both fields black-on-white. Arrows navigate
  this bar's notification history, never colour settings. Browsing restarts the
  10-second timer and restores the message source and severity. New deliveries
  append to history and show the newest message without discarding older entries.
  Arrows disable at the history boundaries. History is in-memory for this mount
  only; messages received while muted are not recorded.

Saving **overwrites the named server scheme**, just like the main studio.
Choose a new name to keep an existing scheme. Builds also save before generating
`dist/<name>/theme.css` and `tokens.json`. Copy/download use the last successful
build; edits do not silently trigger a build or another save.

The small preview demonstrates source colour and appearance only, not all studio
typography/layout/card settings. Loaded settings are preserved in scheme records
and passed to the existing server builder. Custom CSS is **not injected** into
the workshop: it is saved and included in the full build.

Pasting or shuffling sets the studio colour system's fixed `baseColor` so the
exact selected colour survives save/load/build. Locking in this component
prevents editing; its value is stored as `themeManager.locked`. Other palette
settings are retained. This is deliberately simpler than the studio's full
palette-selection workflow.

Contrast and No-motion are workshop preferences stored in
`themeManager.appearance` and `themeManager.noMotion`. For compatibility with the
original studio, Contrast saves `themeMode: "light"` alongside its workshop
appearance. The original studio and generated theme bundle do not implement
these workshop-only accessibility overrides.

## Shared notifications

Other tools can publish to the same display without importing the theme manager:

```js
import { notifications } from '../notifications/notification-service.js';

notifications.publish({
  source: 'Asset tools',
  message: 'Assets exported.',
  level: 'success', // info | success | error
});
```

The shared singleton delivers the latest message to all subscribed bars.
Use `createNotificationService()` for an isolated workspace/channel and pass it
as the `notificationService` mount option. A late subscriber receives the latest
message; destroying the bar unsubscribes it. Messages are rendered as text, never
HTML. The service delivers the latest message; each bar keeps its own browsable
notification history, without re-publishing recalled messages to other tools.
The reusable bar and service live beside this component in `../notifications/`.
Its `ResizeObserver` matches the control-bar border-box height exactly.

Modes are preview appearances; schemes are editable configuration records; themes
are the generated output built from schemes. Existing storage/API field names
are retained for compatibility.

Mode, Colour harmony and Schemes share full-width panels below the control-bar.
Only one is active at a time. Each fades in/out over 200ms; No-motion or system
reduced motion makes the change instant. The trigger toggles its panel, Escape
closes it and restores trigger focus, and clicking outside the manager closes
any active panel. Closed/fading-out panels are inert and hidden from assistive
technology, then removed from layout after the fade. Rapid toggles cancel the
previous animation rather than leaving stale panels open.

The Mode panel starts with four icon buttons (Light, Dark, Contrast, System),
each with a visible name under its Google Symbol and `aria-pressed` selected
state. Tab/Shift+Tab moves between buttons; Enter or Space selects a mode.
The two padlocks use white backgrounds with source-coloured icons when locked,
and source-coloured backgrounds with white icons when unlocked, independently of the
button-appearance preference (including hover and focus).
Mode-panel toggles retain a filled selected state using the preview colours
and filled symbols. Other buttons follow the selected button appearance, and
harmony swatches retain their palette colours.
No-motion is a separate square icon toggle
aligned right below the options, with an accessible name and pressed state.
The Mode heading and Preview mode caption are not displayed; the panel and
mode group retain their accessible names.

## Files and responsibilities

| File | Responsibility | React equivalent |
| --- | --- | --- |
| [index.html](index.html) | Mount point and illustrative preview | Application/page |
| [theme-manager.css](theme-manager.css) | Scoped component styles and tokens | Same CSS, no conversion needed |
| [theme-manager.js](theme-manager.js) | Local state, rendering, handlers, cleanup | Component + hooks |
| [studio-adapter.js](studio-adapter.js) | Existing validators, colour helpers and HTTP APIs | Injected service/prop |

The UI has no imports from the larger studio. The adapter is the integration
boundary and reuses existing helpers instead of copying their validation logic.
In this checkout those helper imports resolve to
`../../.dev/assets/ab-them/public/site/`; deployments must preserve that layout
or supply their own adapter.
To use the UI outside this repository, provide an adapter implementing
`validate`, `colour`, `withColour`, `harmony`, `withHarmony`, `list`, `load`,
`randomize`, `save`, `build`, and `readCss`.

## Mounting contract

```js
import { mountThemeManager } from './theme-manager.js';
import { createStudioAdapter } from './studio-adapter.js';

const manager = mountThemeManager(document.querySelector('#manager'), {
  adapter: createStudioAdapter(),
  preview: document.querySelector('#preview'),
  onChange({ colour, mode, effectiveMode, locked, config }) {
    // Optional notification for the host application.
  },
});

const currentScheme = manager.getState(); // Validated copy including draft CSS.
// When the containing view is removed:
manager.destroy();
```

Use a dedicated, empty mount element. The preview defaults to the mount element;
it is not the document root. Separate instances should have separate preview
targets so their themes do not compete.

Pass `serverTools: false` for an embedded local design preview without a studio
API. Initial API connection is skipped and server refresh/load/save/build are
disabled. Colour, appearance, harmony and JSON import/export remain available.
The default remains `true` for the standalone studio workshop.

## React exercise: convert one control first

Do not rewrite everything at once. Start with the appearance buttons:

```jsx
import { useState } from 'react';

function AppearanceToggle({ mode, onModeChange }) {
  return (
    <div className="tm-modes" role="group" aria-label="Preview theme">
      {['light', 'dark', 'system'].map(value => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onModeChange(value)}
        >
          {value[0].toUpperCase() + value.slice(1)}
        </button>
      ))}
    </div>
  );
}

export default function ThemeManagerLesson() {
  const [mode, setMode] = useState('system');

  return <AppearanceToggle mode={mode} onModeChange={setMode} />;
}
```

This is a **learning snippet**, not a second mounted implementation. It needs a
React project to run and only demonstrates selected button state.

### What changed?

1. **State:** `useState` replaces the mutable `config.themeMode` variable.
2. **Props:** the child receives the mode and a callback; it does not own another
   copy of the parent's state.
3. **Events:** `onClick` replaces `addEventListener`.
4. **Rendering:** JSX describes the result; React updates the DOM. Do not port
   `innerHTML` or the manual `render()` calls into React.
5. **Syntax:** use `className`, `htmlFor`, and JS expressions inside braces.
   Keep `aria-*` attribute names unchanged.
6. **Lists:** each mapped button gets a stable `key`.

Next, add `locked`, the source colour and `open` as state. Derive disabled and
pressed attributes from that state. Keep the input draft separate from the
applied colour so invalid text never updates the preview.

Move OS-theme subscriptions into `useEffect` and return a cleanup function.
Use `useId` for label/panel IDs. Keep save/load/build in event handlers, passing
the adapter as a prop; do not save in a render function or mount effect.
Use `try/catch/finally` to set the error message and clear busy state.

The existing `mountThemeManager` can also be hosted temporarily inside a React
effect while migrating: mount once, then return `manager.destroy` from the
effect. Do not mount both implementations into the same element.

## Validation

From the repository root:

```powershell
node --test ab-theme-studio\src\theme-manager.test.mjs
```
