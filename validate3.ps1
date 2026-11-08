# validate host.jsx after edits: brace balance + check removed/new functions
$jsx = Get-Content 'AE-Layers-Tool/jsx/host.jsx' -Raw
$ob = ([regex]::Matches($jsx,'\{')).Count; $cb = ([regex]::Matches($jsx,'\}')).Count
$op = ([regex]::Matches($jsx,'\(')).Count; $cp = ([regex]::Matches($jsx,'\)')).Count
"JSX braces: $ob/$cb  parens: $op/$cp"
foreach ($f in @('checkAudioAmplitude','autoBeatMarkFromAmplitude','analyzeAndMarkBeats','placeBeatMarkers','clearBeatMarkers')) {
  $c = ([regex]::Matches($jsx, "function $f")).Count
  "$f => $c"
}
# main.js should not reference removed ids
$js = Get-Content 'AE-Layers-Tool/js/main.js' -Raw
foreach ($id in @('bpm-input','beat-start','beat-stop','chk-comp-markers','btn-apply-beats','btn-clear-beats')) {
  $c = ([regex]::Matches($js, [regex]::Escape($id))).Count
  "main.js refs $id => $c"
}
