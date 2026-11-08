$js = Get-Content 'ref-bundle.js' -Raw
# Dump the layers tab Twixtor Studios panel section and Graphs tab
$i = $js.IndexOf('dripz_film_preset_base_path')
$s=[Math]::Max(0,$i-200)
$js.Substring($s, 6000) -replace '\\s+',' '
