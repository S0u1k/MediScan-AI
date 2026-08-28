# MediScan AI — Environment Setup Script
# Session-only environment configuration for local development and central cache integration.

$MediScanRoot = Split-Path $PSScriptRoot -Parent
$CentralCacheRoot = "D:\My Created Projects\Cache"

if (Test-Path $CentralCacheRoot) {
    $CacheRoot = $CentralCacheRoot
} else {
    $CacheRoot = Join-Path $MediScanRoot "Cache"
}

$NewNpmCache = Join-Path $CacheRoot "npm"
$TempDir = Join-Path $CacheRoot "temp"
$LogDir = Join-Path $CacheRoot "logs"

New-Item -ItemType Directory -Force -Path $NewNpmCache | Out-Null
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Set session-scoped environment variables
$env:npm_config_cache = $NewNpmCache
$env:TEMP = $TempDir
$env:TMP = $TempDir

Write-Host "MediScan AI Environment Initialized Successfully."
Write-Host "Project Root: $MediScanRoot"
Write-Host "Central Cache: $CacheRoot"
Write-Host "NPM Cache:    $env:npm_config_cache"
Write-Host "Temp Dir:     $env:TEMP"
