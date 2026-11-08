$js = Get-Content 'ref-bundle.js' -Raw
# Find live-preview route content: search for strings around "preview" / panel feature names
$terms = @('Live Preview','live-preview','layerTools','Layer Tools','AE Layer','open panel','panelWidth','tabBar','sections','featureList','Caption','Marker','Speed','Curve','Convert','Extrapolate','Bake','Smoothing','Explode','Smoke','Grid','Zoom')
foreach ($t in $terms) {
  $c = ([regex]::Matches($js, [regex]::Escape($t))).Count
  "$t => $c"
}
# dump short labeled string literals likely used as button labels
$ms = [regex]::Matches($js, '"([A-Z][A-Za-z0-9 /&+\-]{2,24})"')
$set = @{}
foreach ($m in $ms) { $set[$m.Groups[1].Value] = $true }
($set.Keys | Sort-Object) -join ' | '
