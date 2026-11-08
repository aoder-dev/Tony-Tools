$js = Get-Content 'ref-bundle.js' -Raw
# Find graphs tab panel component (S$ / B6). Search for 'Read easing from AE' and 'Reset Graph State'
foreach ($t in @('Read easing from AE','Reset Graph State','Graph Editor','Save preset','Preset KF Modes','stretch"','merge','splitLayersAtPlayhead','mergeCaptionWithNext','undoCaptionMerge','applyEasingToKeyframes')) {
  $i = $js.IndexOf($t)
  "$t => $i"
}
$i = $js.IndexOf('Reset Graph State')
if ($i -ge 0) { $s=[Math]::Max(0,$i-4000); $js.Substring($s, 5500) -replace '\\s+',' ' }
