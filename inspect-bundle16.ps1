$js = Get-Content 'ref-bundle.js' -Raw
# Dump the Twixtor Studios tab panel UI: around 779292
$js.Substring(779200, 7000) -replace '\\s+',' '
