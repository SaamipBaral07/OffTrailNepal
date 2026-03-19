# Git push script for OffTrail-Nepal
$repoPath = "c:\Users\samip\OneDrive\Desktop\OffTrail-Nepal"
Set-Location $repoPath

Write-Host "=== Configuring Git ===" -ForegroundColor Cyan
git config core.safecrlf false
git config core.autocrlf true

Write-Host "`n=== Current Branch ===" -ForegroundColor Cyan
git branch -vv

Write-Host "`n=== Checking Status ===" -ForegroundColor Cyan
$status = git status --porcelain
$statusLines = ($status | Measure-Object -Line).Lines
Write-Host "Total changes: $statusLines lines"
Write-Host "First 10 changes:"
$status | Select-Object -First 10

Write-Host "`n=== Staging changes ===" -ForegroundColor Cyan
git add -A
Write-Host "Staging complete"

Write-Host "`n=== Creating commit ===" -ForegroundColor Cyan
git commit -m "feat: Add OffTrail-Nepal development code to Increment1/03_Development

- Backend code in Increment1/03_Development/backend
- Frontend code in Increment1/03_Development/frontend
- Security documentation at root level"

Write-Host "`n=== Recent commits ===" -ForegroundColor Cyan
git log --oneline -3

Write-Host "`n=== Pushing to remote ===" -ForegroundColor Cyan
git push origin Increment1 -v

Write-Host "`n=== Push complete ===" -ForegroundColor Green
