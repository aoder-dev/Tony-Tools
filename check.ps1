# Consistency checks for the panel.
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File check.ps1

$root = $PSScriptRoot
foreach ($f in 'index.html', 'js/main.js', 'jsx/host.jsx', 'CSXS/manifest.xml') {
  if (-not (Test-Path "$root/$f")) { throw "Missing $root/$f - the script must stay at the repository root." }
}

$html = Get-Content "$root/index.html" -Raw
$js   = Get-Content "$root/js/main.js" -Raw
$jsx  = Get-Content "$root/jsx/host.jsx" -Raw

# 1. CEP manifest parses and declares an extension id.
try {
  [xml]$doc = Get-Content "$root/CSXS/manifest.xml" -Raw
  $extId = $doc.ExtensionManifest.ExtensionList.Extension.Id
  "manifest OK (root=$($doc.DocumentElement.Name), extension=$extId)"
} catch {
  "manifest FAILED: $_"
}

# 2. Every element id referenced from main.js must exist in index.html.
$ids = [regex]::Matches($js, 'id\("([A-Za-z0-9\-]+)"\)') |
       ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$missing = @($ids | Where-Object { $html -notmatch ('id="' + [regex]::Escape($_) + '"') })
if ($missing.Count -gt 0) { 'MISSING IDS: ' + ($missing -join ', ') }
else { 'element ids OK (' + $ids.Count + ' referenced)' }

# 3. Host functions the panel calls should be defined in host.jsx.
$expected = 'getCompStats', 'createAdjustmentLayers', 'createNullObjects',
            'stretchSelectedLayersKeyframesToLayer', 'trimSelectedLayersToKeyframes',
            'autoPreCompose', 'applyPresetPathToSelectedLayers', 'applyTwixtorClips',
            'alignClipsToBeats', 'applyCaptions', 'removeCaptions',
            'applyEasingToKeyframes', 'readEasingFromAE',
            'listAudioLayers', 'generateBeatMarkers', 'clearToolMarkers', 'removeAmpLayers',
            'generateAudioAmplitudeLayer', 'checkAudioAmplitude', 'autoBeatMarkFromAmplitude'
foreach ($fn in $expected) {
  $n = ([regex]::Matches($jsx, "function $fn\b")).Count
  if ($n -eq 1) { "host function $fn OK" } else { "host function $fn MISSING (matches: $n)" }
}

# 4. Brace and parenthesis balance with comments removed.
#    String contents are not stripped, so a mismatch is a hint, not proof.
function Get-CodeBalance([string]$text) {
  $t = [regex]::Replace($text, '/\*[\s\S]*?\*/', ' ')
  $t = [regex]::Replace($t, '(?m)//[^\r\n]*', ' ')
  [pscustomobject]@{
    OB = ([regex]::Matches($t, '\{')).Count
    CB = ([regex]::Matches($t, '\}')).Count
    OP = ([regex]::Matches($t, '\(')).Count
    CP = ([regex]::Matches($t, '\)')).Count
  }
}
foreach ($item in @(@('host.jsx', $jsx), @('main.js', $js))) {
  $fileName = $item[0]; $b = Get-CodeBalance $item[1]
  if ($b.OB -eq $b.CB -and $b.OP -eq $b.CP) {
    "$fileName balanced (braces $($b.OB)/$($b.CB), parens $($b.OP)/$($b.CP))"
  } else {
    "$fileName UNBALANCED (braces $($b.OB)/$($b.CB), parens $($b.OP)/$($b.CP))"
  }
}
