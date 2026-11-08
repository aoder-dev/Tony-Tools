$js = Get-Content 'ref-bundle.js' -Raw
# Dump the Twixtor Studios tab header/settings area (before the Apply button)
$i = $js.IndexOf('Twixtor Studios"')
"IDX TS: $i"
$j = $js.IndexOf('outInfluence')
"IDX outInfl: $j"
$k = $js.IndexOf('Drag in a preset .ffx')
"IDX drag: $k"
$m = $js.IndexOf('Drop in audio file')
"IDX drop: $m"
# Dump the graphs tab area (panel) — the panel graphs tab likely near 800000. Search 'Saved Text Presets'
$n = $js.IndexOf('Saved Text Presets')
"IDX STP: $n"
$q = $js.IndexOf('Drop in a preset')
"IDX dropP: $q"
if ($q -ge 0) { $s=[Math]::Max(0,$q-1500); $js.Substring($s, 5000) -replace '\\s+',' ' }
