$js = Get-Content 'ref-bundle.js' -Raw
# Locate the panel component: find "Auto Pre-Compose" big index and dump surrounding panel JSX region
$i = $js.IndexOf('Auto Pre-Compose')
"IDX AutoPreCompose: $i"
# Also find the stats keys region and dump wide
$j = $js.IndexOf('keyframeCount')
$k0 = [Math]::Max(0, $j - 3000)
$js.Substring($k0, 4500) -replace '\\s+', ' '
