$js = Get-Content 'ref-bundle.js' -Raw
# Dump the panel comp: 773000..781000 (covers pre-comp tools + KF assistant)
$js.Substring(773500, 8000) -replace '\\s+',' '
