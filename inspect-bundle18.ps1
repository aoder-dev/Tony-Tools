$js = Get-Content 'ref-bundle.js' -Raw
# After KF Assistant column: the second column of layers tab grid (Twixtor studios mini + Pre-compose tools + User Presets). Search between 787246 and 'User Presets' accentColor occurrence
$i = $js.IndexOf('accentColor:"190 80% 50%"', 787000)
"IDX: $i"
if ($i -ge 0) { $js.Substring($i-2000, 9000) -replace '\\s+',' ' }
