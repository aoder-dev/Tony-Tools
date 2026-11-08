/* AE Layer Tools — panel frontend (ES5-compatible for CEP).
   Communication layer: callHost(fnCall) → evalScript → host.jsx, with busy-guard
   to prevent duplicate clicks during a running host operation. */

(function () {
    "use strict";

    var cs = new CSInterface();
    var busy = false;

    // ---------------- host bridge ----------------
    function callHost(script, cb) {
        if (busy) return;
        busy = true;
        cs.evalScript(script, function (result) {
            busy = false;
            var r = (result || "").trim();
            if (r === CSInterface.EVAL_SCRIPT_ERROR) {
                toast("Script error", "error", "ExtendScript failed to run. Reload Script and check the comp.");
                return;
            }
            cb(r);
        });
    }

    function isErr(r) { return /^error[:\s]/i.test((r || "").trim()); }

    // ---------------- toasts ----------------
    function toast(title, type, description) {
        var wrap = document.getElementById("toast-wrap");
        var el = document.createElement("div");
        el.className = "toast " + (type || "info");
        el.innerHTML = "<span><b>" + escapeHtml(title) + "</b>" +
            (description ? "<br/>" + escapeHtml(description) : "") + "</span>" +
            '<span class="toast-close">✕</span>';
        el.querySelector(".toast-close").onclick = function () { wrap.removeChild(el); };
        wrap.appendChild(el);
        setTimeout(function () {
            if (el.parentNode) wrap.removeChild(el);
        }, 4500);
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function $id(id) { return document.getElementById(id); }

    function num(id, fallback) {
        var v = parseFloat($id(id).value);
        return isNaN(v) ? fallback : v;
    }

    // ---------------- tabs ----------------
    var tabs = document.querySelectorAll(".main-tab");
    for (var t = 0; t < tabs.length; t++) {
        tabs[t].addEventListener("click", function () {
            var name = this.getAttribute("data-tab");
            for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove("active");
            this.classList.add("active");
            var pages = document.querySelectorAll(".tab-page");
            for (var p = 0; p < pages.length; p++) pages[p].classList.remove("active");
            $id("page-" + name).classList.add("active");
        });
    }

    // ---------------- header ----------------
    $id("btn-reload").addEventListener("click", function () { location.reload(); });

    // settings dialog
    $id("btn-settings").addEventListener("click", function () { $id("dlg-settings").classList.remove("hidden"); });
    $id("btn-close-settings").addEventListener("click", function () { $id("dlg-settings").classList.add("hidden"); });

    // ---------------- global theme system ----------------
    // Presets coordinate accent + darkness. Custom accent/darkness override the preset.
    var THEMES = {
        charcoal:   { accent: "#C4453C", darkness: 0 },
        midnight:   { accent: "#5E8FA0", darkness: 1 },
        amber:      { accent: "#C9954B", darkness: 0 },
        violet:     { accent: "#8E6FA8", darkness: 0 },
        teal:       { accent: "#5E8FA0", darkness: 0 },
        monochrome: { accent: "#B0A090", darkness: 0 }
    };
    var DARKNESS = [
        { bg: "#000000", bg2: "#0B0C0D", panel: "#101113", input: "#08090A", border: "#2A2B2E", soft: "#1A1B1E" },
        { bg: "#000000", bg2: "#0D0F11", panel: "#131517", input: "#0A0C0D", border: "#2E3134", soft: "#1D1F22" },
        { bg: "#141618", bg2: "#1C1F21", panel: "#222527", input: "#181B1D", border: "#383C40", soft: "#2A2E32" },
        { bg: "#1E2225", bg2: "#272B2F", panel: "#2E3337", input: "#24282B", border: "#454B50", soft: "#353B40" }
    ];

    function hexToRgb(hex) {
        var h = hex.replace("#", "");
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var n = parseInt(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function applyAccent(hex) {
        var rgb = hexToRgb(hex);
        var root = document.documentElement.style;
        root.setProperty("--accent", hex);
        root.setProperty("--accent-soft", "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", 0.13)");
        root.setProperty("--accent-line", "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", 0.38)");
        // derive readable text color on accent
        var lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
        root.setProperty("--on-accent", lum > 150 ? "#16130C" : "#F2F1EE");
        // mark active swatch
        var sw = document.querySelectorAll("#accent-swatches .swatch");
        for (var i = 0; i < sw.length; i++) {
            sw[i].classList.toggle("active", sw[i].getAttribute("data-accent").toLowerCase() === hex.toLowerCase());
        }
        try { $id("accent-picker").value = hex; } catch (e) {}
    }

    function applyDarkness(idx) {
        var d = DARKNESS[Math.max(0, Math.min(3, idx))];
        var root = document.documentElement.style;
        root.setProperty("--bg", d.bg);
        root.setProperty("--bg2", d.bg2);
        root.setProperty("--panel", d.panel);
        root.setProperty("--input", d.input);
        root.setProperty("--border", d.border);
        root.setProperty("--border-soft", d.soft);
    }

    function applyTheme(name, accentOverride, darknessOverride) {
        var t = THEMES[name] || THEMES.charcoal;
        document.body.classList.remove("theme-midnight", "theme-high-contrast");
        if (name === "midnight") document.body.classList.add("theme-midnight");
        applyAccent(accentOverride || t.accent);
        applyDarkness(darknessOverride !== undefined ? darknessOverride : t.darkness);
        try { localStorage.setItem("aelt_theme2", JSON.stringify({ theme: name, accent: accentOverride || t.accent, darkness: darknessOverride !== undefined ? darknessOverride : t.darkness })); } catch (e) {}
    }

    $id("sel-theme").addEventListener("change", function () {
        applyTheme(this.value);
        this.blur();
    });
    var swatches = document.querySelectorAll("#accent-swatches .swatch");
    for (var sw = 0; sw < swatches.length; sw++) {
        swatches[sw].addEventListener("click", function () {
            // keep current preset/darkness, override accent only
            var cur = { theme: "charcoal", accent: "#C4453C", darkness: 0 };
            try { cur = JSON.parse(localStorage.getItem("aelt_theme2")) || cur; } catch (e) {}
            applyTheme(cur.theme, this.getAttribute("data-accent"), cur.darkness);
        });
    }
    $id("accent-picker").addEventListener("input", function () {
        var cur = { theme: "charcoal", accent: "#C4453C", darkness: 0 };
        try { cur = JSON.parse(localStorage.getItem("aelt_theme2")) || cur; } catch (e) {}
        applyTheme(cur.theme, this.value, cur.darkness);
    });
    $id("darkness-range").addEventListener("input", function () {
        var cur = { theme: "charcoal", accent: "#C4453C", darkness: 0 };
        try { cur = JSON.parse(localStorage.getItem("aelt_theme2")) || cur; } catch (e) {}
        applyTheme(cur.theme, cur.accent, parseInt(this.value, 10));
    });

    // restore saved appearance
    try {
        var savedTheme = JSON.parse(localStorage.getItem("aelt_theme2"));
        if (savedTheme) {
            applyTheme(savedTheme.theme, savedTheme.accent, savedTheme.darkness);
            $id("sel-theme").value = savedTheme.theme || "charcoal";
            $id("darkness-range").value = String(savedTheme.darkness !== undefined ? savedTheme.darkness : 0);
        }
    } catch (e) {}

    // cache dialog (Node fs via CEP)
    $id("btn-cache").addEventListener("click", function () { $id("dlg-cache").classList.remove("hidden"); });
    $id("btn-close-cache").addEventListener("click", function () { $id("dlg-cache").classList.add("hidden"); });
    $id("btn-do-clear-cache").addEventListener("click", function () {
        var req = window.require || (window.cep_node && window.cep_node.require);
        if (!req) { toast("Node not available", "error", "Enable Node in the CEP manifest to clear the disk cache."); return; }
        var fs = req("fs"), path = req("path"), os = req("os");
        var home = os.homedir();
        var roots = [$id("chk-cache-all").checked
            ? ["AppData/Local/Temp", "AppData/Roaming/Adobe/After Effects"]
            : ["AppData/Roaming/Adobe/After Effects"]];
        var freed = 0, items = 0;
        function scan(dir, depth) {
            if (depth > 3) return;
            var entries;
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
            for (var i = 0; i < entries.length; i++) {
                var full = path.join(dir, entries[i].name);
                if (/cache/i.test(entries[i].name) && entries[i].isFile()) {
                    try { var st = fs.statSync(full); freed += st.size; fs.unlinkSync(full); items++; } catch (e2) {}
                } else if (entries[i].isDirectory()) {
                    scan(full, depth + 1);
                }
            }
        }
        for (var r = 0; r < roots.length; r++) {
            for (var c = 0; c < roots[r].length; c++) scan(path.join(home, roots[r][c]), 0);
        }
        $id("dlg-cache").classList.add("hidden");
        if (items > 0) toast("Cache cleared", "success", "Removed " + items + " item(s), freed " + (freed / 1048576).toFixed(1) + " MB.");
        else toast("No cache found", "info", "No removable AE disk cache was found.");
    });

    // ---------------- stats ----------------
    function refreshStats() {
        callHost("getCompStats()", function (r) {
            if (isErr(r)) { toast("Stats failed", "error", r); return; }
            try {
                var s = JSON.parse(r);
                $id("st-layers").textContent = s.totalLayers;
                $id("st-adj").textContent = s.adjustmentLayers;
                $id("st-nulls").textContent = s.nullLayers;
                $id("st-precomps").textContent = s.precompLayers;
                $id("st-text").textContent = s.textLayers;
                $id("st-fx").textContent = s.effectCount;
                $id("st-kf").textContent = s.keyframeCount;
                $id("st-topfx").textContent = s.mostUsedEffect || "--";
            } catch (e) {
                toast("Stats failed", "error", String(r));
            }
        });
    }
    $id("btn-refresh-stats").addEventListener("click", refreshStats);
    refreshStats();

    // ---------------- steppers ----------------
    var steppers = document.querySelectorAll(".stepper");
    for (var st = 0; st < steppers.length; st++) {
        (function (stepper) {
            var input = stepper.querySelector(".step-input");
            var btns = stepper.querySelectorAll(".step-btn");
            for (var b = 0; b < btns.length; b++) {
                btns[b].addEventListener("click", function () {
                    var dir = parseInt(this.getAttribute("data-dir"), 10);
                    var v = Math.max(1, Math.min(20, (parseInt(input.value, 10) || 1) + dir));
                    input.value = String(v);
                });
            }
            input.addEventListener("input", function () {
                input.value = input.value.replace(/[^\d]/g, "");
                if (!input.value) input.value = "1";
                var v = parseInt(input.value, 10) || 1;
                if (v < 1) { input.value = "1"; }
                if (v > 20) { input.value = "20"; }
            });
        })(steppers[st]);
    }

    // ---------------- layers tab ----------------
    $id("btn-stretch-kf").addEventListener("click", function () {
        callHost("stretchSelectedLayersKeyframesToLayer()", function (r) {
            if (isErr(r)) toast("Stretch failed", "error", r); else toast("Stretch KF", "success", r);
            refreshStats();
        });
    });
    $id("btn-trim-kf").addEventListener("click", function () {
        callHost("trimSelectedLayersToKeyframes()", function (r) {
            if (isErr(r)) toast("Trim failed", "error", r); else toast("Trim Layer", "success", r);
            refreshStats();
        });
    });
    $id("btn-precompose").addEventListener("click", function () {
        var mode = $id("sel-precomp-mode").value;
        try { localStorage.setItem("aelt_precompose_mode", mode); } catch (e) {}
        callHost('autoPreCompose("' + mode + '")', function (r) {
            if (isErr(r)) toast("Pre-compose failed", "error", r); else toast("Pre-compose", "success", r);
            refreshStats();
        });
    });
    try {
        var savedMode = localStorage.getItem("aelt_precompose_mode");
        if (savedMode) $id("sel-precomp-mode").value = savedMode;
    } catch (e) {}

    $id("btn-create-adj").addEventListener("click", function () {
        var count = parseInt($id("adj-count").value, 10) || 1;
        callHost('createAdjustmentLayers("Adjustment Layer", ' + count + ', true, "[]", false)', function (r) {
            if (isErr(r)) toast("Could not create adjustment layers", "error", r); else toast("Adjustment Layers", "success", r);
            refreshStats();
        });
    });
    $id("btn-create-null").addEventListener("click", function () {
        var count = parseInt($id("null-count").value, 10) || 1;
        callHost('createNullObjects("Null Control", ' + count + ')', function (r) {
            if (isErr(r)) toast("Could not create nulls", "error", r); else toast("Null Objects", "success", r);
            refreshStats();
        });
    });

    // ---------------- user presets ----------------
    var presets = [];

    function renderPresets() {
        var q = $id("preset-search").value.trim().toLowerCase();
        $id("btn-clear-search").classList.toggle("hidden", !q);
        var list = $id("preset-list");
        var filtered = q ? presets.filter(function (p) {
            return p.name.toLowerCase().indexOf(q) >= 0 || (p.category || "").toLowerCase().indexOf(q) >= 0;
        }) : presets;
        if (presets.length === 0) {
            list.innerHTML = '<div class="empty-note">No presets</div>';
            return;
        }
        if (filtered.length === 0) {
            list.innerHTML = '<div class="empty-note">No presets match search</div>';
            return;
        }
        var html = "";
        for (var i = 0; i < filtered.length; i++) {
            var p = filtered[i];
            html += '<div class="preset-item" data-path="' + escapeHtml(p.fullPath) + '">' +
                '<span class="truncate">' + escapeHtml(p.name) + "</span>" +
                '<span class="preset-cat">' + escapeHtml(p.category || "") + "</span></div>";
        }
        list.innerHTML = html;
        var items = list.querySelectorAll(".preset-item");
        for (var j = 0; j < items.length; j++) {
            items[j].addEventListener("click", function () {
                var p = String(this.getAttribute("data-path")).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
                callHost('applyPresetPathToSelectedLayers("' + p + '")', function (r) {
                    if (isErr(r)) toast("Could not apply preset", "error", r); else toast("Preset applied", "success", r);
                });
            });
        }
    }

    function loadPresets(folderOverride) {
        var req = window.require || (window.cep_node && window.cep_node.require);
        if (!req) {
            $id("preset-list").innerHTML = '<div class="empty-note">Node not available — set folder path in host</div>';
            return;
        }
        var fs = req("fs"), path = req("path"), os = req("os");
        var folder = (folderOverride || "").trim() || "";
        if (!folder) {
            var base = path.join(os.homedir(), "Documents", "Adobe");
            var candidates = [
                path.join(base, "After Effects 2026", "User Presets"),
                path.join(base, "After Effects 2025", "User Presets"),
                path.join(base, "After Effects 2024", "User Presets"),
                path.join(base, "After Effects 2023", "User Presets")
            ];
            for (var i = 0; i < candidates.length; i++) {
                if (fs.existsSync(candidates[i])) { folder = candidates[i]; break; }
            }
        }
        if (!folder || !fs.existsSync(folder)) {
            presets = [];
            renderPresets();
            toast("No preset folder found", "info", "Click the gear icon and set your User Presets folder.");
            return;
        }
        try { localStorage.setItem("aelt_preset_folder", folder); } catch (e) {}
        var found = [];
        function walk(dir, cat) {
            var entries;
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
            for (var i = 0; i < entries.length; i++) {
                var full = path.join(dir, entries[i].name);
                if (entries[i].isDirectory()) {
                    walk(full, entries[i].name || cat);
                } else if (entries[i].isFile() && /\.ffx$/i.test(entries[i].name)) {
                    found.push({
                        id: full,
                        name: path.basename(entries[i].name, ".ffx"),
                        category: cat,
                        fullPath: full
                    });
                }
            }
        }
        walk(folder, "User");
        found.sort(function (a, b) { return a.name.localeCompare(b.name); });
        presets = found;
        renderPresets();
        toast("Presets loaded", "success", "Loaded " + found.length + " preset" + (found.length === 1 ? "" : "s") + ".");
    }

    $id("btn-refresh-presets").addEventListener("click", function () {
        var folder = "";
        try { folder = localStorage.getItem("aelt_preset_folder") || ""; } catch (e) {}
        loadPresets(folder);
    });
    $id("btn-choose-presets").addEventListener("click", function () {
        var cur = "";
        try { cur = localStorage.getItem("aelt_preset_folder") || ""; } catch (e) {}
        var p = window.prompt("Paste path to your AE User Presets folder:", cur || "C:\\Users\\<you>\\Documents\\Adobe\\After Effects 2024\\User Presets");
        if (!p) return;
        p = p.trim().replace(/^"(.*)"$/, "$1");
        loadPresets(p);
    });
    $id("preset-search").addEventListener("input", renderPresets);
    $id("btn-clear-search").addEventListener("click", function () {
        $id("preset-search").value = "";
        renderPresets();
    });
    // auto-load on start
    (function () {
        var saved = "";
        try { saved = localStorage.getItem("aelt_preset_folder") || ""; } catch (e) {}
        loadPresets(saved);
    })();

    // ---------------- captions ----------------
    $id("btn-apply-captions").addEventListener("click", function () {
        var raw = $id("caption-input").value.trim();
        if (!raw) { toast("No captions", "error", "Enter caption lines first (format: seconds | text)."); return; }
        var lines = [];
        var rows = raw.split(/\r?\n/);
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i].trim();
            if (!row) continue;
            var m = row.split("|");
            if (m.length < 2) { lines.push([String(i * 2), row]); continue; }
            lines.push([m[0].trim(), m.slice(1).join("|").trim()]);
        }
        if (lines.length === 0) { toast("No captions", "error", "No valid caption lines found."); return; }
        var dur = num("caption-duration", 3);
        var fs = num("caption-fontsize", 60);
        var json = JSON.stringify(lines).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        callHost('applyCaptions("' + json + '", ' + dur + ", " + fs + ")", function (r) {
            if (isErr(r)) toast("Apply captions failed", "error", r); else toast("Captions", "success", r);
            refreshStats();
        });
    });
    $id("btn-remove-captions").addEventListener("click", function () {
        callHost("removeCaptions()", function (r) {
            if (isErr(r)) toast("Remove captions failed", "error", r); else toast("Captions removed", "success", r);
            refreshStats();
        });
    });

    // ---------------- twixtor ----------------
    $id("btn-apply-twixtor").addEventListener("click", function () {
        var mode = $id("sel-twixtor-mode").value;
        var speed = num("twixtor-speed", 40);
        var res = $id("sel-twixtor-res").value === "source";
        callHost('applyTwixtorClips("' + mode + '", ' + speed + ", " + res + ")", function (r) {
            if (isErr(r)) toast(mode === "anime" ? "Twixtor Clips failed" : "Film Twixtor failed", "error", r);
            else toast("Twixtor", "success", r);
            refreshStats();
        });
    });
    $id("btn-align-beats").addEventListener("click", function () {
        callHost("alignClipsToBeats(false)", function (r) {
            if (isErr(r)) toast("Align to beats failed", "error", r); else toast("Aligned", "success", r);
        });
    });
    $id("btn-fit-beats").addEventListener("click", function () {
        callHost("alignClipsToBeats(true)", function (r) {
            if (isErr(r)) toast("Fit between beats failed", "error", r); else toast("Stretched", "success", r);
        });
    });
    $id("btn-time-remap-graph").addEventListener("click", function () {
        $id("remap-card").classList.toggle("hidden");
    });
    $id("btn-close-remap").addEventListener("click", function () {
        $id("remap-card").classList.add("hidden");
    });

    // ---------------- bezier presets + canvas ----------------
    var PRESETS = [
        { id: "linear", name: "Linear", cp1x: 0.25, cp1y: 0.25, cp2x: 0.75, cp2y: 0.75 },
        { id: "ease", name: "Ease", cp1x: 0.25, cp1y: 0.1, cp2x: 0.25, cp2y: 1 },
        { id: "ease-in", name: "Ease In", cp1x: 0.42, cp1y: 0, cp2x: 1, cp2y: 1 },
        { id: "ease-out", name: "Ease Out", cp1x: 0, cp1y: 0, cp2x: 0.58, cp2y: 1 },
        { id: "ease-in-out", name: "Ease In Out", cp1x: 0.42, cp1y: 0, cp2x: 0.58, cp2y: 1 },
        { id: "smooth", name: "Smooth", cp1x: 0.4, cp1y: 0, cp2x: 0.2, cp2y: 1 },
        { id: "overshoot", name: "Overshoot", cp1x: 0.34, cp1y: 1.56, cp2x: 0.64, cp2y: 1 },
        { id: "snap", name: "Snap", cp1x: 0, cp1y: 1, cp2x: 0.5, cp2y: 1 },
        { id: "expo-out", name: "Expo Out", cp1x: 0.16, cp1y: 1, cp2x: 0.3, cp2y: 1 },
        { id: "expo-in", name: "Expo In", cp1x: 0.7, cp1y: 0, cp2x: 0.84, cp2y: 0 },
        { id: "back-in", name: "Back In", cp1x: 0.6, cp1y: -0.28, cp2x: 0.74, cp2y: 0.05 },
        { id: "back-out", name: "Back Out", cp1x: 0.26, cp1y: 0.95, cp2x: 0.4, cp2y: 1.28 }
    ];

    function fillPresetSelect(selId) {
        var sel = $id(selId);
        var html = "";
        for (var i = 0; i < PRESETS.length; i++) {
            html += '<option value="' + PRESETS[i].id + '">' + PRESETS[i].name + "</option>";
        }
        sel.innerHTML = html;
        sel.value = "ease";
    }
    fillPresetSelect("sel-remap-preset");
    fillPresetSelect("sel-graph-preset");

    function getPreset(selId) {
        var id = $id(selId).value;
        for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
        return PRESETS[1];
    }

    // canvas drawing
    function drawBezier(canvasId, cp, onEdit) {
        var canvas = $id(canvasId);
        var ctx = canvas.getContext("2d");
        var w = canvas.width, h = canvas.height;
        var pad = 28;
        var gridColor = "rgba(255,255,255,0.07)";
        var lineColor = "hsl(190, 90%, 55%)";
        var handleColor = "rgba(255,255,255,0.45)";

        // y range: -0.5..1.5 mapped into canvas with padding
        function toPx(x, y) {
            var px = pad + x * (w - 2 * pad);
            var py = h - pad - ((y + 0.5) / 2) * (h - 2 * pad);
            return [px, py];
        }

        function render() {
            ctx.clearRect(0, 0, w, h);
            ctx.strokeStyle = gridColor;
            ctx.lineWidth = 1;
            for (var g = 0; g <= 4; g++) {
                var gy = pad + (g / 4) * (h - 2 * pad);
                ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(w - pad, gy); ctx.stroke();
                var gx = pad + (g / 4) * (w - 2 * pad);
                ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, h - pad); ctx.stroke();
            }
            // axes box
            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);

            // curve
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            var steps = 80;
            for (var s = 0; s <= steps; s++) {
                var t = s / steps;
                var x = bezier(t, 0, cp.cp1x, cp.cp2x, 1);
                var y = bezier(t, 0, cp.cp1y, cp.cp2y, 1);
                var p = toPx(x, y);
                if (s === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
            }
            ctx.stroke();

            // handles
            var p0 = toPx(0, 0), p1 = toPx(cp.cp1x, cp.cp1y), p2 = toPx(cp.cp2x, cp.cp2y), p3 = toPx(1, 1);
            ctx.strokeStyle = handleColor;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(p3[0], p3[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
            ctx.fillStyle = "hsl(190,90%,60%)";
            [p1, p2].forEach(function (pt) {
                ctx.beginPath(); ctx.arc(pt[0], pt[1], 5, 0, Math.PI * 2); ctx.fill();
            });
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            [p0, p3].forEach(function (pt) {
                ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2); ctx.fill();
            });
        }

        function bezier(t, a, b, c, d) {
            var u = 1 - t;
            return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
        }

        // drag handles
        var dragging = null;
        function hit(mx, my) {
            var p1 = toPx(cp.cp1x, cp.cp1y), p2 = toPx(cp.cp2x, cp.cp2y);
            if (Math.abs(mx - p1[0]) < 10 && Math.abs(my - p1[1]) < 10) return 1;
            if (Math.abs(mx - p2[0]) < 10 && Math.abs(my - p2[1]) < 10) return 2;
            return null;
        }
        canvas.onmousedown = function (ev) {
            var r = canvas.getBoundingClientRect();
            var mx = (ev.clientX - r.left) * (canvas.width / r.width);
            var my = (ev.clientY - r.top) * (canvas.height / r.height);
            dragging = hit(mx, my);
        };
        canvas.onmousemove = function (ev) {
            var r = canvas.getBoundingClientRect();
            var mx = (ev.clientX - r.left) * (canvas.width / r.width);
            var my = (ev.clientY - r.top) * (canvas.height / r.height);
            if (!dragging) {
                canvas.style.cursor = hit(mx, my) ? "grab" : "crosshair";
                return;
            }
            function fromPx(px, py) {
                var x = Math.max(0, Math.min(1, (px - pad) / (w - 2 * pad)));
                var y = ((h - pad - py) / (h - 2 * pad)) * 2 - 0.5;
                return [Math.round(x * 100) / 100, Math.round(Math.max(-0.5, Math.min(1.5, y)) * 100) / 100];
            }
            var v = fromPx(mx, my);
            if (dragging === 1) { cp.cp1x = v[0]; cp.cp1y = v[1]; }
            else { cp.cp2x = v[0]; cp.cp2y = v[1]; }
            render();
            onEdit();
        };
        canvas.onmouseup = function () { dragging = null; };
        canvas.onmouseleave = function () { dragging = null; };

        render();
        return { render: render };
    }

    // remap-card editor
    var remapCp = { cp1x: 0.25, cp1y: 0.1, cp2x: 0.25, cp2y: 1 };
    var remapView = drawBezier("bezier-canvas", remapCp, function () {
        $id("bezier-input").value = remapCp.cp1x + ", " + remapCp.cp1y + ", " + remapCp.cp2x + ", " + remapCp.cp2y;
        $id("sel-remap-preset").value = "ease"; // nearest default marker; custom values remain in inputs
    });
    $id("sel-remap-preset").addEventListener("change", function () {
        var p = getPreset("sel-remap-preset");
        remapCp.cp1x = p.cp1x; remapCp.cp1y = p.cp1y; remapCp.cp2x = p.cp2x; remapCp.cp2y = p.cp2y;
        $id("bezier-input").value = p.cp1x + ", " + p.cp1y + ", " + p.cp2x + ", " + p.cp2y;
        remapView.render();
    });
    $id("bezier-input").addEventListener("change", function () {
        var parts = this.value.split(",").map(function (s) { return parseFloat(s.trim()); });
        if (parts.length === 4 && parts.every(function (n) { return !isNaN(n); })) {
            remapCp.cp1x = clamp(parts[0], 0, 1); remapCp.cp1y = clamp(parts[1], -0.5, 1.5);
            remapCp.cp2x = clamp(parts[2], 0, 1); remapCp.cp2y = clamp(parts[3], -0.5, 1.5);
            remapView.render();
        }
    });
    $id("btn-copy-bezier").addEventListener("click", function () {
        copyText("cubic-bezier(" + $id("bezier-input").value + ")");
    });
    $id("btn-read-easing").addEventListener("click", function () {
        callHost("readEasingFromAE()", function (r) {
            if (isErr(r)) { toast("Read Values failed", "error", r); return; }
            try {
                var g = JSON.parse(r);
                remapCp.cp1x = g.cp1x; remapCp.cp1y = g.cp1y; remapCp.cp2x = g.cp2x; remapCp.cp2y = g.cp2y;
                $id("bezier-input").value = g.cp1x + ", " + g.cp1y + ", " + g.cp2x + ", " + g.cp2y;
                remapView.render();
                toast("Read values from AE", "success", g.propertyName + " keys " + g.segmentStart + "-" + g.segmentEnd);
            } catch (e) {
                toast("Read Values failed", "error", String(r));
            }
        });
    });
    $id("btn-reset-easing").addEventListener("click", function () {
        $id("sel-remap-preset").dispatchEvent(new Event("change"));
        toast("Reset to preset", "success");
    });

    function easingCall(cp1x, cp1y, cp2x, cp2y) {
        // convert bezier control points to speed/influence approximation for setTemporalEaseAtKey
        var outInfluence = Math.round(clamp(cp1x, 0.01, 1) * 100 * 3 * 10) / 10;
        var inInfluence = Math.round(clamp(1 - cp2x, 0.01, 1) * 100 * 3 * 10) / 10;
        var startSlope = Math.round(clamp(cp1y / Math.max(cp1x, 0.01), 0, 3) * 100) / 100;
        var endSlope = Math.round(clamp((1 - cp2y) / Math.max(1 - cp2x, 0.01), 0, 3) * 100) / 100;
        callHost("applyEasingToKeyframes(" + cp1x + ", " + cp1y + ", " + cp2x + ", " + cp2y + ", " +
            outInfluence + ", " + inInfluence + ", " + startSlope + ", " + endSlope + ")", function (r) {
            if (isErr(r)) toast("Apply to Keyframes failed", "error", r); else toast("Easing applied", "success", r);
        });
    }
    $id("btn-apply-easing").addEventListener("click", function () {
        easingCall(remapCp.cp1x, remapCp.cp1y, remapCp.cp2x, remapCp.cp2y);
    });

    // graphs tab editor
    var graphCp = { cp1x: 0.25, cp1y: 0.1, cp2x: 0.25, cp2y: 1 };
    var graphView = drawBezier("graph-canvas", graphCp, function () {
        $id("graph-bezier-input").value = graphCp.cp1x + ", " + graphCp.cp1y + ", " + graphCp.cp2x + ", " + graphCp.cp2y;
    });
    $id("sel-graph-preset").addEventListener("change", function () {
        var p = getPreset("sel-graph-preset");
        graphCp.cp1x = p.cp1x; graphCp.cp1y = p.cp1y; graphCp.cp2x = p.cp2x; graphCp.cp2y = p.cp2y;
        $id("graph-bezier-input").value = p.cp1x + ", " + p.cp1y + ", " + p.cp2x + ", " + p.cp2y;
        graphView.render();
    });
    $id("graph-bezier-input").addEventListener("change", function () {
        var parts = this.value.split(",").map(function (s) { return parseFloat(s.trim()); });
        if (parts.length === 4 && parts.every(function (n) { return !isNaN(n); })) {
            graphCp.cp1x = clamp(parts[0], 0, 1); graphCp.cp1y = clamp(parts[1], -0.5, 1.5);
            graphCp.cp2x = clamp(parts[2], 0, 1); graphCp.cp2y = clamp(parts[3], -0.5, 1.5);
            graphView.render();
        }
    });
    $id("btn-graph-copy").addEventListener("click", function () {
        copyText("cubic-bezier(" + $id("graph-bezier-input").value + ")");
    });
    $id("btn-graph-read").addEventListener("click", function () {
        callHost("readEasingFromAE()", function (r) {
            if (isErr(r)) { toast("Read Values failed", "error", r); return; }
            try {
                var g = JSON.parse(r);
                graphCp.cp1x = g.cp1x; graphCp.cp1y = g.cp1y; graphCp.cp2x = g.cp2x; graphCp.cp2y = g.cp2y;
                $id("graph-bezier-input").value = g.cp1x + ", " + g.cp1y + ", " + g.cp2x + ", " + g.cp2y;
                graphView.render();
                toast("Read values from AE", "success", g.propertyName + " keys " + g.segmentStart + "-" + g.segmentEnd);
            } catch (e) {
                toast("Read Values failed", "error", String(r));
            }
        });
    });
    $id("btn-graph-reset").addEventListener("click", function () {
        $id("sel-graph-preset").dispatchEvent(new Event("change"));
        toast("Reset to preset", "success");
    });
    $id("btn-graph-linear").addEventListener("click", function () {
        $id("sel-graph-preset").value = "linear";
        $id("sel-graph-preset").dispatchEvent(new Event("change"));
        toast("Set to linear", "success");
    });
    $id("btn-graph-apply").addEventListener("click", function () {
        easingCall(graphCp.cp1x, graphCp.cp1y, graphCp.cp2x, graphCp.cp2y);
    });

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function copyText(text) {
        try {
            var ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            toast("Copied", "success", text);
        } catch (e) {
            toast("Could not copy", "error", String(e));
        }
    }

    // ---------------- beats (BeatMark Pro) ----------------
    function setAmpStatus(text, cls) {
        var el = $id("amp-status");
        el.className = "status-box " + (cls || "info");
        el.textContent = text;
    }

    function refreshAudioLayers() {
        callHost("listAudioLayers()", function (r) {
            if (isErr(r)) { setAmpStatus(String(r), "error"); return; }
            try {
                var s = JSON.parse(r);
                var sel = $id("sel-audio-layer");
                var prev = sel.value;
                var html = "";
                if (!s.layers || s.layers.length === 0) {
                    html = '<option value="">No audio layers</option>';
                } else {
                    for (var i = 0; i < s.layers.length; i++) {
                        html += '<option value="' + s.layers[i].index + '">' + escapeHtml(s.layers[i].name) + "</option>";
                    }
                }
                sel.innerHTML = html;
                // restore previous selection if still present
                for (var j = 0; j < sel.options.length; j++) {
                    if (sel.options[j].value === prev) { sel.value = prev; break; }
                }
                if (s.amp && s.amp.ok) {
                    setAmpStatus("Audio Amplitude detected — ready to analyze (" + s.amp.layerName + ", " + s.amp.numKeys + " keys)", "success");
                } else if (s.amp && s.amp.stage === "zero-keys") {
                    setAmpStatus("No usable amplitude keyframes found", "warn");
                } else {
                    setAmpStatus("No amplitude layer. Create it manually first.", "warn");
                }
            } catch (e) {
                setAmpStatus(String(r), "error");
            }
        });
    }
    $id("btn-refresh-audio").addEventListener("click", refreshAudioLayers);

    // Generate Audio Amplitude Layer: runs AE's real Convert Audio to Keyframes.
    // Requires the audio layer to be selected in the timeline (AE's command acts
    // on the layer selection, not a dropdown). Two-phase reuse/regenerate.
    $id("btn-gen-amp").addEventListener("click", function () {
        var audioIdx = parseInt($id("sel-audio-layer").value, 10) || 0;
        if (!audioIdx) { toast("Select an audio layer", "error", "Pick an audio layer from the dropdown first."); return; }
        callHost("generateAudioAmplitudeLayer(false)", function (r) {
            if (isErr(r)) { toast("Generate Audio Amplitude failed", "error", r); return; }
            try {
                var s = JSON.parse(r);
                if (s.confirm && s.reuse) {
                    var ok = window.confirm(s.message + "\n\nReuse it, or regenerate a new one?");
                    if (ok) { toast("Amplitude reused", "info", s.message); refreshAudioLayers(); return; }
                    callHost("generateAudioAmplitudeLayer(true)", function (r2) {
                        if (isErr(r2)) toast("Generate Audio Amplitude failed", "error", r2);
                        else toast("Audio Amplitude", "success", r2);
                        refreshAudioLayers();
                    });
                } else {
                    toast("Audio Amplitude", "success", String(r));
                    refreshAudioLayers();
                }
            } catch (e) {
                toast("Audio Amplitude", "success", String(r));
                refreshAudioLayers();
            }
        });
    });

    // naming radios: only the selected mode's input is enabled; values preserved
    var namingRadios = document.querySelectorAll('input[name="naming"]');
    function updateNamingInputs() {
        var mode = "default";
        var radios = document.querySelectorAll('input[name="naming"]');
        for (var i = 0; i < radios.length; i++) if (radios[i].checked) mode = radios[i].value;
        $id("name-custom").disabled = mode !== "custom";
        $id("name-sequential").disabled = mode !== "sequential";
    }
    for (var n2 = 0; n2 < namingRadios.length; n2++) {
        namingRadios[n2].addEventListener("change", updateNamingInputs);
    }

    $id("btn-generate-beats").addEventListener("click", function () {
        var audioIdx = parseInt($id("sel-audio-layer").value, 10) || 0;
        if (!audioIdx) { toast("Select an audio layer", "error", "Pick an audio layer from the dropdown first."); return; }
        var mode = $id("sel-beat-mode").value;
        var naming = "default", nameValue = "";
        var radios = document.querySelectorAll('input[name="naming"]');
        for (var i = 0; i < radios.length; i++) if (radios[i].checked) naming = radios[i].value;
        if (naming === "custom") nameValue = $id("name-custom").value.trim() || "Drop";
        if (naming === "sequential") nameValue = $id("name-sequential").value.trim() || "Scene";
        var coloring = "single", colorValue = $id("sel-marker-color").value;
        var cradios = document.querySelectorAll('input[name="coloring"]');
        for (var c = 0; c < cradios.length; c++) if (cradios[c].checked) coloring = cradios[c].value;
        var opts = JSON.stringify({ audioIndex: audioIdx, mode: mode, naming: naming, nameValue: nameValue, coloring: coloring, colorValue: colorValue });
        callHost("generateBeatMarkers(" + JSON.stringify(opts) + ")", function (r) {
            if (isErr(r)) toast("Generate Beat Markers failed", "error", r);
            else toast("Beat Markers", /^no new markers/i.test(r) ? "info" : "success", r);
            refreshAudioLayers();
        });
    });

    $id("btn-clear-tool-markers").addEventListener("click", function () {
        // pass the current naming settings so markers generated with a custom
        // name or sequential prefix are matched too
        var naming = "default", nameValue = "";
        var radios = document.querySelectorAll('input[name="naming"]');
        for (var i = 0; i < radios.length; i++) if (radios[i].checked) naming = radios[i].value;
        if (naming === "custom") nameValue = $id("name-custom").value.trim() || "Drop";
        if (naming === "sequential") nameValue = $id("name-sequential").value.trim() || "Scene";
        var args = ', "' + naming.replace(/"/g, '\\"') + '", "' + String(nameValue).replace(/"/g, '\\"') + '"';
        callHost("clearToolMarkers(true" + args + ")", function (r) {
            if (isErr(r)) toast("Clear Markers failed", "error", r); else toast("Clear Markers", "info", r);
        });
    });

    $id("btn-remove-amp").addEventListener("click", function () {
        // first call asks the host what would be affected; confirm before deleting
        callHost('removeAmpLayers(false)', function (r) {
            if (isErr(r)) { toast("Remove Amp Layers failed", "error", r); return; }
            try {
                var s = JSON.parse(r);
                if (s.confirm) {
                    var ok = window.confirm("Remove " + s.layers.length + " Audio Amplitude layer(s)?\n\n" + s.layers.join("\n") + "\n\nOriginal audio sources will not be deleted.");
                    if (!ok) return;
                    callHost("removeAmpLayers(true)", function (r2) {
                        if (isErr(r2)) toast("Remove Amp Layers failed", "error", r2); else toast("Amp Layers", "success", r2);
                        refreshAudioLayers();
                    });
                } else {
                    toast("Amp Layers", "info", String(r));
                }
            } catch (e) {
                toast("Amp Layers", "info", String(r));
            }
        });
    });

    // initial load
    refreshAudioLayers();

    // ---------------- keyboard shortcuts ----------------
    document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
            $id("dlg-settings").classList.add("hidden");
            $id("dlg-cache").classList.add("hidden");
        }
        if (ev.ctrlKey && ev.key === "r") { ev.preventDefault(); location.reload(); }
    });

})();
