$js = Get-Content 'ref-bundle.js' -Raw
# Panel region: from 'SYSTEM // ONLINE' area to 'Auto Pre-Compose' region, dump 6000 chars around panel header and layout
$i = $js.IndexOf('Key Frame Adjustment')
"IDX KFA: $i"
if ($i -ge 0) { $s=[Math]::Max(0,$i-2500); $js.Substring($s, 6000) -replace '\\s+',' ' }
