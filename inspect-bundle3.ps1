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
Dump 'Live Preview' 300 500 3
Dump 'Auto Pre-Compose' 200 200 6
Dump 'Create Null' 150 150 4
Dump 'Copy / Paste' 150 150 4
Dump 'Merge + Next' 150 150 4
Dump 'Batch Apply' 200 200 4
Dump 'KF Assistant' 150 250 4
Dump 'Preset KF' 150 200 4
Dump 'Adjust comp' 150 150 3
Dump 'Null Layers' 150 150 3
Dump 'AE TIMELINE' 200 200 3
Dump 'SYSTEM // ONLINE' 300 300 3
