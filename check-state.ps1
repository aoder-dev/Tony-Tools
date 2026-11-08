$root = 'AE-Layers-Tool'
$html = Get-Content "$root/index.html" -Raw
$css = Get-Content "$root/css/styles.css" -Raw
$js = Get-Content "$root/js/main.js" -Raw
$jsx = Get-Content "$root/jsx/host.jsx" -Raw
function C($n, $txt, $term) { $c = ([regex]::Matches($txt, [regex]::Escape($term))).Count; "{0}: {1} => {2}" -f $n, $term, $c }
C 'index.html' $html 'Audio Amplitude Required'
C 'index.html' $html 'accent-swatches'
C 'index.html' $html 'darkness-range'
C 'styles.css' $css '#C9954B'
C 'styles.css' $css 'hsl(190'
C 'main.js' $js 'aelt_theme2'
C 'main.js' $js 'THEMES'
C 'host.jsx' $jsx 'Strongest Beats'
C 'host.jsx' $jsx 'generateBeatMarkers'
C 'host.jsx' $jsx 'removeAmpLayers'
