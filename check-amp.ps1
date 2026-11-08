$jsx = Get-Content 'AE-Layers-Tool/jsx/host.jsx' -Raw
foreach ($f in @('generateAudioAmplitudeLayer','findMenuCommandId','executeCommand')) {
  $c = ([regex]::Matches($jsx, [regex]::Escape($f))).Count
  "host.jsx $f => $c"
}
$ob = ([regex]::Matches($jsx,'\{')).Count; $cb = ([regex]::Matches($jsx,'\}')).Count
"braces: $ob/$cb"
