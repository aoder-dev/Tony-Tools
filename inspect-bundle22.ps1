$js = Get-Content 'ref-bundle.js' -Raw
# Graph tab actual content (B6 function): find 'function B6' or 'B6='
foreach ($t in @('function B6','B6=()','B6=o.jsxs','const B6')) { $i=$js.IndexOf($t); "$t => $i" }
# Search for 'Read easing' section UI
$i = $js.IndexOf('Read easing from AE')
"IDX readEasing: $i"
$s=[Math]::Max(0,$i-6000)
$js.Substring($s, 8000) -replace '\\s+',' '
