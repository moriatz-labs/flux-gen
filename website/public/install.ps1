$ErrorActionPreference = "Stop"
$repo = "moriatz-labs/flux-gen"
$architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
if ($architecture -ne "x64") { throw "Flux currently supports Windows x64; detected $architecture." }

$asset = "flux-windows-x64.exe"
$base = "https://github.com/$repo/releases/latest/download"
$temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("flux-install-" + [guid]::NewGuid().ToString("N"))
$installDirectory = if ($env:FLUX_INSTALL_DIR) { $env:FLUX_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "FluxGen\bin" }

try {
  New-Item -ItemType Directory -Path $temporary | Out-Null
  Invoke-WebRequest "$base/$asset" -OutFile (Join-Path $temporary $asset)
  Invoke-WebRequest "$base/checksums.txt" -OutFile (Join-Path $temporary "checksums.txt")
  $checksumLine = Get-Content -LiteralPath (Join-Path $temporary "checksums.txt") | Where-Object { $_ -match "\s+$([regex]::Escape($asset))$" } | Select-Object -First 1
  if (-not $checksumLine) { throw "No checksum published for $asset." }
  $expected = ($checksumLine -split "\s+")[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $temporary $asset)).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "Flux checksum verification failed." }

  New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $temporary $asset) -Destination (Join-Path $installDirectory "flux.exe") -Force
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @($userPath -split ";" | Where-Object { $_ })
  if ($parts -notcontains $installDirectory) {
    [Environment]::SetEnvironmentVariable("Path", (($parts + $installDirectory) -join ";"), "User")
    Write-Host "Added $installDirectory to PATH. Open a new terminal to use flux."
  }
  Write-Host "Flux installed at $(Join-Path $installDirectory 'flux.exe')"
} finally {
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
