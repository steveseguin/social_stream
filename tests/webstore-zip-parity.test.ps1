param(
    [string]$ExtensionRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ZipPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$checkoutRootPath = (Resolve-Path -LiteralPath $ExtensionRoot).Path
$manifest = Get-Content -Raw -LiteralPath (Join-Path $checkoutRootPath 'manifest.json') | ConvertFrom-Json
if (!$ZipPath) {
    $ZipPath = Join-Path (Split-Path -Parent $checkoutRootPath) "social-stream-ninja-chrome-web-store-$($manifest.version).zip"
}
$expectedFiles = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'fixtures\webstore-package-files.json') | ConvertFrom-Json
$expectedSet = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($relativeFile in $expectedFiles) { [void]$expectedSet.Add($relativeFile) }
$seenSet = New-Object 'System.Collections.Generic.HashSet[string]'
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ZipPath).Path)
try {
    foreach ($entry in $archive.Entries) {
        $relativeFile = $entry.FullName.Replace('\', '/')
        if (!$expectedSet.Contains($relativeFile)) { throw "Unreviewed ZIP file: $relativeFile" }
        if (!$seenSet.Add($relativeFile)) { throw "Duplicate ZIP file: $relativeFile" }
        $checkoutFilePath = [System.IO.Path]::GetFullPath((Join-Path $checkoutRootPath $relativeFile))
        if (!$checkoutFilePath.StartsWith($checkoutRootPath + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Package path escaped checkout' }
        $entryStream = $entry.Open()
        $checkoutStream = [System.IO.File]::OpenRead($checkoutFilePath)
        $hash = [System.Security.Cryptography.SHA256]::Create()
        try {
            $archiveDigest = [System.BitConverter]::ToString($hash.ComputeHash($entryStream))
            $checkoutDigest = [System.BitConverter]::ToString($hash.ComputeHash($checkoutStream))
            if ($archiveDigest -ne $checkoutDigest) { throw "ZIP does not match checkout: $relativeFile" }
        } finally {
            $hash.Dispose()
            $entryStream.Dispose()
            $checkoutStream.Dispose()
        }
    }
    if ($seenSet.Count -ne $expectedSet.Count) { throw 'ZIP is missing reviewed package files' }
} finally { $archive.Dispose() }
Write-Output "ZIP parity passed: version $($manifest.version), $($seenSet.Count) files match $checkoutRootPath."
