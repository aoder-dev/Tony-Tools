# validate manifest XML + basic JSX checks
$xml = Get-Content 'AE-Layers-Tool/CSXS/manifest.xml' -Raw
try { [xml]$doc = $xml; "MANIFEST-XML-OK: root=$($doc.DocumentElement.Name), ext=$($doc.ExtensionManifest.ExtensionList.Extension.Id)" } catch { "MANIFEST-XML-FAIL: $_" }
$jsx = Get-Content 'AE-Layers-Tool/jsx/host.jsx' -Raw
# brace/paren balance
$ob = ([regex]::Matches($jsx,'\{')).Count; $cb = ([regex]::Matches($jsx,'\}')).Count
$op = ([regex]::Matches($jsx,'\(')).Count; $cp = ([regex]::Matches($jsx,'\)')).Count
"JSX braces: $ob/$cb  parens: $op/$cp"
$js = Get-Content 'AE-Layers-Tool/js/main.js' -Raw
$ob2 = ([regex]::Matches($js,'\{')).Count; $cb2 = ([regex]::Matches($js,'\}')).Count
"JS braces: $ob2/$cb2"
# HTML sanity: ids referenced in main.js exist in index.html
$html = Get-Content 'AE-Layers-Tool/index.html' -Raw
$ids = [regex]::Matches($js,'\id\("([a-zA-Z0-9\-]+)"\)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$missing = @()
foreach ($i in $ids) { if ($html -notmatch "id=`"$i`"") { $missing += $i } }
if ($missing) { "MISSING IDS: " + ($missing -join ', ') } else { "ALL IDS OK ($($ids.Count) referenced)" }
