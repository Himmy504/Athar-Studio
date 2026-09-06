param([ValidateRange(1024,65535)][int]$Port = 1420, [string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskOutput = Join-Path $taskRoot 'test-results'
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
$taskPreviousUrl = $env:ATHAR_QA_URL
$taskServer = $null
Push-Location $taskRoot
try {
  & $Python scripts/prepare-qa.py
  if ($LASTEXITCODE -ne 0) { throw 'Test audio preparation failed.' }
  $env:ATHAR_QA_URL = "http://127.0.0.1:$Port/"
  $taskServer = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$Port",'--strictPort') -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskOutput 'vite-qa.log') -RedirectStandardError (Join-Path $taskOutput 'vite-qa-error.log')
  $taskReady = $false
  for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    Start-Sleep -Milliseconds 500
    if ($taskServer.HasExited) { throw 'The QA server exited. Check test-results/vite-qa-error.log, or use a different -Port.' }
    try {
      $taskResponse = Invoke-WebRequest -Uri $env:ATHAR_QA_URL -UseBasicParsing -TimeoutSec 2
      if ($taskResponse.StatusCode -eq 200) { $taskReady = $true; break }
    } catch { }
  }
  if (!$taskReady) { throw 'The QA server did not become ready.' }
  foreach ($taskScript in @('browser-qa.py','ui-review.py','review-tools-qa.py')) {
    & $Python (Join-Path $PSScriptRoot $taskScript)
    if ($LASTEXITCODE -ne 0) { throw "$taskScript failed." }
  }
} finally {
  if ($taskServer -and !$taskServer.HasExited) { Stop-Process -Id $taskServer.Id -ErrorAction SilentlyContinue }
  if ($null -eq $taskPreviousUrl) { Remove-Item Env:ATHAR_QA_URL -ErrorAction SilentlyContinue }
  else { $env:ATHAR_QA_URL = $taskPreviousUrl }
  Pop-Location
}
