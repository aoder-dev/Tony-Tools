$jsx = Get-Content 'AE-Layers-Tool/jsx/host.jsx' -Raw
$ms = [regex]::Matches($jsx, 'mv\.comment[^\r\n]*|comment[ ]*=[ ]*"[^"]*"')
foreach ($m in $ms) { $m.Value }
"---"
# also find the generate function's marker creation block
$i = $jsx.IndexOf('var mv = new MarkerValue')
$jsx.Substring($i, 400)
