// AE Layer Tools — ExtendScript host (After Effects 2020-2026, ExtendScript / ES3)
// All functions are called via csInterface.evalScript("fnName(args)").

function getActiveComp() {
    var proj = app.project;
    if (!proj) return null;
    var item = proj.activeItem;
    if (item && item instanceof CompItem) return item;
    return null;
}

function requireComp() {
    var comp = getActiveComp();
    if (!comp) return { error: "Error: Open a composition first." };
    return comp;
}

function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ========================= STATS =========================

function getCompStats() {
    var proj = app.project;
    if (!proj) return "Error: No active project.";
    var comp = proj.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        return JSON.stringify({ compName: "(no comp selected)", totalLayers: 0, adjustmentLayers: 0, nullLayers: 0, precompLayers: 0, textLayers: 0, effectCount: 0, keyframeCount: 0, mostUsedEffect: "--" });
    }
    var stats = { compName: comp.name, totalLayers: comp.numLayers, adjustmentLayers: 0, nullLayers: 0, precompLayers: 0, textLayers: 0, effectCount: 0, keyframeCount: 0, mostUsedEffect: "--" };
    var fxMap = {};
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        try { if (layer.adjustmentLayer) stats.adjustmentLayers++; } catch (eA) {}
        try { if (layer.nullLayer) stats.nullLayers++; } catch (eN) {}
        try { if (layer.source && layer.source instanceof CompItem) stats.precompLayers++; } catch (eP) {}
        try { if (layer instanceof TextLayer) stats.textLayers++; } catch (eT) {}
        try {
            var fx = layer.property("ADBE Effect Parade");
            if (fx) {
                stats.effectCount += fx.numProperties;
                for (var j = 1; j <= fx.numProperties; j++) {
                    var nm = fx.property(j).name || fx.property(j).matchName;
                    fxMap[nm] = (fxMap[nm] || 0) + 1;
                }
            }
        } catch (eFx) {}
        try {
            for (var pi = 1; pi <= layer.numProperties; pi++) {
                var pg = layer.property(pi);
                if (pg && pg.numProperties) {
                    for (var k = 1; k <= pg.numProperties; k++) {
                        try { if (pg.property(k).numKeys) stats.keyframeCount += pg.property(k).numKeys; } catch (e2) {}
                    }
                }
            }
        } catch (e3) {}
    }
    var topFx = "--", topCount = 0;
    for (var key in fxMap) { if (fxMap[key] > topCount) { topCount = fxMap[key]; topFx = key; } }
    stats.mostUsedEffect = topFx;
    return JSON.stringify(stats);
}

// ========================= LAYER CREATION =========================

function createAdjustmentLayers(name, count, selectCreated, jsonRanges, applyColours) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    count = Math.max(1, Math.min(20, parseInt(count, 10) || 1));
    app.beginUndoGroup("Create Adjustment Layers");
    try {
        var created = [];
        for (var i = 0; i < count; i++) {
            var adj = comp.layers.addSolid([1, 1, 1], name || "Adjustment Layer", comp.width, comp.height, comp.pixelAspect);
            adj.adjustmentLayer = true;
            try { adj.moveToBeginning(); } catch (eM) {}
            created.push(adj.index);
        }
        if (selectCreated !== false) {
            try {
                for (var l = 1; l <= comp.numLayers; l++) { comp.layer(l).selected = false; }
                for (var c = 0; c < created.length; c++) { comp.layer(created[c]).selected = true; }
            } catch (eS) {}
        }
        return "Created " + count + " adjustment layer" + (count === 1 ? "" : "s") + ".";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

function createNullObjects(name, count) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    count = Math.max(1, Math.min(20, parseInt(count, 10) || 1));
    app.beginUndoGroup("Create Null Objects");
    try {
        for (var i = 0; i < count; i++) {
            var nul = comp.layers.addNull();
            if (name) nul.name = name;
            try { nul.moveToBeginning(); } catch (eM) {}
        }
        return "Created " + count + " null object" + (count === 1 ? "" : "s") + ".";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// ========================= KF ASSISTANT =========================

// ---- KF Assistant helpers ----

// Collect every keyed property under a layer or property group, including
// nested groups such as effects, masks and shape contents. Time Remapping is
// skipped: its keys describe source time, not animation timing.
function collectKeyedProperties(group, out) {
    if (!group) return out;
    for (var i = 1; i <= group.numProperties; i++) {
        var p = null;
        try { p = group.property(i); } catch (eP) { continue; }
        if (!p) continue;
        try {
            if (p.propertyType === PropertyType.PROPERTY) {
                if (p.numKeys > 0 && p.matchName !== "ADBE Time Remapping") out.push(p);
            } else if (p.numProperties > 0) {
                collectKeyedProperties(p, out);
            }
        } catch (eC) {}
    }
    return out;
}

// Move one property's keys to targetT + (t - originT) * factor, carrying over
// values, interpolation and temporal ease. New keys are written before the old
// ones are removed, so a failed write can never leave the property empty.
function retimePropertyKeys(prop, originT, targetT, factor) {
    var n = prop.numKeys;
    if (!n) return false;
    var keys = [];
    for (var i = 1; i <= n; i++) {
        var k = { t: prop.keyTime(i), v: prop.keyValue(i), nv: 0, idx: 0 };
        try { k.inType = prop.keyInInterpolationType(i); } catch (e1) { k.inType = null; }
        try { k.outType = prop.keyOutInterpolationType(i); } catch (e2) { k.outType = null; }
        try { k.inEase = prop.keyInTemporalEase(i); } catch (e3) { k.inEase = null; }
        try { k.outEase = prop.keyOutTemporalEase(i); } catch (e4) { k.outEase = null; }
        try { k.cont = prop.keyTemporalContinuous(i); } catch (e5) { k.cont = null; }
        try { k.auto = prop.keyTemporalAutoBezier(i); } catch (e6) { k.auto = null; }
        k.nv = targetT + (k.t - originT) * factor;
        keys.push(k);
    }
    var added = 0;
    for (var a = 0; a < keys.length; a++) {
        try {
            var idx = prop.setValueAtTime(keys[a].nv, keys[a].v);
            if (idx !== null && idx !== undefined) { keys[a].idx = idx; added++; }
        } catch (eAdd) {}
    }
    if (added === 0) return false;
    for (var b = 0; b < keys.length; b++) {
        if (!keys[b].idx) continue;
        var ki = keys[b].idx;
        try {
            if (keys[b].inType !== null && keys[b].outType !== null) {
                prop.setInterpolationTypeAtKey(ki, keys[b].inType, keys[b].outType);
            }
        } catch (eI) {}
        try {
            if (keys[b].inEase && keys[b].outEase && keys[b].inEase.length === keys[b].outEase.length) {
                prop.setTemporalEaseAtKey(ki, keys[b].inEase, keys[b].outEase);
            }
        } catch (eE) {}
        try { if (keys[b].cont !== null) prop.setTemporalContinuousAtKey(ki, keys[b].cont); } catch (eCont) {}
        try { if (keys[b].auto !== null) prop.setTemporalAutoBezierAtKey(ki, keys[b].auto); } catch (eAuto) {}
    }
    for (var c = 0; c < keys.length; c++) {
        if (!keys[c].idx) continue;
        var oldT = keys[c].t;
        var moved = false;
        for (var d = 0; d < keys.length; d++) {
            if (keys[d].idx && Math.abs(keys[d].nv - oldT) < 0.0001) { moved = true; break; }
        }
        if (moved) continue;
        var live = -1;
        for (var e = 1; e <= prop.numKeys; e++) {
            if (Math.abs(prop.keyTime(e) - oldT) < 0.0001) { live = e; break; }
        }
        if (live > 0) { try { prop.removeKey(live); } catch (eRm) {} }
    }
    return true;
}

// Stretch KF -> Layer: re-time every keyframe of the selected layers so the
// first key lands on each layer's in point and the last on its out point. The
// layer duration, in/out points and stretch are left untouched.
function stretchSelectedLayersKeyframesToLayer() {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) return "Error: Select layer(s) with keyframes first.";
    app.beginUndoGroup("Stretch KF To Layer");
    try {
        var stretched = 0, skipped = 0;
        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            var wasLocked = false;
            try { wasLocked = !!layer.locked; } catch (eLk) {}
            if (wasLocked) { try { layer.locked = false; } catch (eUl) { skipped++; continue; } }

            var props = [];
            try { collectKeyedProperties(layer, props); } catch (eCol) {}
            if (props.length === 0) {
                if (wasLocked) { try { layer.locked = true; } catch (eRl) {} }
                skipped++;
                continue;
            }

            var firstT = null, lastT = null;
            for (var p = 0; p < props.length; p++) {
                try {
                    var t0 = props[p].keyTime(1);
                    var tn = props[p].keyTime(props[p].numKeys);
                    if (firstT === null || t0 < firstT) firstT = t0;
                    if (lastT === null || tn > lastT) lastT = tn;
                } catch (eT) {}
            }
            var span = (firstT === null) ? 0 : lastT - firstT;
            var layerDur = 0;
            try { layerDur = layer.outPoint - layer.inPoint; } catch (eD) {}
            if (firstT === null || span <= 0 || layerDur <= 0) {
                if (wasLocked) { try { layer.locked = true; } catch (eRl2) {} }
                skipped++;
                continue;
            }

            var factor = layerDur / span;
            var changed = 0;
            for (var p2 = 0; p2 < props.length; p2++) {
                try { if (retimePropertyKeys(props[p2], firstT, layer.inPoint, factor)) changed++; } catch (eR) {}
            }
            if (wasLocked) { try { layer.locked = true; } catch (eRl3) {} }
            if (changed > 0) stretched++; else skipped++;
        }
        if (stretched < 1) return "Error: No keyframes could be stretched." + (skipped > 0 ? " Skipped " + skipped + " layer(s)." : "");
        return "Stretched keyframes to the layer duration on " + stretched + " layer(s)." + (skipped > 0 ? " Skipped " + skipped + "." : "");
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// Trim the selected layer(s) to the span of their keyframes (in point at first key, out at last key).
function trimSelectedLayersToKeyframes() {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) return "Error: Select layer(s) with keyframes first.";
    app.beginUndoGroup("Trim Layer To KF");
    try {
        var trimmed = 0;
        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            if (layer.locked) { try { layer.locked = false; } catch (eL) { continue; } }
            var firstT = null, lastT = null;
            for (var p = 1; p <= layer.numProperties; p++) {
                var pg = layer.property(p);
                if (pg && pg.numProperties) {
                    for (var q = 1; q <= pg.numProperties; q++) {
                        var pr = pg.property(q);
                        if (pr && pr.numKeys >= 2) {
                            var t0 = pr.keyTime(1), t1 = pr.keyTime(pr.numKeys);
                            if (firstT === null || t0 < firstT) firstT = t0;
                            if (lastT === null || t1 > lastT) lastT = t1;
                        }
                    }
                } else if (pg && pg.propertyType === PropertyType.PROPERTY && pg.numKeys >= 2) {
                    var a0 = pg.keyTime(1), a1 = pg.keyTime(pg.numKeys);
                    if (firstT === null || a0 < firstT) firstT = a0;
                    if (lastT === null || a1 > lastT) lastT = a1;
                }
            }
            if (firstT === null || lastT === null) continue;
            try {
                layer.inPoint = Math.max(layer.startTime, firstT);
                layer.outPoint = Math.min(layer.outPoint, lastT + comp.frameDuration);
                trimmed++;
            } catch (eT) {}
        }
        if (trimmed < 1) return "Error: No layers with 2+ keyframes found.";
        return "Layer trimmed to keyframes on " + trimmed + " layer(s).";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// ========================= PRE-COMPOSE =========================

function autoPreCompose(mode) {
    var comp = getActiveComp();
    if (!comp) return "Error: Select a composition first.";
    var selected = comp.selectedLayers;
    if (!selected || selected.length === 0) return "Error: Select layer(s) to pre-compose.";
    app.beginUndoGroup("Auto Pre-Compose");
    try {
        var layerIndices = [];
        var minIn = selected[0].inPoint;
        var maxOut = selected[0].outPoint;
        for (var i = 0; i < selected.length; i++) {
            var l = selected[i];
            layerIndices.push(l.index);
            if (l.inPoint < minIn) minIn = l.inPoint;
            if (l.outPoint > maxOut) maxOut = l.outPoint;
        }
        layerIndices.sort(function (a, b) { return a - b; });
        var baseName = selected.length === 1 ? selected[0].name : "Precomp";
        var compName = baseName + " [Pre-Comp]";
        var newLayerIndex = layerIndices[0];
        var moveAttrs = (mode === "move" || mode === "adjust");
        var preComp = comp.layers.precompose(layerIndices, compName, moveAttrs);
        if (mode === "adjust" && preComp && preComp instanceof CompItem) {
            var newDuration = Math.max(1 / comp.frameRate, maxOut - minIn);
            for (var j = 1; j <= preComp.numLayers; j++) {
                try { preComp.layer(j).startTime -= minIn; } catch (eS) {}
            }
            preComp.displayStartTime = 0;
            preComp.workAreaStart = 0;
            preComp.workAreaDuration = newDuration;
            preComp.duration = newDuration;
            try {
                var outer = comp.layer(newLayerIndex);
                if (outer) {
                    outer.startTime = minIn;
                    outer.outPoint = Math.max(outer.inPoint + 1 / comp.frameRate, maxOut);
                }
            } catch (eO) {}
        }
        return "Pre-composed " + selected.length + " layer(s).";
    } catch (err) {
        return "Error: Pre-compose failed: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// ========================= USER PRESETS (.ffx) =========================

function applyPresetPathToSelectedLayers(presetPath) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) return "Error: Select layer(s) to apply the preset to.";
    var f = new File(presetPath);
    if (!f.exists) return "Error: Preset file not found: " + presetPath;
    app.beginUndoGroup("Apply Preset");
    try {
        var applied = 0;
        for (var i = 0; i < sel.length; i++) {
            try {
                sel[i].applyPreset(f);
                applied++;
            } catch (eAp) {}
        }
        if (applied < 1) return "Error: Could not apply preset to any selected layer.";
        return "Applied preset to " + applied + " layer(s).";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// ========================= TWIXTOR / FLOWFRAME =========================

function isGeneratedFlowframeName(name) { return /\[flowframe\]/i.test(name || ""); }

function isValidFlowframeLayer(l) {
    if (!l) return false;
    try {
        if (!(l instanceof AVLayer)) return false;
        if (l.nullLayer || l.adjustmentLayer) return false;
        if (l.hasVideo === false) return false;
        if (isGeneratedFlowframeName(l.name)) return false;
        try {
            var src = l.source;
            if (src && src instanceof CompItem && isGeneratedFlowframeName(src.name)) return false;
        } catch (eSrc) {}
        return true;
    } catch (e1) { return false; }
}

// anime mode: frame blend + pixel motion + precomp + time remap speed
function applyTwixtorClips(mode, speedPercent, useSourceResolution) {
    var comp = getActiveComp();
    if (!comp) return "Error: Select a composition first.";
    if (isGeneratedFlowframeName(comp.name)) {
        return "Error: Open the main comp before running Twixtor Clips. This is already a generated Twixtor clip comp.";
    }
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) return "Error: Select your flowframe clip(s) first.";
    var speed = Math.max(1, Math.min(400, parseFloat(speedPercent) || 100)) / 100;
    app.beginUndoGroup("Auto Flowframe");
    try {
        var applied = 0, skipped = 0;
        var shots = [];
        for (var i = 0; i < sel.length; i++) {
            var sl = sel[i];
            if (!isValidFlowframeLayer(sl)) continue;
            shots.push({ index: sl.index, name: sl.name, inPt: sl.inPoint, outPt: sl.outPoint,
                sourceWidth: (sl.source && sl.source.width) ? sl.source.width : comp.width,
                sourceHeight: (sl.source && sl.source.height) ? sl.source.height : comp.height,
                sourcePixelAspect: (sl.source && sl.source.pixelAspect) ? sl.source.pixelAspect : comp.pixelAspect });
        }
        if (shots.length < 1) return "Error: No layers were processed. Select normal source clips in the main comp, not already-generated Twixtor clips.";
        shots.sort(function (a, b) { return b.index - a.index; });

        for (var s = 0; s < shots.length; s++) {
            var shot = shots[s];
            try {
                var layer = comp.layer(shot.index);
                if (!isValidFlowframeLayer(layer)) { skipped++; continue; }
                var wasLocked = false;
                try { wasLocked = !!layer.locked; } catch (eLR) {}
                if (wasLocked) { try { layer.locked = false; } catch (eLU) {} }

                try { layer.motionBlur = true; } catch (eMb) {}
                try { layer.frameBlending = true; } catch (eFb) {}
                if (mode === "anime") {
                    try { layer.frameBlendingType = FrameBlendingType.PIXEL_MOTION; } catch (eFbt) {}
                }
                comp.frameBlending = true;
                comp.motionBlur = true;

                var preName = shot.name + " [Flowframe]";
                try { comp.layers.precompose([shot.index], preName, true); } catch (ePre) {
                    if (wasLocked) { try { layer.locked = true; } catch (eRl) {} }
                    skipped++;
                    continue;
                }
                var newLayer = comp.layer(shot.index);
                if (!newLayer) { skipped++; continue; }
                if (wasLocked) { try { newLayer.locked = false; } catch (eUn) {} }

                var srcComp = null;
                try { srcComp = newLayer.source; } catch (eSrc2) {}
                if (srcComp && srcComp instanceof CompItem) {
                    if (useSourceResolution) {
                        try { if (shot.sourceWidth > 0) srcComp.width = Math.round(shot.sourceWidth); } catch (eW) {}
                        try { if (shot.sourceHeight > 0) srcComp.height = Math.round(shot.sourceHeight); } catch (eH) {}
                        try { if (shot.sourcePixelAspect > 0) srcComp.pixelAspect = shot.sourcePixelAspect; } catch (ePA) {}
                    }
                    try { srcComp.displayStartTime = shot.inPt; } catch (eSD) {}

                    // time remap: enable, set speed for whole clip
                    var tr = null;
                    try { tr = newLayer.property("ADBE Time Remapping"); } catch (eTr) {}
                    if (!tr) {
                        try { newLayer.timeRemapEnabled = true; tr = newLayer.property("ADBE Time Remapping"); } catch (eTr2) {}
                    }
                    if (tr) {
                        try {
                            if (tr.numKeys < 2) {
                                tr.setValueAtTime(newLayer.inPoint, tr.valueAtTime(newLayer.inPoint, false));
                                tr.setValueAtTime(newLayer.outPoint, tr.valueAtTime(newLayer.outPoint, false));
                            }
                            var remapSpan = tr.keyTime(tr.numKeys) - tr.keyTime(1);
                            if (remapSpan > 0) {
                                // speed factor: source plays at `speed` rate => remap advances slower when speed < 1
                                var factor = 1 / speed;
                                var mid = tr.keyTime(1) + remapSpan / 2;
                                var v1 = tr.keyValue(1);
                                tr.setValueAtTime(mid, v1 + (remapSpan * factor) / 2);
                                // ease both keyframe edges
                                for (var k = 1; k <= tr.numKeys; k++) {
                                    try {
                                        tr.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                                        var easeIn = new KeyframeEase(0, 33.33);
                                        var easeOut = new KeyframeEase(0, 33.33);
                                        var easeArr = [easeIn];
                                        tr.setTemporalEaseAtKey(k, easeArr, easeArr);
                                    } catch (eEz) {}
                                }
                            }
                        } catch (eRemap) {}
                    }
                }
                try { newLayer.name = shot.name + " [Flowframe]"; } catch (eNm) {}
                applied++;
            } catch (eShot) {
                skipped++;
            }
        }
        if (applied < 1) return "Error: No layers were processed." + (skipped > 0 ? " Skipped: " + skipped + "." : "");
        return "Auto Flowframe applied to " + applied + " layer(s). [Engine v1]" + (skipped > 0 ? " Skipped: " + skipped + "." : "");
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// ========================= AUDIO AMPLITUDE / BEAT MARKERS =========================

// Robustly find the Audio Amplitude layer + Both Channels slider.
// AE 2024 Convert Audio to Keyframes creates:
//   layer "Audio Amplitude" -> effect "Both Channels" (matchName ADBE Audio Amp Slider)
//   -> slider property (matchName ADBE Slider Control-0001, displayed as "Slider")
// Fallbacks handle renamed/localized effects by scanning the effect parade for
// any slider-control effect whose slider has keyframes.
// Returns { ok, stage, layer, effects, slider, candidates, numKeys, detail }
function findAmplitudeSlider(comp) {
    var result = { ok: false, stage: "none", layer: "", effects: 0, effectNames: [], candidates: 0, sliderFound: false, numKeys: 0, detail: "" };

    var ampLayer = null;
    var candidates = [];
    // 1) exact/regex name match on layer name
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        if (/audio amplitude/i.test(l.name)) { ampLayer = l; break; }
    }
    // 2) fallback: any layer with an effect whose matchName is the audio amp slider
    if (!ampLayer) {
        for (var j = 1; j <= comp.numLayers; j++) {
            var l2 = comp.layer(j);
            try {
                var fx = l2.property("ADBE Effect Parade");
                if (!fx) continue;
                for (var f = 1; f <= fx.numProperties; f++) {
                    var eff = fx.property(f);
                    if (eff && eff.matchName === "ADBE Audio Amp Slider") { ampLayer = l2; break; }
                }
            } catch (eFx) {}
            if (ampLayer) break;
        }
    }
    if (!ampLayer) {
        result.stage = "layer";
        result.detail = "No Audio Amplitude layer found in comp.";
        return result;
    }
    result.layer = ampLayer.name;

    var effects = null;
    try { effects = ampLayer.property("ADBE Effect Parade"); } catch (ePar) {}
    if (!effects) {
        result.stage = "effect-parade";
        result.detail = "Layer has no effect parade.";
        return result;
    }
    result.effects = effects.numProperties;
    for (var f2 = 1; f2 <= effects.numProperties; f2++) {
        try { result.effectNames.push(effects.property(f2).name); } catch (eNm) {}
    }

    // 3) find the slider: prefer "Both Channels" / ADBE Audio Amp Slider, then any
    //    slider-control effect with keyframes, collecting candidates for diagnostics
    var slider = null;
    var primary = null;
    try { primary = effects.property("Both Channels"); } catch (eBC) {}
    if (!primary) { try { primary = effects.property("ADBE Audio Amp Slider"); } catch (eBC2) {} }

    if (primary) {
        var sl = null;
        try { sl = primary.property("ADBE Slider Control-0001"); } catch (eSl) {}
        if (!sl) { try { sl = primary.property(1); } catch (eSl2) {} }
        if (sl && sl.numKeys > 0) {
            slider = sl;
            result.candidates++;
        } else {
            result.stage = "zero-keys";
            result.numKeys = sl ? sl.numKeys : -1;
            result.sliderFound = !!sl;
            result.detail = "Both Channels found but slider has " + (sl ? sl.numKeys : "no") + " keyframes.";
        }
    }

    // fallback: scan every effect for a slider property with keyframes
    if (!slider) {
        for (var f3 = 1; f3 <= effects.numProperties; f3++) {
            var eff3 = effects.property(f3);
            if (!eff3) continue;
            for (var sp = 1; sp <= eff3.numProperties; sp++) {
                var sub = eff3.property(sp);
                try {
                    if (sub && sub.matchName === "ADBE Slider Control-0001" && sub.numKeys > 0) {
                        result.candidates++;
                        if (!slider) slider = sub;
                    }
                } catch (eSub) {}
            }
        }
        if (!slider && result.stage !== "zero-keys") {
            result.stage = "slider";
            result.detail = "No slider property with keyframes found in any effect.";
        }
    }

    if (!slider) return result;

    result.ok = true;
    result.sliderFound = true;
    result.numKeys = slider.numKeys;
    result.stage = "ok";
    result.slider = slider;
    return result;
}

// Diagnostic: report every lookup stage for the current comp. Shown in the
// panel when the property still cannot be found.
function diagnoseAudioAmplitude() {
    var comp = getActiveComp();
    if (!comp) return JSON.stringify({ ok: false, compName: null, error: "No active composition." });
    var d = findAmplitudeSlider(comp);
    return JSON.stringify({
        ok: d.ok,
        compName: comp.name,
        stage: d.stage,
        layerFound: !!d.layer,
        layerName: d.layer,
        effectCount: d.effects,
        effectNames: d.effectNames,
        candidates: d.candidates,
        sliderFound: d.sliderFound,
        numKeys: d.numKeys,
        detail: d.detail
    });
}

// Find an existing "Audio Amplitude" layer in the active comp and check its
// Both Channels Slider keyframes. Returns JSON status for the panel.
function checkAudioAmplitude() {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var d = findAmplitudeSlider(comp);
    if (!d.ok) {
        if (d.stage === "layer") {
            return JSON.stringify({ found: false, ready: false, status: "Audio Amplitude layer not found", detail: d.detail });
        }
        if (d.stage === "zero-keys") {
            return JSON.stringify({ found: true, ready: false, status: "No usable amplitude keyframes found", layerName: d.layer, keyCount: Math.max(0, d.numKeys), detail: d.detail });
        }
        return JSON.stringify({ found: true, ready: false, status: "No usable amplitude keyframes found", layerName: d.layer, keyCount: 0, detail: d.detail });
    }
    return JSON.stringify({ found: true, ready: true, status: "Audio Amplitude detected — ready to analyze", layerName: d.layer, keyCount: d.numKeys });
}

// Analyze Both Channels Slider keyframes for peaks and place comp markers at
// detected beat times. Preserves existing markers, skips duplicates.
function autoBeatMarkFromAmplitude(sensitivity) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var d = findAmplitudeSlider(comp);
    if (!d.ok) {
        if (d.stage === "layer") return "Error: Audio Amplitude layer not found. Select your audio layer and run Animation > Keyframe Assistant > Convert Audio to Keyframes first.";
        if (d.stage === "zero-keys") return "Error: No usable amplitude keyframes found on " + d.layer + ". " + d.detail;
        return "Error: No usable amplitude keyframes found on " + (d.layer || "the Audio Amplitude layer") + ". " + (d.detail || "Run diagnoseAudioAmplitude() for details.");
    }
    var slider = d.slider;

    var sens = Math.max(1, Math.min(10, parseFloat(sensitivity) || 5));

    app.beginUndoGroup("Auto Beat Mark");
    try {
        // collect amplitude samples
        var samples = [];
        var avg = 0;
        for (var k = 1; k <= slider.numKeys; k++) {
            var t = slider.keyTime(k);
            var v = slider.keyValue(k);
            samples.push({ t: t, v: v });
            avg += v;
        }
        avg /= slider.numKeys;

        // peak threshold: average + proportional boost scaled by sensitivity
        var range = 0;
        for (var s = 0; s < samples.length; s++) range += Math.abs(samples[s].v - avg);
        range /= samples.length;
        var threshold = avg + range * (0.6 / sens) + 0.5;
        // always require a minimum absolute level (dB)
        var minLevel = 24 - sens * 2; // e.g. sens 5 -> 14 dB
        if (threshold < minLevel) threshold = minLevel;

        // detect local peaks above threshold
        var beatTimes = [];
        var lastBeat = -99;
        var minGap = 60 / 240; // max 240 bpm
        for (var p = 1; p < samples.length - 1; p++) {
            var cur = samples[p];
            var prev = samples[p - 1], next = samples[p + 1];
            if (cur.v >= threshold && cur.v >= prev.v && cur.v >= next.v) {
                var tFrame = Math.round(cur.t / comp.frameDuration) * comp.frameDuration;
                if (tFrame - lastBeat >= minGap) {
                    beatTimes.push(tFrame);
                    lastBeat = tFrame;
                }
            }
        }
        if (beatTimes.length < 1) return "Error: No clear amplitude peaks found. Try a higher sensitivity.";

        // existing comp marker times (avoid duplicates)
        var existing = {};
        var mk = comp.markerProperty;
        for (var k2 = 1; k2 <= mk.numKeys; k2++) {
            var kt = mk.keyTime(k2);
            existing[Math.round(kt / comp.frameDuration)] = true;
        }

        var placed = 0, skipped = 0;
        for (var b = 0; b < beatTimes.length; b++) {
            var frameIdx = Math.round(beatTimes[b] / comp.frameDuration);
            if (existing[frameIdx]) { skipped++; continue; }
            try {
                var mv = new MarkerValue("Beat " + (placed + 1));
                mv.comment = "Beat";
                comp.markerProperty.setValueAtTime(beatTimes[b], mv);
                existing[frameIdx] = true;
                placed++;
            } catch (eM) {}
        }
        if (placed < 1 && skipped > 0) return "No new markers placed — " + skipped + " beat time(s) already have markers.";
        return "Placed " + placed + " beat marker(s) at comp level." + (skipped > 0 ? " Skipped " + skipped + " duplicate(s)." : "");
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// ========================= BEATMARK PRO =========================

// List audio layers in the active comp + amplitude availability for the panel dropdown.
function listAudioLayers() {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var d = findAmplitudeSlider(comp);
    var items = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        try {
            if (l instanceof AVLayer && l.hasAudio && !(l.nullLayer)) {
                items.push({ index: l.index, name: l.name, hasAmp: false });
            }
        } catch (eL) {}
    }
    return JSON.stringify({
        layers: items,
        amp: { ok: d.ok, layerName: d.layer, numKeys: d.numKeys, stage: d.stage, detail: d.detail }
    });
}

// Generate beat markers from real amplitude keyframes.
// opts: { audioIndex, mode ("strongest"|"all"), naming ("default"|"custom"|"sequential"),
//         nameValue, coloring ("random"|"single"|"strength"), colorValue }
function generateBeatMarkers(optsJson) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var opts;
    try { opts = JSON.parse(optsJson); } catch (eO) { return "Error: Invalid options."; }

    // validate selected audio layer
    var audioLayer = null;
    var ai = parseInt(opts.audioIndex, 10);
    if (ai >= 1) {
        try { audioLayer = comp.layer(ai); } catch (eA) { audioLayer = null; }
        if (audioLayer && !((audioLayer instanceof AVLayer) && audioLayer.hasAudio)) {
            return "Error: Selected layer \"" + audioLayer.name + "\" is not an audio layer. Pick an audio layer from the dropdown.";
        }
    }
    if (!audioLayer) return "Error: Select an audio layer first.";

    // locate amplitude slider (real keyframes, not simulated)
    var d = findAmplitudeSlider(comp);
    if (!d.ok) {
        if (d.stage === "layer") return "Error: No amplitude layer. Create it manually first. (Animation > Keyframe Assistant > Convert Audio to Keyframes)";
        return "Error: No usable amplitude keyframes found on " + (d.layer || "the Audio Amplitude layer") + ". " + (d.detail || "");
    }
    var slider = d.slider;

    // NOTE on association: AE does not expose a reliable link between an Audio
    // Amplitude layer and its source audio layer. We validate the selected audio
    // layer exists and is audio, and that a valid amplitude source exists in the
    // comp; the user must confirm they are a pair (the panel explains this).
    var sens = opts.mode === "strongest" ? 3 : 8;

    app.beginUndoGroup("Generate Beat Markers");
    try {
        // read real keyframes
        var samples = [];
        var maxV = -9999, minV = 9999, sumV = 0;
        for (var k = 1; k <= slider.numKeys; k++) {
            var t = slider.keyTime(k);
            var v = slider.keyValue(k);
            samples.push({ t: t, v: v });
            sumV += v;
            if (v > maxV) maxV = v;
            if (v < minV) minV = v;
        }
        if (samples.length < 4) return "Error: Not enough amplitude keyframes to analyze.";
        var avgV = sumV / samples.length;
        var range = maxV - minV;
        if (range <= 0) return "Error: Amplitude data has no variation (all values equal).";

        // peak detection thresholds per mode
        // strongest: high threshold relative to peak; all: lower threshold above average
        var strongThreshold = minV + range * (opts.mode === "strongest" ? 0.75 : 0.45);
        var minGap = opts.mode === "strongest" ? 0.35 : 0.18; // seconds between beats

        var beatTimes = [];
        var lastBeat = -99;
        for (var p = 1; p < samples.length - 1; p++) {
            var cur = samples[p];
            var prev = samples[p - 1], next = samples[p + 1];
            if (cur.v >= strongThreshold && cur.v >= prev.v && cur.v >= next.v) {
                var tFrame = Math.round(cur.t / comp.frameDuration) * comp.frameDuration;
                if (tFrame - lastBeat >= minGap) {
                    beatTimes.push({ t: tFrame, strength: (cur.v - minV) / range });
                    lastBeat = tFrame;
                }
            }
        }
        if (beatTimes.length < 1) return "Error: No qualifying amplitude peaks found. Try the All Beats mode.";

        // existing comp markers (avoid duplicates, preserve unrelated markers)
        var existing = {};
        var mk = comp.markerProperty;
        for (var k2 = 1; k2 <= mk.numKeys; k2++) {
            existing[Math.round(mk.keyTime(k2) / comp.frameDuration)] = true;
        }

        // marker colors: AE comp/layer MarkerValue supports LabelColors 0-16.
        var COLORS = {
            red: 1, yellow: 2, aqua: 3, pink: 4, lavender: 5,
            peach: 6, seafoam: 7, blue: 8, green: 9, purple: 10,
            orange: 11, brown: 12, fuchsia: 13, cyan: 14,
            sandstone: 15, darkgreen: 16
        };
        var STRENGTH_LADDER = [COLORS.red, COLORS.orange, COLORS.yellow, COLORS.aqua, COLORS.blue]; // strong -> weak

        var naming = opts.naming || "default";
        var baseName = naming === "custom" ? String(opts.nameValue || "Beat") : "Beat";
        var prefix = naming === "sequential" ? String(opts.nameValue || "Scene") : "";
        var coloring = opts.coloring || "single";
        var singleColor = COLORS[(opts.colorValue || "aqua").toLowerCase()];
        if (singleColor === undefined) singleColor = COLORS.aqua;

        var placed = 0, skipped = 0;
        for (var b = 0; b < beatTimes.length; b++) {
            var bt = beatTimes[b];
            var frameIdx = Math.round(bt.t / comp.frameDuration);
            if (existing[frameIdx]) { skipped++; continue; }
            try {
                var label = "Beat";
                if (naming === "custom") label = baseName;
                else if (naming === "sequential") label = prefix + " " + (placed + 1);
                var mv = new MarkerValue(label);
                mv.comment = label; // AE displays the comment — keep it clean ("Beat", custom name, or "Scene N")
                if (coloring === "single") {
                    mv.labelColor = singleColor;
                } else if (coloring === "strength") {
                    // Red = strong, progressively weaker beats get cooler colors
                    var ladderIdx = Math.min(STRENGTH_LADDER.length - 1, Math.floor((1 - bt.strength) * STRENGTH_LADDER.length));
                    mv.labelColor = STRENGTH_LADDER[ladderIdx];
                } else if (coloring === "random") {
                    mv.labelColor = 1 + Math.floor(Math.random() * 16);
                }
                comp.markerProperty.setValueAtTime(bt.t, mv);
                existing[frameIdx] = true;
                placed++;
            } catch (eM) {}
        }
        if (placed < 1 && skipped > 0) return "No new markers placed — all detected beat times already have markers.";
        return "Created " + placed + " marker(s) at detected beat times." + (skipped > 0 ? " Skipped " + skipped + " duplicate(s)." : "");
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// Generate the Audio Amplitude layer for the selected audio layer using AE's
// real Convert Audio to Keyframes menu command. Two-phase: if a usable amplitude
// layer already exists, returns a reuse/regenerate prompt instead of duplicating.
function generateAudioAmplitudeLayer(regenerate) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";

    // existing usable amplitude layer?
    var existing = findAmplitudeSlider(comp);
    if (existing.ok && regenerate !== true && regenerate !== "true") {
        return JSON.stringify({ confirm: true, reuse: true, layerName: existing.layer, numKeys: existing.numKeys,
            message: "A usable Audio Amplitude layer already exists (" + existing.layer + ", " + existing.numKeys + " keys)." });
    }

    // validate selected audio layer (must be selected in the comp — AE's command
    // operates on the selected layer)
    var sel = comp.selectedLayers;
    var audioLayer = null;
    for (var s = 0; s < sel.length; s++) {
        if (sel[s] instanceof AVLayer && sel[s].hasAudio && !sel[s].nullLayer) { audioLayer = sel[s]; break; }
    }
    if (!audioLayer) return "Error: Select an audio layer in the timeline first (dropdown selection is not enough — AE's Convert Audio to Keyframes needs the layer selected).";

    var preCount = comp.numLayers;
    var preName = audioLayer.name;

    app.beginUndoGroup("Generate Audio Amplitude Layer");
    var cmdId = -1;
    try {
        cmdId = app.findMenuCommandId("Convert Audio to Keyframes");
    } catch (eM) {}
    try {
        if (cmdId && cmdId > 0) {
            audioLayer.selected = true;
            app.executeCommand(cmdId);
        } else {
            return "Error: Could not find the Convert Audio to Keyframes menu command in this AE version.";
        }
    } catch (eCmd) {
        return "Error: Convert Audio to Keyframes failed: " + eCmd.toString();
    } finally {
        app.endUndoGroup();
    }

    // locate the resulting amplitude layer
    var d = findAmplitudeSlider(comp);
    if (!d.ok) {
        if (d.stage === "layer") return "Error: Convert Audio to Keyframes ran but no Audio Amplitude layer was created.";
        return "Error: Audio Amplitude layer created but no usable keyframes found on it. " + (d.detail || "");
    }
    return "Generated " + d.layer + " with " + d.numKeys + " amplitude keyframes from \"" + preName + "\".";
}

// Clear tool-generated beat markers from the comp marker property.
// Matches markers whose comment is exactly "Beat", "Beat <number>" (default
// naming) — unrelated markers with any other comment are preserved.
function clearToolMarkers(naming, nameValue) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    app.beginUndoGroup("Clear Beat Markers");
    try {
        var mk = comp.markerProperty;
        var removed = 0;
        // build the accepted comment patterns from the naming settings used at generation time
        var patterns = [/^Beat$/i, /^Beat \d+$/i];
        if (naming === "custom" && nameValue) {
            var esc2 = String(nameValue).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            patterns.push(new RegExp("^" + esc2 + "$", "i"));
        } else if (naming === "sequential" && nameValue) {
            var esc3 = String(nameValue).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            patterns.push(new RegExp("^" + esc3 + " \\d+$", "i"));
        }
        for (var k = mk.numKeys; k >= 1; k--) {
            try {
                var v = mk.keyValue(k);
                var c = (v && v.comment) ? String(v.comment) : "";
                var match = false;
                for (var p = 0; p < patterns.length; p++) {
                    if (patterns[p].test(c)) { match = true; break; }
                }
                if (match) { mk.deleteKeyAtTime(mk.keyTime(k)); removed++; }
            } catch (e1) {}
        }
        if (removed < 1) return "No beat markers found (unrelated markers preserved).";
        return "Removed " + removed + " beat marker(s). Unrelated markers preserved.";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// Remove Audio Amplitude layers after an explicit confirmation step (confirmed=true).
function removeAmpLayers(confirmed) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    if (confirmed !== true && confirmed !== "true") {
        // first call: report what would be affected, no deletion
        var names = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            try { if (/audio amplitude/i.test(l.name)) names.push(l.name); } catch (eL) {}
        }
        if (names.length === 0) return "No Audio Amplitude layers found.";
        return JSON.stringify({ confirm: true, layers: names });
    }
    app.beginUndoGroup("Remove Amp Layers");
    try {
        var removed = 0;
        for (var j = comp.numLayers; j >= 1; j--) {
            var l2 = comp.layer(j);
            try {
                if (/audio amplitude/i.test(l2.name)) { comp.layer(j).remove(); removed++; }
            } catch (eR) {}
        }
        if (removed < 1) return "No Audio Amplitude layers found.";
        return "Removed " + removed + " Audio Amplitude layer(s). Original audio sources untouched.";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

function clearBeatMarkers(useCompMarkers, layerInfoJson) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    app.beginUndoGroup("Clear Beat Markers");
    try {
        var removed = 0;
        if (useCompMarkers) {
            var mk = comp.markerProperty;
            for (var k = mk.numKeys; k >= 1; k--) {
                try {
                    var v = mk.keyValue(k);
                    if (/^Beat /i.test(v.comment || "")) { mk.deleteKeyAtTime(mk.keyTime(k)); removed++; }
                } catch (e1) {}
            }
            // if all are beat markers, clear everything
            if (removed === 0 && mk.numKeys > 0) {
                while (mk.numKeys > 0) { mk.deleteKey(1); removed++; }
            }
        } else {
            var sel = comp.selectedLayers;
            var targets = (sel && sel.length > 0) ? sel : comp.layers;
            var n = (sel && sel.length > 0) ? sel.length : comp.numLayers;
            for (var i = 0; i < n; i++) {
                var layer = (sel && sel.length > 0) ? sel[i] : comp.layer(i + 1);
                var lm = null;
                try { lm = layer.property("Marker"); } catch (e2) {}
                if (!lm) continue;
                for (var k2 = lm.numKeys; k2 >= 1; k2--) {
                    try {
                        var v2 = lm.keyValue(k2);
                        if (/^Beat /i.test(v2.comment || "")) { lm.deleteKeyAtTime(lm.keyTime(k2)); removed++; }
                    } catch (e3) {}
                }
            }
        }
        return "Cleared " + removed + " beat marker(s).";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// ========================= ALIGN CLIPS TO BEATS =========================

// Align selected clip layers to beat intervals defined by comp beat markers.
// fitSpan=true stretches each clip to fill the whole beat interval; false only snaps in points.
function alignClipsToBeats(fitSpan) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var mk = comp.markerProperty;
    if (!mk || mk.numKeys < 2) return "Error: Need at least 2 beat markers on the comp. Run Apply Beat Markers first.";
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) return "Error: Select your clip layer(s) first (higher layer index = lower in timeline).";
    var beats = [];
    for (var k = 1; k <= mk.numKeys; k++) beats.push(mk.keyTime(k));
    var layers = [];
    for (var i = 0; i < sel.length; i++) layers.push(sel[i]);
    layers.sort(function (a, b) { return b.index - a.index; });
    app.beginUndoGroup(fitSpan ? "Stretch To Fit Beats" : "Align Clips To Beats");
    try {
        var aligned = 0;
        var fd = comp.frameDuration;
        for (var li = 0; li < layers.length; li++) {
            var layer = layers[li];
            if (li >= beats.length - 1) break;
            var b1 = beats[li], b2 = beats[li + 1];
            if (layer.locked) { try { layer.locked = false; } catch (eL) { continue; } }
            try {
                var beatSpan = b2 - b1;
                var clipSpan = layer.outPoint - layer.inPoint;
                if (fitSpan && clipSpan > 0) {
                    // retime clip to fit beat interval
                    try { layer.timeRemapEnabled = true; } catch (eTr) {}
                    var tr = layer.property("ADBE Time Remapping");
                    if (tr) {
                        tr.setValueAtTime(b1, tr.keyValue(1));
                        tr.setValueAtTime(b2, tr.keyValue(tr.numKeys));
                    }
                }
                layer.startTime = layer.startTime + (b1 - layer.inPoint);
                layer.inPoint = b1;
                layer.outPoint = b2;
                aligned++;
            } catch (eA) {}
        }
        if (aligned < 1) return "Error: No clips aligned. Check beat markers and selection.";
        return (fitSpan ? "Stretched " : "Aligned ") + aligned + " clip(s) to beats.";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// ========================= EASING / GRAPHS =========================

function buildEaseArrayFromSpeeds(speeds, influence) {
    // AE accepts influence only in 0.1..100; clamp so unusual curves degrade
    // to the nearest legal ease instead of throwing.
    var inf = parseFloat(influence);
    if (isNaN(inf)) inf = 33.33;
    inf = Math.max(0.1, Math.min(100, inf));
    var arr = [];
    for (var d = 0; d < speeds.length; d++) {
        arr.push(new KeyframeEase(speeds[d], inf));
    }
    return arr;
}

function toValueArray(v, dim) {
    if (v instanceof Array) return v;
    var arr = [];
    for (var d = 0; d < dim; d++) arr.push(v);
    return arr;
}

function getExistingEase(prop, keyIndex, isIn, dim) {
    var arr = [];
    for (var d = 0; d < dim; d++) {
        var e = new KeyframeEase(0, 33.33);
        try {
            var ease = isIn ? prop.keyInTemporalEase(keyIndex) : prop.keyOutTemporalEase(keyIndex);
            if (ease && ease.length > d) e = ease[d];
        } catch (eE) {}
        arr.push(e);
    }
    return arr;
}

// Apply cubic-bezier easing (cp1x, cp1y, cp2x, cp2y) to selected keyframe segments.
function applyEasingToKeyframes(cp1x, cp1y, cp2x, cp2y, outInfluence, inInfluence, startSlope, endSlope) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) return "Error: Select layer(s) with keyframes. Selected keys are used when present; keys do not need to be selected.";
    app.beginUndoGroup("Apply Easing To Keyframes");
    try {
        var affectedSegments = 0;
        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            for (var p = 1; p <= layer.numProperties; p++) {
                var pg = layer.property(p);
                affectedSegments += applyEasingToProperty(pg, cp1x, cp1y, cp2x, cp2y, outInfluence, inInfluence, startSlope, endSlope, comp);
                if (pg && pg.numProperties) {
                    for (var q = 1; q <= pg.numProperties; q++) {
                        affectedSegments += applyEasingToProperty(pg.property(q), cp1x, cp1y, cp2x, cp2y, outInfluence, inInfluence, startSlope, endSlope, comp);
                    }
                }
            }
        }
        if (affectedSegments < 1) return "Error: No editable keyframe segments found.";
        return "Applied easing to " + affectedSegments + " keyframe segment(s).";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

function applyEasingToProperty(prop, cp1x, cp1y, cp2x, cp2y, outInfluence, inInfluence, startSlope, endSlope, comp) {
    if (!prop || prop.propertyType !== PropertyType.PROPERTY || prop.numKeys < 2) return 0;
    var keys = (prop.selectedKeys && prop.selectedKeys.length > 0) ? prop.selectedKeys : null;
    if (!keys) {
        keys = [];
        for (var kk = 1; kk <= prop.numKeys; kk++) keys.push(kk);
    }
    if (keys.length < 2) return 0;
    var affected = 0;
    for (var k = 0; k < keys.length - 1; k++) {
        var startKeyIndex = keys[k], endKeyIndex = keys[k + 1];
        if (endKeyIndex <= startKeyIndex) continue;
        var dim = 1, startTime = 0, endTime = 0, startValue = 0, endValue = 0;
        try {
            var startKv = prop.keyValue(startKeyIndex);
            var endKv = prop.keyValue(endKeyIndex);
            if (startKv instanceof Array) dim = startKv.length;
            startTime = prop.keyTime(startKeyIndex);
            endTime = prop.keyTime(endKeyIndex);
            startValue = startKv;
            endValue = endKv;
        } catch (eRead) { continue; }
        var segmentDuration = Math.max(endTime - startTime, comp.frameDuration);
        var startValues = toValueArray(startValue, dim);
        var endValues = toValueArray(endValue, dim);
        var outSpeeds = [], inSpeeds = [];
        for (var d = 0; d < dim; d++) {
            var baseSpeed = (endValues[d] - startValues[d]) / segmentDuration;
            outSpeeds.push(baseSpeed * startSlope);
            inSpeeds.push(baseSpeed * endSlope);
        }
        var startInEase = getExistingEase(prop, startKeyIndex, true, dim);
        var startOutEase = buildEaseArrayFromSpeeds(outSpeeds, outInfluence);
        var endInEase = buildEaseArrayFromSpeeds(inSpeeds, inInfluence);
        var endOutEase = getExistingEase(prop, endKeyIndex, false, dim);
        try {
            prop.setInterpolationTypeAtKey(startKeyIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            prop.setTemporalContinuousAtKey(startKeyIndex, false);
            prop.setTemporalAutoBezierAtKey(startKeyIndex, false);
            prop.setTemporalEaseAtKey(startKeyIndex, startInEase, startOutEase);
            prop.setInterpolationTypeAtKey(endKeyIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            prop.setTemporalContinuousAtKey(endKeyIndex, false);
            prop.setTemporalAutoBezierAtKey(endKeyIndex, false);
            prop.setTemporalEaseAtKey(endKeyIndex, endInEase, endOutEase);
            affected++;
        } catch (eSet) {}
    }
    return affected;
}

// Read the current ease curve of the first selected keyframe pair (or first two keys of first animated prop).
function readEasingFromAE() {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) return "Error: Select a layer with keyframes.";
    var layer = sel[0];
    var props = [];
    function collect(pg) {
        if (!pg) return;
        if (pg.propertyType === PropertyType.PROPERTY && pg.numKeys >= 2) { props.push(pg); return; }
        if (pg.numProperties) {
            for (var i = 1; i <= pg.numProperties; i++) collect(pg.property(i));
        }
    }
    for (var p = 1; p <= layer.numProperties; p++) collect(layer.property(p));
    if (props.length < 1) return "Error: No animated properties found on the selected layer.";
    var prop = props[0];
    var k1 = (prop.selectedKeys && prop.selectedKeys.length >= 2) ? prop.selectedKeys[0] : 1;
    var k2 = (prop.selectedKeys && prop.selectedKeys.length >= 2) ? prop.selectedKeys[1] : 2;
    var t1 = prop.keyTime(k1), t2 = prop.keyTime(k2);
    var span = Math.max(t2 - t1, comp.frameDuration);
    var v1 = prop.keyValue(k1), v2 = prop.keyValue(k2);
    var v1a = (v1 instanceof Array) ? v1 : [v1];
    var v2a = (v2 instanceof Array) ? v2 : [v2];
    var outEase, inEase;
    try { outEase = prop.keyOutTemporalEase(k1); } catch (eO) { outEase = null; }
    try { inEase = prop.keyInTemporalEase(k2); } catch (eI) { inEase = null; }
    var startSpeed = 0, endSpeed = 0, outInf = 33.33, inInf = 33.33;
    if (outEase && outEase.length > 0) { startSpeed = outEase[0].speed; outInf = outEase[0].influence; }
    if (inEase && inEase.length > 0) { endSpeed = inEase[0].speed; inInf = inEase[0].influence; }
    var baseSpeed = (v2a[0] - v1a[0]) / span;
    // convert speed+influence to approximate bezier control points
    var startSlope = baseSpeed !== 0 ? startSpeed / baseSpeed : 0;
    var endSlope = baseSpeed !== 0 ? endSpeed / baseSpeed : 0;
    var cp1y = startSlope / 3;
    var cp2y = 1 - endSlope / 3;
    var cp1x = outInf / 100;
    var cp2x = 1 - inInf / 100;
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    return JSON.stringify({
        propertyName: prop.name,
        segmentStart: t1.toFixed(2),
        segmentEnd: t2.toFixed(2),
        cp1x: clamp(Math.round(cp1x * 100) / 100, 0, 1),
        cp1y: clamp(Math.round(cp1y * 100) / 100, -0.5, 1.5),
        cp2x: clamp(Math.round(cp2x * 100) / 100, 0, 1),
        cp2y: clamp(Math.round(cp2y * 100) / 100, -0.5, 1.5)
    });
}

// ========================= CAPTIONS =========================

// captionLinesJson: [["0.0","Hello"],["2.5","World"], ...] ; each becomes a text layer.
function applyCaptions(captionLinesJson, durationSec, fontSize) {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    var lines;
    try { lines = JSON.parse(captionLinesJson); } catch (eJ) { return "Error: Invalid caption data."; }
    if (!lines || lines.length === 0) return "Error: No captions to apply.";
    var dur = Math.max(0.5, parseFloat(durationSec) || 3);
    var fs = Math.max(8, parseFloat(fontSize) || 60);
    app.beginUndoGroup("Apply Captions");
    try {
        var created = 0;
        for (var i = lines.length - 1; i >= 0; i--) {
            var line = lines[i];
            var startT = parseFloat(line[0]) || 0;
            var text = String(line[1] || "");
            if (!text) continue;
            var txtLayer = comp.layers.addText(text);
            txtLayer.name = "Caption " + (i + 1) + " - " + text.substring(0, 24);
            txtLayer.inPoint = startT;
            txtLayer.outPoint = Math.min(comp.duration, startT + dur);
            var doc = txtLayer.property("Source Text").value;
            doc.fontSize = fs;
            doc.applyFill = true;
            doc.fillColor = [1, 1, 1];
            doc.applyStroke = false;
            doc.justification = ParagraphJustification.CENTER_JUSTIFY;
            txtLayer.property("Source Text").setValue(doc);
            // position at bottom center
            try {
                txtLayer.property("Position").setValue([comp.width / 2, comp.height * 0.85]);
            } catch (eP) {}
            created++;
        }
        if (created < 1) return "Error: No valid caption lines found.";
        return "All " + created + " Captions Applied";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

function removeCaptions() {
    var comp = getActiveComp();
    if (!comp) return "Error: Open a comp first.";
    app.beginUndoGroup("Remove Captions");
    try {
        var removed = 0;
        for (var i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (l instanceof TextLayer && /^Caption \d+ /i.test(l.name)) {
                l.remove();
                removed++;
            }
        }
        if (removed < 1) return "Error: No caption layers found (layers named \"Caption N - ...\").";
        return "Removed " + removed + " caption layer(s).";
    } catch (err) {
        return "Error: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
}

// ========================= DISK CACHE (via Node) =========================
// Clearing cache is done from the panel via window.ceph Node fs (see main.js), not ExtendScript.

// ========================= MISC =========================

function ping() { return "pong"; }
