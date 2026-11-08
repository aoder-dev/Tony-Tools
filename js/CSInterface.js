/* CSInterface.js — minimal, CEP-compatible bridge (ES5).
   Implements the subset of Adobe's CSInterface that this panel uses:
   evalScript, getSystemPath-free utilities, theme colors not needed (custom CSS). */

function CSInterface() {}

CSInterface.EVAL_SCRIPT_ERROR = "EvalScript error.";

CSInterface.prototype.evalScript = function (script, callback) {
    callback = callback || function () {};
    var cep = window.__adobe_cep__;
    if (!cep || typeof cep.evalScript !== "function") {
        callback(CSInterface.EVAL_SCRIPT_ERROR);
        return;
    }
    cep.evalScript(script, callback);
};

CSInterface.prototype.getHostEnvironment = function () {
    try {
        return JSON.parse(window.__adobe_cep__.getHostEnvironment());
    } catch (e) {
        return null;
    }
};

CSInterface.prototype.getExtensionID = function () {
    try { return window.__adobe_cep__.getExtensionId(); } catch (e) { return ""; }
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    try {
        var cep = window.__adobe_cep__;
        if (cep && typeof cep.openURLInDefaultBrowser === "function") {
            cep.openURLInDefaultBrowser(url);
            return true;
        }
    } catch (e) {}
    try { window.open(url, "_blank"); return true; } catch (e2) { return false; }
};

CSInterface.prototype.resizePanel = function (w, h) {
    try { window.__adobe_cep__.resizeContent(w, h); } catch (e) {}
};
