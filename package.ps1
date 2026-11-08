# Build a runtime-only release archive for the Tony's Tools CEP panel.
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File package.ps1
# With a signing certificate, build a signed .zxp instead:
#   powershell -ExecutionPolicy Bypass -File package.ps1 -Sign -CertificatePath .\cert.p12 -CertificatePassword '<password>'
# The zip is written to dist\Tony-Tools-<version>.zip and contains a top-level
# Tony-Tools folder holding only what CEP needs at runtime. With -Sign, the
# output is dist\Tony-Tools-<version>.zxp, signed by Adobe's ZXPSignCmd.

[CmdletBinding()]
param(
    [string]$OutputDirectory = 'dist',
    [switch]$Sign,
    [string]$CertificatePath,
    [string]$CertificatePassword,
    [string]$ZXPSignCmdPath,
    [string]$TimestampUrl
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
$extension = if ($Sign) { 'zxp' } else { 'zip' }
$packagePath = Join-Path $OutputDirectory ("{0}-{1}.{2}" -f $packageName, $version, $extension)

# ZXPSignCmd is not bundled. Prefer an explicit path, then ZXPSIGNCMD_PATH,
# then a copy on PATH.
$signTool = $null
if ($Sign) {
    if (-not $CertificatePath) { throw "-Sign requires -CertificatePath (a .p12 signing certificate)." }
    if (-not (Test-Path -LiteralPath $CertificatePath)) { throw "Certificate not found: $CertificatePath" }
    if (-not $CertificatePassword) { throw "-Sign requires -CertificatePassword (the .p12 password)." }
    $CertificatePath = (Resolve-Path -LiteralPath $CertificatePath).Path

    if ($ZXPSignCmdPath) {
        if (-not (Test-Path -LiteralPath $ZXPSignCmdPath)) { throw "ZXPSignCmd not found: $ZXPSignCmdPath" }
        $signTool = (Resolve-Path -LiteralPath $ZXPSignCmdPath).Path
    }
    elseif ($env:ZXPSIGNCMD_PATH) {
        if (-not (Test-Path -LiteralPath $env:ZXPSIGNCMD_PATH)) {
            throw "ZXPSIGNCMD_PATH points to a missing file: $env:ZXPSIGNCMD_PATH"
        }
        $signTool = (Resolve-Path -LiteralPath $env:ZXPSIGNCMD_PATH).Path
    }
    else {
        $command = Get-Command ZXPSignCmd.exe -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($command) { $signTool = $command.Source }
    }
    if (-not $signTool) {
        throw "ZXPSignCmd.exe was not found. Pass -ZXPSignCmdPath, set ZXPSIGNCMD_PATH, or add it to PATH. Download it from https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD."
    }
}

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

    # Paths relative to the extension root, which is also what ZXPSignCmd
    # writes into the .zxp.
    $payloadEntries = @(Get-ChildItem -LiteralPath $packageRoot -Recurse -File | ForEach-Object {
        $_.FullName.Substring($packageRoot.Length).TrimStart([char]92, [char]47).Replace([char]92, [char]47)
    })

    $requiredPayload = @(
        'CSXS/manifest.xml',
        'index.html',
        'css/styles.css',
        'js/CSInterface.js',
        'js/main.js',
        'jsx/host.jsx'
    )
    foreach ($entry in $requiredPayload) {
        if ($payloadEntries -notcontains $entry) { throw "Payload is missing $entry" }
    }

    $forbidden = @($payloadEntries | Where-Object {
        $_ -match '(^|/)(README\.md|check\.ps1|package\.ps1|\.debug|dist)(/|$)' -or
        $_ -match '(^|/)ref-[^/]*$'
    })
    if ($forbidden.Count -gt 0) {
        throw ("Payload contains non-runtime files: " + ($forbidden -join ', '))
    }

    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
    if (Test-Path $packagePath) { Remove-Item $packagePath -Force }

    if ($Sign) {
        # ZXPSignCmd packs the contents of the input folder at the root of the
        # .zxp, so the extension is installed without an extra folder level.
        $signArgs = @('-sign', $packageRoot, $packagePath, $CertificatePath, $CertificatePassword)
        if ($TimestampUrl) { $signArgs += @('-tsa', $TimestampUrl) }
        & $signTool @signArgs
        if ($LASTEXITCODE -ne 0) { throw "ZXPSignCmd failed with exit code $LASTEXITCODE" }

        & $signTool -verify $packagePath
        if ($LASTEXITCODE -ne 0) { throw "ZXPSignCmd could not verify the signed package (exit code $LASTEXITCODE)" }

        $sizeKb = [math]::Round((Get-Item -LiteralPath $packagePath).Length / 1KB, 1)
        Write-Output ("Created {0}" -f $packagePath)
        Write-Output (("Version: {0}" -f $version))
        if ($TimestampUrl) { Write-Output ("Timestamp: {0}" -f $TimestampUrl) }
        Write-Output ("Signed entries: {0} ({1} KB)" -f $payloadEntries.Count, $sizeKb)
        $payloadEntries | Sort-Object | ForEach-Object { Write-Output ("  " + $_) }
    }
    else {
        Add-Type -AssemblyName System.IO.Compression
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [System.IO.Compression.ZipFile]::Open($packagePath, [System.IO.Compression.ZipArchiveMode]::Create)
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

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [System.IO.Compression.ZipFile]::OpenRead($packagePath)
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

        $sizeKb = [math]::Round((Get-Item -LiteralPath $packagePath).Length / 1KB, 1)
        Write-Output ("Created {0}" -f $packagePath)
        Write-Output ("Version: {0}" -f $version)
        Write-Output ("Entries: {0} ({1} KB)" -f $entries.Count, $sizeKb)
        $entries | Sort-Object | ForEach-Object { Write-Output ("  " + $_) }
    }
}
finally {
    if (Test-Path $stageRoot) { Remove-Item $stageRoot -Recurse -Force }
}
