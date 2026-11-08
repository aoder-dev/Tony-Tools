$js = Get-Content 'ref-bundle.js' -Raw
# continue after KF Assistant block: dump 7000 chars starting at 'Create Null' index region minus 3000
$i = $js.IndexOf('Copy / Paste')
"IDX CP: $i"
$s=[Math]::Max(0,$i-3500)
$js.Substring($s, 7500) -replace '\\s+',' '
