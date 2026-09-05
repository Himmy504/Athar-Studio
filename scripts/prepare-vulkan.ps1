$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskCache = Join-Path $taskRoot '.runtime-cache'
$taskDest = Join-Path $taskRoot 'src-tauri\resources\runtime\vulkan'
if (Test-Path -LiteralPath (Join-Path $taskDest 'whisper-cli.exe')) { Write-Output 'Vulkan runtime is already built.'; exit 0 }
New-Item -ItemType Directory -Force -Path $taskCache,$taskDest | Out-Null
$taskSource = Join-Path $taskCache 'whisper-source'
if (!(Test-Path -LiteralPath (Join-Path $taskSource 'CMakeLists.txt'))) {
  git clone --depth 1 --branch b4938 https://github.com/ggml-org/whisper.cpp.git $taskSource
  if ($LASTEXITCODE -ne 0) { throw 'whisper.cpp checkout failed' }
}
$taskSdk = $env:VULKAN_SDK
if (!$taskSdk) { $taskSdk = Join-Path $taskCache 'vulkan-sdk' }
if (!(Test-Path -LiteralPath (Join-Path $taskSdk 'Bin\glslc.exe')) -or !(Test-Path -LiteralPath (Join-Path $taskSdk 'Include\vulkan\vulkan.h'))) {
  if ($env:VULKAN_SDK) { throw 'VULKAN_SDK does not contain a complete SDK.' }
  node (Join-Path $PSScriptRoot 'fetch-sdk.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Portable Vulkan SDK preparation failed' }
}
$taskVsWhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
$taskVs = & $taskVsWhere -latest -products '*' -property installationPath
if (!$taskVs) { throw 'Visual Studio C++ build tools are required to build the Vulkan runtime.' }
$taskCmake = Join-Path $taskVs 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
$taskNinja = Join-Path $taskVs 'Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe'
$taskBuild = Join-Path $taskCache 'whisper-vulkan-build'
$taskBatch = Join-Path $taskCache 'build-vulkan.cmd'
$taskCommands = @(
  '@echo off',
  ('call "' + (Join-Path $taskVs 'VC\Auxiliary\Build\vcvars64.bat') + '"'),
  ('set "VULKAN_SDK=' + $taskSdk + '"'),
  ('"' + $taskCmake + '" -S "' + $taskSource + '" -B "' + $taskBuild + '" -G Ninja -DCMAKE_MAKE_PROGRAM="' + $taskNinja + '" -DCMAKE_BUILD_TYPE=Release -DGGML_VULKAN=ON -DGGML_NATIVE=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF -DBUILD_SHARED_LIBS=OFF'),
  'if errorlevel 1 exit /b 1',
  ('"' + $taskCmake + '" --build "' + $taskBuild + '" --target whisper-cli -j 4'),
  'exit /b %errorlevel%'
)
[IO.File]::WriteAllLines($taskBatch, $taskCommands, [Text.Encoding]::ASCII)
& $taskBatch
if ($LASTEXITCODE -ne 0) { throw 'Vulkan compilation failed' }
Get-ChildItem -LiteralPath (Join-Path $taskBuild 'bin') -File | Where-Object { $_.Extension -in @('.exe','.dll') } | Copy-Item -Destination $taskDest -Force
Write-Output 'Vulkan runtime built successfully.'
