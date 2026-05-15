# start_all.ps1
# This script starts all 8 questionnaire servers in separate PowerShell windows.

$baseDir = "D:\firebase\sehatupfirebase-main\questionnaire\live"

# Live Servers
$liveServers = @(
    "live\mens-wellness",
    "live\womens-weight",
    "live\womens-wellness",
    "live\mens-weight"
)

# Testing Servers
$testingServers = @(
    "testing\mens-wellness",
    "testing\womens-weight",
    "testing\womens-wellness",
    "testing\mens-weight"
)

Write-Host "Starting Live Servers..." -ForegroundColor Cyan
foreach ($server in $liveServers) {
    $path = Join-Path $baseDir $server
    Write-Host "Starting $server in $path"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$path'; node server.js"
}

Write-Host "Starting Testing Servers..." -ForegroundColor Green
foreach ($server in $testingServers) {
    $path = Join-Path $baseDir $server
    Write-Host "Starting $server in $path"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$path'; node server.js"
}

Write-Host "All servers started! Check the individual windows for logs." -ForegroundColor Yellow
Write-Host "Live URLs:"
Write-Host "  mens-wellness: http://localhost:5000"
Write-Host "  womens-weight: http://localhost:5002"
Write-Host "  womens-wellness: http://localhost:5003"
Write-Host "  mens-weight: http://localhost:5005"
Write-Host ""
Write-Host "Testing URLs:"
Write-Host "  mens-wellness: http://localhost:5001"
Write-Host "  womens-weight: http://localhost:5004"
Write-Host "  womens-wellness: http://localhost:5006"
Write-Host "  mens-weight: http://localhost:5007"
