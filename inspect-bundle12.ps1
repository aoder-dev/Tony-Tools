$js = Get-Content 'ref-bundle.js' -Raw
# Dump rest of layers tab: from index of 'User Presets' panel section (accentColor 190) and 'Auto Flowframe' region
$i = $js.IndexOf('Auto Flowframe')
"IDX AF: $i"
$s=[Math]::Max(0,$i-4000)
$js.Substring($s, 5500) -replace '\\s+',' '
