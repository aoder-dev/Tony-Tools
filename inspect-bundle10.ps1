$js = Get-Content 'ref-bundle.js' -Raw
# Dump the panel layout area: from ~744000 to 750000 (around layers tab), and 750000-756000
$js.Substring(744800, 6500) -replace '\\s+',' '
