$jsx = Get-Content 'AE-Layers-Tool/jsx/host.jsx' -Raw
# confirm no AELT Beat remains in creation path
"cAELT count => " + ([regex]::Matches($jsx, [regex]::Escape('AELT Beat'))).Count
"comment = label => " + ([regex]::Matches($jsx, [regex]::Escape('mv.comment = label'))).Count
"clearToolMarkers fn => " + ([regex]::Matches($jsx, [regex]::Escape('function clearToolMarkers'))).Count
# main.js passes naming args
$js = Get-Content 'AE-Layers-Tool/js/main.js' -Raw
"main clearToolMarkers call => " + ([regex]::Matches($js, [regex]::Escape('clearToolMarkers(true'))).Count
