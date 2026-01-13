#!/usr/bin/env pwsh
# Fix NextAuth route conflicts by removing custom auth endpoints

Write-Host "🔧 NextAuth Route Conflict Fix" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$authDir = "apps/web/app/api/auth"

# Directories to remove (conflicting with NextAuth)
$dirsToRemove = @(
    "$authDir/login",
    "$authDir/register",
    "$authDir/signin",
    "$authDir/logout",
    "$authDir/me",
    "$authDir/session-leg"
)

Write-Host "📋 The following directories will be deleted:" -ForegroundColor Yellow
foreach ($dir in $dirsToRemove) {
    if (Test-Path $dir) {
        Write-Host "  ❌ $dir" -ForegroundColor Red
    } else {
        Write-Host "  ⚠️  $dir (not found)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "📁 These will be kept:" -ForegroundColor Green
Write-Host "  ✅ $authDir/[...nextauth]/ (NextAuth handler)" -ForegroundColor Green
Write-Host "  ✅ $authDir/test/ (Test endpoint)" -ForegroundColor Green

Write-Host ""
$response = Read-Host "Continue with deletion? (y/N)"

if ($response -ne "y" -and $response -ne "Y") {
    Write-Host "❌ Cancelled" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🗑️  Removing conflicting routes..." -ForegroundColor Yellow

$removed = 0
foreach ($dir in $dirsToRemove) {
    if (Test-Path $dir) {
        Remove-Item -Recurse -Force $dir
        Write-Host "  ✅ Removed: $dir" -ForegroundColor Green
        $removed++
    }
}

Write-Host ""
if ($removed -gt 0) {
    Write-Host "✅ Successfully removed $removed conflicting routes" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Rebuild web container: docker compose build web" -ForegroundColor White
    Write-Host "  2. Restart services: docker compose restart web nginx" -ForegroundColor White
    Write-Host "  3. Test: https://app.frigate.ai/api/auth/error" -ForegroundColor White
} else {
    Write-Host "ℹ️  No files were removed (already clean)" -ForegroundColor Blue
}

Write-Host ""
