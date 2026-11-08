$js = Get-Content 'ref-bundle.js' -Raw
# Graph tab UI continued: dump 469000..478000 to see the graph tab layout (canvas, folders, presets)
$js.Substring(469500, 8000) -replace '\\s+',' '
