$ErrorActionPreference = "Stop"
$repo = "moriatz-labs/flux-gen"
if (-not [Environment]::Is64BitOperatingSystem) { throw "Flux currently supports 64-bit Windows only." }

$asset = "flux-windows-x64.exe"
$base = "https://github.com/$repo/releases/latest/download"
$temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("flux-install-" + [guid]::NewGuid().ToString("N"))
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
if ([string]::IsNullOrWhiteSpace($localAppData)) { throw "Flux could not find the local application-data directory." }
$installDirectory = if ($env:FLUX_INSTALL_DIR) { $env:FLUX_INSTALL_DIR } else { Join-Path $localAppData "FluxGen\bin" }
$previousProgressPreference = $ProgressPreference

try {
  $ProgressPreference = "SilentlyContinue"
  New-Item -ItemType Directory -Path $temporary | Out-Null
  Write-Host "Downloading Flux for Windows..."
  Invoke-WebRequest "$base/$asset" -OutFile (Join-Path $temporary $asset)
  Invoke-WebRequest "$base/checksums.txt" -OutFile (Join-Path $temporary "checksums.txt")
  Write-Host "Verifying download..."
  $checksumLine = Get-Content -LiteralPath (Join-Path $temporary "checksums.txt") | Where-Object { $_ -match "\s+$([regex]::Escape($asset))$" } | Select-Object -First 1
  if (-not $checksumLine) { throw "No checksum published for $asset." }
  $checksumParts = @($checksumLine -split "\s+" | Where-Object { $_ })
  if ($checksumParts.Count -lt 2) { throw "The published checksum for $asset is malformed." }
  $expected = ([string]$checksumParts[0]).ToLowerInvariant()
  $fileHash = Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $temporary $asset)
  if ($null -eq $fileHash -or [string]::IsNullOrWhiteSpace($fileHash.Hash)) { throw "Flux could not calculate the downloaded checksum." }
  $actual = ([string]$fileHash.Hash).ToLowerInvariant()
  if ($actual -ne $expected) { throw "Flux checksum verification failed." }

  Write-Host "Installing Flux..."
  New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $temporary $asset) -Destination (Join-Path $installDirectory "flux.exe") -Force
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = if ([string]::IsNullOrWhiteSpace($userPath)) { @() } else { @($userPath -split ";" | Where-Object { $_ }) }
  if ($parts -notcontains $installDirectory) {
    [Environment]::SetEnvironmentVariable("Path", (($parts + $installDirectory) -join ";"), "User")
    Write-Host "Added $installDirectory to PATH. Open a new terminal to use flux."
  }
  Write-Host "Flux installed at $(Join-Path $installDirectory 'flux.exe')"
} finally {
  $ProgressPreference = $previousProgressPreference
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
