import { mkdir, copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import wawoff2 from 'wawoff2';
const root = process.cwd();
for (const dir of ['public/libass', 'public/fonts', 'public/notices', 'src-tauri/resources/fonts']) await mkdir(path.join(root, dir), { recursive: true });
const ass = path.join(root, 'node_modules/libass-wasm/dist/js');
for (const name of await readdir(ass)) {
  if (/subtitles-octopus/.test(name)) await copyFile(path.join(ass, name), path.join(root, 'public/libass', name));
}
await copyFile(path.join(ass,'COPYRIGHT'),path.join(root,'public/libass/COPYRIGHT'));
for(const font of ['inter','noto-naskh-arabic'])await copyFile(path.join(root,'node_modules/@fontsource',font,'LICENSE'),path.join(root,'public/notices',font+'-LICENSE.txt'));
for(const name of ['react','react-dom','lucide-react','zod']){
  try{await copyFile(path.join(root,'node_modules',name,'LICENSE'),path.join(root,'public/notices',name+'-LICENSE.txt'));}catch{}
}
const fontSets = [
  ['inter', 'latin', '400'], ['inter', 'latin', '700'],
  ['noto-naskh-arabic', 'arabic', '400'], ['noto-naskh-arabic', 'arabic', '700'],
  ['noto-naskh-arabic', 'latin', '400'], ['noto-naskh-arabic', 'latin', '700'],
];
for (const [font, subset, weight] of fontSets) {
  const name = font + '-' + subset + '-' + weight + '-normal.woff2';
  for (const dir of ['public/fonts', 'src-tauri/resources/fonts']) {
    await copyFile(path.join(root, 'node_modules/@fontsource', font, 'files', name), path.join(root, dir, name));
    const sfnt=await wawoff2.decompress(await readFile(path.join(root,'node_modules/@fontsource',font,'files',name)));
    await writeFile(path.join(root,dir,name.replace('.woff2','.ttf')),sfnt);
  }
}
console.log('Prepared local fonts and SubtitlesOctopus runtime.');
