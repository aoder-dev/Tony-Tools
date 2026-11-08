# Tony's Tools

A dockable **Adobe After Effects** panel for layer utilities, captions, Twixtor/flowframe workflows, beat markers, easing graphs and a global theme system. Built as a CEP extension: plain HTML/CSS/JS with ExtendScript, no build step and no runtime dependencies.

## Requirements

- After Effects 2024 (24.x) - primary target. The CEP manifest covers AE 2020-2026 (`[17.0,99.9]`).
- CEP 9 or newer runtime (ships with AE 2019 and later).
- Windows.

## Install (unsigned development build)

1. Enable `PlayerDebugMode` for the CEP runtimes (one-time, per user). In Registry Editor, add a **String value** named `PlayerDebugMode` set to `1` under each of:
   - `HKEY_CURRENT_USER\Software\Adobe\CSXS.11`
   - `HKEY_CURRENT_USER\Software\Adobe\CSXS.10`
   - `HKEY_CURRENT_USER\Software\Adobe\CSXS.9`
2. Copy or symlink the `AE-Layers-Tool` folder into your CEP extensions directory:

   ```
   %APPDATA%\Adobe\CEP\extensions\AE-Layers-Tool
   ```

3. Restart After Effects and open **Window > Extensions > AE Layer Tools**.

With `PlayerDebugMode` enabled the panel does not need to be signed and no `.zxp` installer is required. For a signed distribution, package it with `ZXPSignCmd`.

## Features

### Layers
- **Active comp stats** - layers, adjustment layers, nulls, precomps, text layers, effect count, keyframe count and most-used effect, read live from `app.project`.
- **KF Assistant**
  - *Stretch KF -> Layer* re-times every keyframe of the selected layers so the first key sits on the layer in point and the last on its out point, without changing the layer duration or its `stretch`. It walks nested property groups (effects, masks, shape contents), skips Time Remapping, keeps locked layers locked and carries over values, interpolation and temporal ease where AE allows it.
  - *Trim Layer -> KF* trims the layer in and out points to its first and last keyframe.
- **Pre-Compose** - Auto Pre-Compose with Leave attributes / Move attributes / Adjust comp modes.
- **User presets** - scans the AE `User Presets` folder for `.ffx` presets, with search and click-to-apply on the selected layers.
- **Adj. Layer / Null Object** - steppers (1-20) that create adjustment layers or nulls.

### Captions
Paste `seconds | text` lines and set duration and font size to generate real AE text layers (centered, near the bottom of the comp). Captions can be removed again by layer name.

### Twixtor Studios
Anime/Film flowframe modes (frame blending + Pixel Motion, precompose into `[Flowframe]` comps, time-remap speed, optional source-resolution precomps), Align Clips To Beats, Fit Between Beats, and an inline time-remap cubic-bezier editor with Apply to Keyframes and Read values from AE.

### Beats (BeatMark Pro)
- **Audio layer** dropdown and Refresh, plus **Generate Audio Amplitude Layer**, which runs AE's *Animation > Keyframe Assistant > Convert Audio to Keyframes* command through `app.findMenuCommandId` / `app.executeCommand` (the audio layer must be selected in the timeline). A usable existing amplitude layer offers reuse or regeneration, and the status distinguishes missing layer, no usable keyframes and ready.
- **Detection** - Strongest Beats or All Beats, local-peak detection over the real `Both Channels -> Slider` keyframes with mode-specific thresholds and minimum beat spacing, frame-snapped to the comp.
- **Marker names** - Default ("Beat"), Custom, Sequential (prefix + number).
- **Marker colours** - Random, Single (AE's 16 label colours, default Aqua) or Strength Based (red = strongest, cooler colours for weaker peaks).
- **Buttons** - Generate Beat Markers (undoable, duplicate-safe), Clear Markers (removes only tool-generated beat markers and preserves unrelated ones) and Remove Amp Layers (confirms first, never touches the original audio).

### Graphs
Full cubic-bezier editor with 12 presets (Linear to Back Out), draggable control points, manual `cubic-bezier(...)` input, copy, read current easing from AE, set linear and apply temporal ease to the selected keys or all keys of the selected layers. Influence is sent inside AE's legal 0.1-100 range.

### Theme
Global accent colour (swatches and custom picker), four darkness levels and six presets (Charcoal, Midnight, Warm Amber, Violet, Teal, Monochrome), persisted in `localStorage` and restored on reopen.

## Repository layout

```
AE-Layers-Tool/        CEP extension source
|- CSXS/manifest.xml   CEP manifest (AEFT 17.0-99.9, CEP 9 runtime)
|- index.html          panel UI (5 tabs, dialogs, toasts)
|- css/styles.css      dark neon theme
|- js/main.js          frontend logic and evalScript bridge
|- js/CSInterface.js   minimal CEP bridge
|- jsx/host.jsx        ExtendScript: all native AE operations
|- .debug              remote debug port (8092)
|- .gitignore
|- tools/check.ps1     static consistency check
`- docs/reference/     reference dumps (ref-bundle.js, ref-css.css, ref-home.html, ref-page.html)
LICENSE                MIT
README.md              this file
```

## Checks

Run from any directory:

```
powershell -ExecutionPolicy Bypass -File AE-Layers-Tool\tools\check.ps1
```

It verifies that the CEP manifest is well-formed, that every element id used by `main.js` exists in `index.html`, that the host functions the panel calls are defined in `host.jsx`, and that both scripts keep balanced braces and parentheses.

## Debugging

With `AE-Layers-Tool/.debug` present, open `http://localhost:8092` in Chrome while the panel is running to inspect its DOM and console.

## Compatibility

- After Effects 2024 (24.x) is the primary target; the manifest host range `[17.0,99.9]` covers AE 2020-2026.
- ExtendScript host script (ES3) using only APIs available in AE 24.x (precompose, timeRemapEnabled, setTemporalEaseAtKey, markerProperty, applyPreset).
- Panel JavaScript is ES5-compatible for the CEP 9 Chromium engine.
- Windows only, matching the original.

## Status

The manifest and scripts pass the static checks above. Host operations use real `app.project`, comp, layer and marker APIs with undo groups, but the panel has not been exercised against a live AE 2024 host in this repository. Install it with the steps above and test each feature in a scratch project first.

## License

Released under the [MIT License](LICENSE).
