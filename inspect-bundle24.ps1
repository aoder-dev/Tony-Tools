$js = Get-Content 'ref-bundle.js' -Raw
# Graph tab header area (top of B6 render, before 469500). Dump 465500..470500
$js.Substring(465500, 5000) -replace '\\s+',' '
