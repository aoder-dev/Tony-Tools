$root = 'AE-Layers-Tool'
$js = Get-Content "$root/js/main.js" -Raw
$jsx = Get-Content "$root/jsx/host.jsx" -Raw
$html = Get-Content "$root/index.html" -Raw
# element id cross-check
$pat = [regex]::Escape('id("') + '([a-zA-Z0-9\-]+)' + [regex]::Escape('")')
$ids = [regex]::Matches($js, $pat) | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$missing = @()
foreach ($i in $ids) { if ($html -notmatch ('id="' + [regex]::Escape($i) + '"')) { $missing += $i } }
if ($missing) { "MISSING IDS: " + ($missing -join ', ') } else { "ALL IDS OK ($($ids.Count) referenced)" }
# host function presence
foreach ($f in @('listAudioLayers','generateBeatMarkers','clearToolMarkers','removeAmpLayers','checkAudioAmplitude','diagnoseAudioAmplitude','findAmplitudeSlider')) {
  $c = ([regex]::Matches($jsx, "function $f")).Count
  "host.jsx $f => $c"
}
# exactly two beat modes in html
"html sel-beat-mode options => " + ([regex]::Matches($html, [regex]::Escape('sel-beat-mode'))).Count
