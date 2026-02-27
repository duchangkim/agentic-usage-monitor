#Requires -Version 5.1
# Agentic Usage Monitor installer for Windows
# Usage: irm https://raw.githubusercontent.com/duchangkim/agentic-usage-monitor/main/install.ps1 | iex
$ErrorActionPreference = "Stop"

$REPO = "duchangkim/agentic-usage-monitor"
$BINARY_NAME = "usage-monitor"
$DEFAULT_INSTALL_DIR = Join-Path $env:LOCALAPPDATA $BINARY_NAME
$INSTALL_DIR = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { $DEFAULT_INSTALL_DIR }

function Write-Info($msg)  { Write-Host "  > $msg" -ForegroundColor Blue }
function Write-Warn($msg)  { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "  x $msg" -ForegroundColor Red }

function Get-Platform {
    $arch = if ([Environment]::Is64BitOperatingSystem) {
        if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
    } else {
        Write-Err "32-bit Windows is not supported"
        exit 1
    }
    return "windows-$arch"
}

function Get-LatestVersion {
    $url = "https://api.github.com/repos/$REPO/releases/latest"
    try {
        $response = Invoke-RestMethod -Uri $url -UseBasicParsing
        return $response.tag_name
    } catch {
        Write-Err "Failed to determine latest version: $_"
        exit 1
    }
}

function Install-Binary {
    param(
        [string]$Platform,
        [string]$Version
    )

    $suffix = "$Platform.exe"
    $downloadUrl = "https://github.com/$REPO/releases/download/$Version/$BINARY_NAME-$suffix"
    $checksumUrl = "https://github.com/$REPO/releases/download/$Version/checksums.txt"

    $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "usage-monitor-install-$(Get-Random)"
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    $tmpFile = Join-Path $tmpDir "$BINARY_NAME.exe"

    Write-Info "Downloading $BINARY_NAME $Version for $Platform..."

    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpFile -UseBasicParsing
    } catch {
        Write-Err "Download failed: $_"
        Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
        exit 1
    }

    # Verify checksum
    try {
        $checksumText = (Invoke-WebRequest -Uri $checksumUrl -UseBasicParsing).Content
        $expectedLine = ($checksumText -split "`n") | Where-Object { $_.Trim().EndsWith("$BINARY_NAME-$suffix") }
        if ($expectedLine) {
            $expectedHash = ($expectedLine.Trim() -split '\s+')[0]
            $actualHash = (Get-FileHash -Path $tmpFile -Algorithm SHA256).Hash.ToLower()
            if ($expectedHash -ne $actualHash) {
                Write-Err "Checksum verification failed!"
                Write-Err "  Expected: $expectedHash"
                Write-Err "  Actual:   $actualHash"
                Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
                exit 1
            }
            Write-Info "Checksum verified"
        }
    } catch {
        Write-Warn "Could not verify checksum (non-fatal)"
    }

    # Install
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
    }

    $destPath = Join-Path $INSTALL_DIR "$BINARY_NAME.exe"
    Move-Item -Force $tmpFile $destPath
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue

    Write-Info "Installed to $destPath"
    return $destPath
}

function Add-ToPath {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -split ";" | Where-Object { $_ -eq $INSTALL_DIR }) {
        return
    }

    Write-Info "Adding $INSTALL_DIR to user PATH..."
    [Environment]::SetEnvironmentVariable("Path", "$INSTALL_DIR;$currentPath", "User")
    $env:Path = "$INSTALL_DIR;$env:Path"
    Write-Info "PATH updated (restart your terminal for changes to take effect)"
}

function Main {
    Write-Host ""
    Write-Host "  Agentic Usage Monitor Installer"
    Write-Host ""

    $platform = Get-Platform
    $version = Get-LatestVersion
    Write-Info "Latest version: $version"

    $installed = Install-Binary -Platform $platform -Version $version
    Add-ToPath

    Write-Host ""
    Write-Info "Done! Run '$BINARY_NAME --help' to get started."
    Write-Host ""
}

Main
