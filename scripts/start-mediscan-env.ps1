# MediScan AI — Environment Setup Script
# Session-only environment configuration for local development and cache isolation.

$MediScanRoot = Split-Path $PSScriptRoot -Parent
$MediScanCache = Join-Path $MediScanRoot "Cache"

$NewNpmCache = Join-Path $MediScanCache "node\npm-cache"
$TempDir = Join-Path $MediScanCache "temp"
$LogDir = Join-Path $MediScanCache "logs"

New-Item -ItemType Directory -Force -Path $NewNpmCache | Out-Null
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Set session-scoped environment variables
$env:npm_config_cache = $NewNpmCache
$env:TEMP = $TempDir
$env:TMP = $TempDir

Write-Host "MediScan AI Environment Initialized Successfully."
Write-Host "Project Root: $MediScanRoot"
Write-Host "NPM Cache:    $env:npm_config_cache"
Write-Host "Temp Dir:     $env:TEMP"
