# Tony's Tools

A dockable **Adobe After Effects** panel for layer utilities, captions, Twixtor/flowframe workflows, beat markers, easing graphs and a global theme system. Built as a CEP extension: plain HTML/CSS/JS with ExtendScript and no build step.

The extension lives in [`AE-Layers-Tool/`](AE-Layers-Tool/README.md), alongside its full documentation.

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

- **Layers** - comp statistics, keyframe stretch/trim helpers, auto pre-compose, `.ffx` user presets, adjustment-layer and null steppers.
- **Captions** - paste `seconds | text` lines and generate real text layers.
- **Twixtor Studios** - Anime/Film flowframe modes, beat alignment, cubic-bezier time-remap editor.
- **Beats (BeatMark Pro)** - audio-amplitude analysis, peak detection, marker names and colours, duplicate-safe marker generation.
- **Graphs** - full cubic-bezier easing editor with presets, copy, read-from-AE and apply.
- **Theme system** - accent colour, four darkness levels, six presets, persisted in `localStorage`.

See [`AE-Layers-Tool/README.md`](AE-Layers-Tool/README.md) for the complete feature list, file layout and implementation notes.

## Repository layout

```
AE-Layers-Tool/        CEP extension source
|- CSXS/manifest.xml   CEP manifest (AEFT 17.0-99.9, CEP 9 runtime)
|- index.html          panel UI
|- css/styles.css      theme
|- js/main.js          frontend logic and evalScript bridge
|- js/CSInterface.js   minimal CEP bridge
|- jsx/host.jsx        ExtendScript operations
|- .debug              remote debug port (8092)
`- README.md           extension documentation

*.ps1, ref-*.*         development scratch: bundle inspection and validation scripts
```

The loose PowerShell scripts and `ref-` dumps at the repository root are development artifacts used while building the panel. They are not part of the extension and are not needed to install or run it.

## Debugging

With `.debug` present, open `http://localhost:8092` in Chrome while the panel is running to inspect its DOM and console.

## Status

The manifest and scripts have been validated statically. Host operations use real `app.project`, comp, layer and marker APIs with undo groups, but the panel has not been exercised against a live AE 2024 host in this repository. Install it using the steps above and test each feature in a scratch project first.
