$js = Get-Content 'ref-bundle.js' -Raw
# Find the graphs tab UI: search for 'Choose graph preset' / 'Graph Editor' panel region
$i = $js.IndexOf('Choose graph preset')
"IDX: $i"
$s=[Math]::Max(0,$i-2500)
$js.Substring($s, 6500) -replace '\\s+',' '
