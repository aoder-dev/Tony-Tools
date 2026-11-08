$js = Get-Content 'AE-Layers-Tool/js/main.js' -Raw
$html = Get-Content 'AE-Layers-Tool/index.html' -Raw
$pat = [regex]::Escape('id("') + '([a-zA-Z0-9\-]+)' + [regex]::Escape('")')
$ids = [regex]::Matches($js, $pat) | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$missing = @()
foreach ($i in $ids) { if ($html -notmatch ('id="' + [regex]::Escape($i) + '"')) { $missing += $i } }
if ($missing) { "MISSING IDS: " + ($missing -join ', ') } else { "ALL IDS OK ($($ids.Count) referenced)" }
