# Build a runtime-only release archive for the Tony's Tools CEP panel.
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File package.ps1
# The archive is written to dist\Tony-Tools-<version>.zip and contains a
# top-level Tony-Tools folder holding only what CEP needs at runtime.

[CmdletBinding()]
param(
    [string]$OutputDirectory = 'dist'
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$manifestPath = Join-Path $root 'CSXS/manifest.xml'
if (-not (Test-Path $manifestPath)) {
    throw "Missing CSXS/manifest.xml - package.ps1 must stay at the repository root."
}

[xml]$manifest = Get-Content $manifestPath -Raw
$version = [string]$manifest.ExtensionManifest.ExtensionBundleVersion
if (-not $version) { $version = [string]$manifest.ExtensionManifest.ExtensionList.Extension.Version }
if (-not $version) { $version = '0.0.0' }
$version = $version -replace '[^0-9A-Za-z\.\-]', '_'

if (-not [System.IO.Path]::IsPathRooted($OutputDirectory)) {
    $OutputDirectory = Join-Path $root $OutputDirectory
}
$packageName = 'Tony-Tools'
$zipPath = Join-Path $OutputDirectory ("{0}-{1}.zip" -f $packageName, $version)

# Allowlist: only these paths are copied. Everything else at the root
# (README, check/package scripts, ref-* dumps, .debug, .git, dist) stays out.
$runtimeDirectories = @('CSXS', 'css', 'js', 'jsx')
$runtimeFiles = @('index.html')

$stageRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('tony-tools-package-' + [guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $stageRoot $packageName
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
try {
    foreach ($dir in $runtimeDirectories) {
        $source = Join-Path $root $dir
        if (-not (Test-Path $source)) { throw "Missing runtime directory: $dir" }
        Copy-Item -LiteralPath $source -Destination $packageRoot -Recurse -Force
    }
    foreach ($file in $runtimeFiles) {
        $source = Join-Path $root $file
        if (-not (Test-Path $source)) { throw "Missing runtime file: $file" }
        Copy-Item -LiteralPath $source -Destination $packageRoot -Force
    }
    $license = Join-Path $root 'LICENSE'
    if (Test-Path $license) { Copy-Item -LiteralPath $license -Destination $packageRoot -Force }

    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem -LiteralPath $stageRoot -Recurse -File | ForEach-Object {
            $entryName = $_.FullName.Substring($stageRoot.Length).TrimStart([char]92, [char]47).Replace([char]92, [char]47)
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    if (Test-Path $stageRoot) { Remove-Item $stageRoot -Recurse -Force }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName })
}
finally {
    $archive.Dispose()
}

$required = @(
    "$packageName/CSXS/manifest.xml",
    "$packageName/index.html",
    "$packageName/css/styles.css",
    "$packageName/js/CSInterface.js",
    "$packageName/js/main.js",
    "$packageName/jsx/host.jsx"
)
foreach ($entry in $required) {
    if ($entries -notcontains $entry) { throw "Archive is missing $entry" }
}

$forbidden = @($entries | Where-Object {
    $_ -match '(^|/)(README\.md|check\.ps1|package\.ps1|\.debug|dist)(/|$)' -or
    $_ -match '(^|/)ref-[^/]*$'
})
if ($forbidden.Count -gt 0) {
    throw ("Archive contains non-runtime files: " + ($forbidden -join ', '))
}

$sizeKb = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1KB, 1)
Write-Output ("Created {0}" -f $zipPath)
Write-Output ("Version: {0}" -f $version)
Write-Output ("Entries: {0} ({1} KB)" -f $entries.Count, $sizeKb)
$entries | Sort-Object | ForEach-Object { Write-Output ("  " + $_) }
