import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const base = path.join(root, '.beta-artifacts');
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not permitted in kit: ${entry.name}`);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
if (process.argv.includes('--check')) {
  const latest = json(path.join(base, 'latest.json'));
  if (!/^Athar-Studio-[\w.-]+$/.test(latest.directory)) throw new Error('Invalid kit directory');
  const kit = path.join(base, latest.directory);
  const manifest = json(path.join(kit, 'manifest.json'));
  for (const entry of manifest.files) {
    const file = path.resolve(kit, entry.path);
    if (!file.startsWith(kit + path.sep)) throw new Error('Invalid manifest path');
    if (!existsSync(file) || hash(file) !== entry.sha256) throw new Error(`Integrity failure: ${entry.path}`);
  }
  const actual = walk(kit).length;
  if (actual !== manifest.files.length + 1) throw new Error('Unexpected files in kit');
  console.log(`Integrity passed: ${manifest.files.length} files. Distribution status: ${manifest.status}.`);
  for (const blocker of manifest.blockers) console.log(`- ${blocker}`);
  process.exitCode = manifest.blockers.length ? 2 : 0;
} else {
  execFileSync(process.execPath, ['scripts/check-repository.mjs'], { stdio: 'inherit' });
  const installerName = `Athar Studio_${version}_x64-setup.exe`;
  const installer = path.join(root, 'src-tauri/target/release/bundle/nsis', installerName);
  if (!existsSync(installer)) throw new Error('Build the Windows installer first.');
  const checksumFile = `${installer}.sha256`;
  if (!existsSync(checksumFile) || readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0].toLowerCase() !== hash(installer)) {
    throw new Error('Installer does not match its recorded build checksum.');
  }
  const stamp = new Date().toISOString().replace(/[:]/g, '-');
  const directory = `Athar-Studio-${version}-beta-preparation-${stamp}`;
  const kit = path.join(base, directory);
  mkdirSync(kit, { recursive: true });
  function copy(source, relative) {
    const dest = path.join(kit, relative);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(source, dest);
  }
  function write(relative, content) {
    const dest = path.join(kit, relative);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
  }
  copy(installer, installerName);
  copy(checksumFile, `${installerName}.sha256`);
  write('SHA256SUMS.txt', `${hash(installer)}  ${installerName}\n`);
  for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) copy(file, file);
  for (const file of walk('docs/beta')) copy(file, path.join('guides', path.relative('docs/beta', file)));
  // Keep relative links from the root third-party notice usable in the kit.
  for (const file of walk('docs/beta')) copy(file, file);
  for (const dir of ['public/notices', 'src-tauri/resources/runtime/notices']) {
    for (const file of walk(dir)) copy(file, path.join('licenses', dir.startsWith('public') ? 'fonts' : 'runtime', path.relative(dir, file)));
  }
  copy('public/libass/COPYRIGHT', 'licenses/SubtitlesOctopus-COPYRIGHT');
  copy('src-tauri/resources/runtime/manifest.json', 'inventory/runtime-manifest.json');
  const runtime = 'src-tauri/resources/runtime';
  const ffmpeg = walk(runtime).find(file => path.basename(file) === 'ffmpeg.exe');
  if (!ffmpeg) throw new Error('Prepared FFmpeg is missing');
  write('inventory/ffmpeg-version.txt', execFileSync(ffmpeg, ['-version'], { encoding: 'utf8' }));
  const missing = [];
  function notices(dir, destination, name) {
    const files = readdirSync(dir).filter(file => /^(licen[cs]e|copying|notice|copyright)([._-]|$)/i.test(file) && statSync(path.join(dir, file)).isFile());
    for (const file of files) copy(path.join(dir, file), `${destination}/${file}`);
    if (!files.length) missing.push(name);
    return files;
  }
  const npm = [];
  for (const [location, dep] of Object.entries(json('package-lock.json').packages)) {
    if (!location || dep.dev) continue;
    const pkg = json(path.join(location, 'package.json'));
    const name = `${pkg.name}@${pkg.version}`;
    npm.push({ name: pkg.name, version: pkg.version, license: pkg.license ?? dep.license ?? null,
      repository: pkg.repository ?? null, integrity: dep.integrity ?? null,
      notices: notices(location, `licenses/npm/${name.replace(/[@/]/g, '_')}`, name) });
  }
  write('inventory/npm-production.json', npm);
  const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--manifest-path', 'src-tauri/Cargo.toml', '--offline', '--format-version', '1', '--filter-platform', 'x86_64-pc-windows-msvc'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
  const rust = metadata.packages.filter(pkg => pkg.source).map(pkg => ({ name: pkg.name, version: pkg.version,
    license: pkg.license, repository: pkg.repository, source: pkg.source,
    notices: notices(path.dirname(pkg.manifest_path), `licenses/rust/${pkg.name}-${pkg.version}`, `${pkg.name}@${pkg.version}`) }));
  write('inventory/rust-resolved-including-build-dependencies.json', rust);
  write('inventory/missing-notices.json', missing);
  const sourceFiles = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
  for (const file of sourceFiles.filter(existsSync)) copy(file, path.join('source/athar-studio', file));
  write('inventory/source-snapshot.json', { version, gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    description: 'Current working files, including uncommitted changes; no creator data or generated runtime directories. Not a reproducible-build attestation.',
    files: sourceFiles.filter(existsSync) });
  const blockers = [
    'Exact FFmpeg static dependency sources, patches, and build inputs are not assembled.',
    'SubtitlesOctopus pinned submodule source package is not assembled.',
    'Review missing-notices.json and Microsoft redistributable provenance.',
    'Clean-machine beta installation and first export are not yet recorded.'
  ];
  write('READ-ME-FIRST.txt', 'LOCAL PREPARATION ONLY — DISTRIBUTION HOLD\n\nRead guides/START-HERE.md and guides/LICENSING.md.\nNo messages have been sent and no release has been published.\n');
  const files = walk(kit).map(file => ({ path: path.relative(kit, file).replaceAll('\\', '/'), bytes: statSync(file).size, sha256: hash(file) }));
  write('manifest.json', { version, createdAt: new Date().toISOString(), status: 'HOLD', blockers, files });
  writeFileSync(path.join(base, 'latest.json'), JSON.stringify({ directory }, null, 2) + '\n');
  console.log(`Prepared ${files.length} files in .beta-artifacts/${directory}`);
  console.log('Distribution HOLD. Run npm run beta:check for integrity and outstanding items.');
}
