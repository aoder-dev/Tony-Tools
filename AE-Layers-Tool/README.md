# Tony's Tools — CEP Extension for After Effects 2024

A dockable After Effects 2024 (24.x) CEP extension: layer utilities, caption generation, Twixtor/flowframe workflow, audio beat markers, keyframe easing graphs, and a global theme system (accent color, darkness, presets). Pure HTML/CSS/JS + ExtendScript — no React, no build step.

## Features

**Header** — logo, "Reload Script" (reloads the panel + host scripts),
Cache (clear AE disk cache via Node fs), Settings (theme presets, accent color,
darkness — persisted and applied across the whole UI).

**Layers tab**
- **Active Comp stats** — layers, adjustment layers, nulls, precomps, text layers,
  effect count, keyframe count, most-used effect (live from `app.project`).
- **KF Assistant** — *Stretch KF →' Layer* (stretch keyframes to span the layer
  duration) and *Trim Layer →' KF* (trim layer to first/last keyframe). Multi-layer,
  locked-layer-safe, undoable.
- **Pre-Compose** — Auto Pre-Compose with Leave attributes / Move attributes /
  Adjust comp modes (`comp.layers.precompose`, undo group, comp duration adjusted).
- **User Presets** — scans the AE `User Presets` folder for `.ffx` presets, search,
  click to apply to selected layers (`layer.applyPreset`).
- **Adj. Layer / Null Object** — steppers (1–20) creating adjustment layers or nulls.

**Captions tab** — paste `seconds | text` lines, duration + font size, generates
real AE text layers (centered, bottom of comp), remove captions by name.

**Twixtor Studios tab** — Anime/Film Twixtor modes (frame blend + Pixel Motion,
precompose into `[Flowframe]` comps, time-remap speed, optional source-resolution
precomps), Align Clips To Beats, Fit Between Beats, and an inline Time Remap
cubic-bezier easing editor with Apply to Keyframes / Read values from AE.

**Beats tab (BeatMark Pro)**
- **Audio Layer (place markers on)** — dropdown of audio layers + Refresh, plus
  **Generate Audio Amplitude Layer**, which runs AE's real
  *Animation > Keyframe Assistant > Convert Audio to Keyframes* via
  `app.findMenuCommandId` / `app.executeCommand` (requires the audio layer to be
  selected in the timeline). Reuse/regenerate prompt when a usable layer exists.
  Status distinguishes missing layer / no usable keyframes / ready.
- **Detection Settings** — Strongest Beats or All Beats: local-peak detection over
  real `Both Channels → Slider` keyframes, mode-specific thresholds and minimum
  beat separation, frame-snapped to the comp timeline.
- **Marker Names** — Default ("Beat"), Custom, Sequential (prefix + number).
- **Marker Colors** — Random, Single (AE's 16 label colors, default Aqua), or
  Strength Based (red = strongest → cooler colors for weaker peaks), using
  `MarkerValue.labelColor` (comp markers support label colors).
- **Buttons** — Generate Beat Markers (undoable, duplicate-safe), Clear Markers
  (removes only tool-generated beat markers; unrelated markers preserved), and
  Remove Amp Layers (confirms first; never touches the original audio).

**Graphs tab** — full cubic-bezier editor: 12 presets (Linear … Back Out),
draggable control points on canvas, manual `cubic-bezier(...)` input, copy,
read current easing from AE, set linear, Apply to Keyframes (temporal ease on
selected keys or all keys of every selected layer).

**Theme system** — global accent color (swatches + custom picker), 4-level
darkness, and presets (Charcoal, Midnight, Warm Amber, Violet, Teal, Monochrome).
Default look: true-black AOD-style surfaces with a muted red accent. Persisted
via `localStorage` and restored on reopen.

## Structure

```
AE-Layers-Tool/
├── CSXS/manifest.xml      # CEP manifest, AEFT [17.0,99.9], CEP 9 runtime
├── .debug                 # remote debug port (dev only)
├── index.html             # panel UI (5 tabs, dialogs, toasts)
├── css/styles.css         # dark neon theme
├── js/CSInterface.js      # minimal CEP bridge
├── js/main.js             # frontend logic + evalScript communication layer
└── jsx/host.jsx           # ExtendScript: all native AE operations
```

## Install (development, unsigned)

1. Enable PlayerDebugMode (one-time, per user):
   - Windows: registry `HKEY_CURRENT_USER\Software\Adobe\CSXS.11` (also CSXS.9/10
     for older CEP runtimes) → new String value `PlayerDebugMode` = `1`.
2. Copy/symlink the `AE-Layers-Tool` folder to the extensions folder:
   - Windows: `C:\Users\<you>\AppData\Roaming\Adobe\CEP\extensions\AE-Layers-Tool`
3. Restart After Effects → menu `Window > Extensions > AE Layer Tools`.

Note: with PlayerDebugMode the extension does **not** need to be signed, and no
ZXP installer is required. For a signed distribution, package with ZXPSignCmd
(zxp package / sign) and install the .zxp.

## Debugging

With `.debug` present, while the panel is open browse to
`http://localhost:8092` in Chrome to inspect the panel's DOM/console.

## Compatibility

- After Effects 2024 (24.x) — primary target; AE 2020–2026 also covered by the
  manifest host range `[17.0,99.9]`.
- ExtendScript host script (ES3 syntax) — all APIs used (precompose,
  timeRemapEnabled, setTemporalEaseAtKey, markerProperty, applyPreset) are
  available in AE 24.x.
- Panel JS is ES5-compatible (CEP 9+ Chromium engine).
- Windows only, matching the original.

## Testing status

- Manifest XML validated (well-formed, required CSXS 9.0 runtime).
- JS/JSX syntax validated with static checks.
- All host operations use real `app.project` / comp / layer APIs with undo
  groups and validation — **not** verified in a live AE 2024 host in this
  environment; install per the instructions above and test each button in a
  scratch project first.
