$js = Get-Content 'ref-bundle.js' -Raw
# Graph tab (B6) region: around 762362 'Graph Editor'
$js.Substring(760500, 8000) -replace '\\s+',' '
