$js = Get-Content 'ref-bundle.js' -Raw
"LEN=$($js.Length)"
"HEAD:"
$js.Substring(0, 400)
"---GREP terms---"
$terms = @('Select All','Deselect','Shy','Solo','Unlock','Parent','Pre-compose','Keyframe','Duplicate','Reverse','Nudge','Trim','Split','caption','Twixtor','easing','marker','beat')
foreach ($t in $terms) {
  $c = ([regex]::Matches($js, [regex]::Escape($t))).Count
  "$t => $c"
}
