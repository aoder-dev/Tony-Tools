$js = Get-Content 'ref-bundle.js' -Raw
# Dump the actual panel component: from 'SYSTEM // ONLINE' first panel occurrence onward
$i = $js.IndexOf('SYSTEM // ONLINE')
"IDX: $i"
# find the section that renders the CEP panel: search for 'Read values from AE' second occurrence (Graph editor in panel?) Actually dump after KF Assistant index 787246 to 'Auto Pre-Compose' index 775970 - panel is around 770000-830000?
$idx2 = $js.IndexOf('Copy Activation Code')
"IDX CopyAct: $idx2"
# Dump from 740000 to 746000
$js.Substring(739000, 6000) -replace '\\s+',' '
