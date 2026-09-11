param([switch]$SkipGpu)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskCache = Join-Path $taskRoot '.runtime-cache'
$taskRuntime = Join-Path $taskRoot 'src-tauri\resources\runtime'
New-Item -ItemType Directory -Force -Path $taskCache,(Join-Path $taskRuntime 'cpu'),(Join-Path $taskRuntime 'ffmpeg') | Out-Null
$taskArchive = Join-Path $taskCache 'whisper-b4938-x64.zip'
if (!(Test-Path -LiteralPath $taskArchive)) {
  Write-Output 'Downloading official whisper.cpp CPU runtime...'
  Invoke-WebRequest 'https://github.com/ggml-org/whisper.cpp/releases/download/b4938/whisper-bin-x64.zip' -OutFile $taskArchive
}
if ((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'c2a4b60edb11f7e11a9191ffb50929535527d4d91c9903dbe3e554583bbbc63d') { throw 'whisper.cpp archive checksum mismatch' }
$taskExtract = Join-Path $taskCache 'whisper-cpu'
Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskExtract -Force
$taskWhisper = Get-ChildItem -LiteralPath $taskExtract -Recurse -Filter whisper-cli.exe | Select-Object -First 1
if (!$taskWhisper) { throw 'whisper-cli.exe was not found in official archive' }
Get-ChildItem -LiteralPath $taskWhisper.DirectoryName -File | Where-Object { $_.Name -eq 'whisper-cli.exe' -or $_.Name -eq 'whisper.dll' -or $_.Name -like 'ggml*.dll' } | Copy-Item -Destination (Join-Path $taskRuntime 'cpu') -Force
$taskFfmpeg = @(
  'C:\ProgramData\chocolatey\lib\ffmpeg-full\tools\ffmpeg\bin',
  'C:\ProgramData\chocolatey\lib\ffmpeg\tools\ffmpeg\bin'
) | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'ffmpeg.exe') } | Select-Object -First 1
if (!$taskFfmpeg) {
  $taskFound = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
  if ($taskFound) { $taskFfmpeg = Split-Path $taskFound.Source }
}
if (!$taskFfmpeg -or !(Test-Path -LiteralPath (Join-Path $taskFfmpeg 'ffprobe.exe'))) { throw 'Install an FFmpeg build with libass and libx264, then rerun this script.' }
foreach ($taskName in @('ffmpeg.exe','ffprobe.exe')) { Copy-Item -LiteralPath (Join-Path $taskFfmpeg $taskName) -Destination (Join-Path $taskRuntime 'ffmpeg') -Force }
Write-Output 'CPU transcription and FFmpeg runtimes are ready.'
if (!$SkipGpu) {
  & (Join-Path $PSScriptRoot 'prepare-vulkan.ps1')
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'Vulkan runtime build failed' }
}
$taskVsWhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
if (Test-Path -LiteralPath $taskVsWhere) {
  $taskVs = & $taskVsWhere -latest -products '*' -property installationPath
  $taskCrt = Get-ChildItem -LiteralPath (Join-Path $taskVs 'VC\Redist\MSVC') -Recurse -Filter vcruntime140.dll | Where-Object { $_.FullName -match '\\x64\\Microsoft\.VC\d+\.CRT\\' -and $_.FullName -notmatch '\\onecore\\' } | Select-Object -Last 1
  if ($taskCrt) {
    foreach ($taskBackend in @('cpu','vulkan')) {
      $taskBackendDir = Join-Path $taskRuntime $taskBackend
      if (Test-Path -LiteralPath $taskBackendDir) { Get-ChildItem -LiteralPath $taskCrt.DirectoryName -Filter '*.dll' | Copy-Item -Destination $taskBackendDir -Force }
    }
  }
}
$taskNotices = Join-Path $taskRuntime 'notices'
New-Item -ItemType Directory -Force -Path $taskNotices | Out-Null
$taskFfmpegLicense = Join-Path (Split-Path $taskFfmpeg) 'LICENSE'
if (Test-Path -LiteralPath $taskFfmpegLicense) { Copy-Item -LiteralPath $taskFfmpegLicense -Destination (Join-Path $taskNotices 'FFmpeg-LICENSE.txt') -Force }
$taskWhisperLicense = Join-Path $taskCache 'whisper-source\LICENSE'
if (Test-Path -LiteralPath $taskWhisperLicense) { Copy-Item -LiteralPath $taskWhisperLicense -Destination (Join-Path $taskNotices 'whisper.cpp-LICENSE.txt') -Force }
$taskManifest = Get-ChildItem -LiteralPath $taskRuntime -Recurse -File | Where-Object { $_.Extension -in @('.exe','.dll') } | ForEach-Object {
  [PSCustomObject]@{ path = $_.FullName.Substring($taskRuntime.Length + 1); bytes = $_.Length; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
}
[IO.File]::WriteAllText((Join-Path $taskRuntime 'manifest.json'), ($taskManifest | ConvertTo-Json -Depth 3))
Write-Output 'Runtime manifest and third-party notices prepared.'
