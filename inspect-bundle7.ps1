$js = Get-Content 'ref-bundle.js' -Raw
# Dump the panel component JSX: from 1000 chars before first 'KF Assistant' to 800 after 'User Presets'
$i = $js.IndexOf('KF Assistant')
"IDX: $i"
$s=[Math]::Max(0,$i-4500)
$js.Substring($s, 7000) -replace '\\s+',' '
