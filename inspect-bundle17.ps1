$js = Get-Content 'ref-bundle.js' -Raw
# Dump region 780500..787246 (between Twixtor Studios settings start and KF Assistant) to catch the panels layout of layers tab: stats, adjustment layers, nulls, precompose, presets, flowframe
$js.Substring(780600, 7000) -replace '\\s+',' '
