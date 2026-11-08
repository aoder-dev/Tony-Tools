$js = Get-Content 'ref-bundle.js' -Raw
function Dump([string]$term, [int]$before, [int]$after, [int]$max) {
  "=== $term ==="
  $idx = 0; $n = 0
  while ($n -lt $max) {
    $i = $js.IndexOf($term, $idx)
    if ($i -lt 0) { break }
    $s = [Math]::Max(0, $i - $before)
    $len = [Math]::Min($before + $after, $js.Length - $s)
    $js.Substring($s, $len) -replace '\s+', ' '
    "---"
    $idx = $i + $term.Length; $n++
  }
}
Dump 'Read Values failed' 100 100 2
Dump 'Read values from AE' 300 300 3
Dump 'panelStats' 100 200 2
Dump 'Active Comp' 200 250 3
Dump 'Auto Flowframe' 250 250 4
Dump 'Apply Film Twixtor' 250 250 3
Dump 'Apply Beat Markers"' 200 200 2
Dump 'Fit Between Beats' 250 250 3
Dump 'Stretch To Fit Beats' 250 250 3
Dump 'Align Clips To Beats' 250 250 3
Dump 'Start Applying Captions' 250 250 2
Dump 'Rebuild Current Captions' 250 250 2
Dump 'Apply Easing To Keyframes' 250 250 2
Dump 'Apply Time Remap Graph' 250 250 2
Dump 'Clear Beat Markers' 250 250 2
Dump 'evalScript' 150 250 4
