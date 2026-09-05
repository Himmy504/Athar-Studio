$ErrorActionPreference = 'Stop'
$taskPreviousConfig = $env:TAURI_CONFIG
try {
  # Unit tests do not launch media executables. Exclude packaging-only resources
  # so this command also works in a fresh source checkout without downloaded runtimes.
  $env:TAURI_CONFIG = '{"bundle":{"resources":[]}}'
  cargo test --locked --manifest-path (Join-Path $PSScriptRoot '..\src-tauri\Cargo.toml') --lib
  if ($LASTEXITCODE -ne 0) { throw 'Native unit tests failed.' }
} finally {
  if ($null -eq $taskPreviousConfig) { Remove-Item Env:TAURI_CONFIG -ErrorAction SilentlyContinue }
  else { $env:TAURI_CONFIG = $taskPreviousConfig }
}
