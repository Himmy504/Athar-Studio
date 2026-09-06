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
const catalog=JSON.parse(await readFile(path.join(root,'src/fontCatalog.json'),'utf8'));
for(const font of catalog)await copyFile(path.join(root,'node_modules/@fontsource',font.id,'LICENSE'),path.join(root,'public/notices',font.id+'-LICENSE.txt'));
for(const name of ['react','react-dom','lucide-react','zod']){
  try{await copyFile(path.join(root,'node_modules',name,'LICENSE'),path.join(root,'public/notices',name+'-LICENSE.txt'));}catch{}
}
const css=[];
for(const font of catalog){
  const packageRoot=path.join(root,'node_modules/@fontsource',font.id);
  for(const name of font.files){
    const woff=name.replace('.ttf','.woff2'),source=await readFile(path.join(packageRoot,'files',woff));
    const sfnt=await wawoff2.decompress(source);
    const bytes=Buffer.from(sfnt),tables={};
    for(let i=0;i<bytes.readUInt16BE(4);i++){const offset=12+i*16;tables[bytes.toString('ascii',offset,offset+4)]=bytes.readUInt32BE(offset+8);}
    const actual={units:bytes.readUInt16BE(tables.head+18),ascent:bytes.readInt16BE(tables['OS/2']+74),descent:bytes.readInt16BE(tables['OS/2']+76)};
    if(JSON.stringify(actual)!==JSON.stringify(font.metrics[name.includes('-700-')?'bold':'regular']))throw new Error(`Font metrics changed for ${name}; update the catalog before packaging.`);
    const names={},table=tables.name,strings=table+bytes.readUInt16BE(table+4);
    for(let i=0;i<bytes.readUInt16BE(table+2);i++){
      const offset=table+6+i*12,id=bytes.readUInt16BE(offset+6);
      if(bytes.readUInt16BE(offset)!==3||![1,16].includes(id))continue;
      const start=strings+bytes.readUInt16BE(offset+10),length=bytes.readUInt16BE(offset+8);
      names[id]=Buffer.from(bytes.subarray(start,start+length)).swap16().toString('utf16le');
    }
    if((names[16]||names[1])!==font.assFamily)throw new Error(`Embedded family changed for ${name}; update the catalog before packaging.`);
    await writeFile(path.join(root,'public/fonts',woff),source);
    for(const dir of ['public/fonts','src-tauri/resources/fonts'])await writeFile(path.join(root,dir,name),sfnt);
  }
  for(const weight of [400,700]){
    const sourceCss=await readFile(path.join(packageRoot,weight+'.css'),'utf8');
    for(const face of sourceCss.matchAll(/@font-face\s*\{[^}]+\}/g)){
      const file=face[0].match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
      if(file&&font.files.includes(file.replace('.woff2','.ttf')))
        css.push(face[0].replace(/src:[^;]+;/,`src: url('/fonts/${file}') format('woff2');`));
    }
  }
}
await writeFile(path.join(root,'public/fonts/catalog.css'),css.join('\n')+'\n');
console.log(`Prepared ${catalog.length} local font families and SubtitlesOctopus runtime.`);
