$js = Get-Content 'ref-bundle.js' -Raw
# Dump after Adj. Layer creation: nulls/precomps/stats section + Twixtor mini panel in layers tab (region 793000-801000)
$js.Substring(793500, 8000) -replace '\\s+',' '
