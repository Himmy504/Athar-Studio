import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean))];
const errors = [];
const forbidden = /(^|\/)(node_modules|dist|test-results|\.runtime-cache|\.venv|__pycache__)(\/|$)|^src-tauri\/(target|gen|resources)\/|^public\/(fonts|libass|notices)\/|(^|\/)\.env($|\.(?!example$))|\.(athar(?:\.bak)?|pem|key|p12|pfx|exe|dll|msi|zip|7z|bin|gguf|safetensors|mp3|wav|m4a|mp4|mov|mkv|srt|ass)$/i;
const secretPatterns = [/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, /\bgithub_pat_[A-Za-z0-9_]{60,}\b/, /\bAKIA[0-9A-Z]{16}\b/, /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/];
let bytes = 0;
for (const file of files) {
  if (!existsSync(file)) continue; // Ignore tracked files removed from the working tree.
  if (forbidden.test(file)) errors.push(`${file}: generated, private, or binary runtime file`);
  const stat = statSync(file);
  bytes += stat.size;
  if (stat.size > 10 * 1024 * 1024) errors.push(`${file}: exceeds the repository's 10 MiB per-file limit`);
  if (/\.(png|ico|icns|woff2|ttf)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (secretPatterns.some(pattern => pattern.test(content))) errors.push(`${file}: possible credential; inspect locally`);
  if (/[A-Z]:[/\\](?:Users|RealAtharStudio)[/\\]/i.test(content)) errors.push(`${file}: developer-specific absolute path`);
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const tauri = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8').match(/^version = "([^"]+)"/m)?.[1];
const cargoLock = readFileSync('src-tauri/Cargo.lock', 'utf8').match(/\[\[package\]\]\r?\nname = "athar-studio"\r?\nversion = "([^"]+)"/)?.[1];
if (![lock.version, lock.packages[''].version, tauri.version, cargo, cargoLock].every(version => version === pkg.version)) errors.push('Application version fields disagree');
if (pkg.license !== 'MIT' || !readFileSync('LICENSE', 'utf8').startsWith('MIT License')) errors.push('MIT license metadata is missing');
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`Repository check passed: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB; versions and basic credential checks passed.`);
}
