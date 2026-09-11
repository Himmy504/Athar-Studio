import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const cache=path.resolve('.runtime-cache'), exe=path.join(cache,'vulkansdk-windows-X64-1.4.357.0.exe');
const bytes=await readFile(exe), signature=Buffer.from([0x37,0x7a,0xbc,0xaf,0x27,0x1c]);
const dest=path.join(cache,'vulkan-sdk');await mkdir(dest,{recursive:true});
let offset=0,count=0;
while((offset=bytes.indexOf(signature,offset))!==-1){
  const begin=offset;offset+=6;
  if(begin+32>bytes.length)continue;
  const relative=bytes.readBigUInt64LE(begin+12), size=bytes.readBigUInt64LE(begin+20);
  const end=BigInt(begin+32)+relative+size;
  if(end>BigInt(bytes.length)||size===0n||size>10000000n)continue;
  const archive=path.join(cache,'sdk-part-'+count+'.7z');
  await writeFile(archive,bytes.subarray(begin,Number(end)));
  const listing=spawnSync('C:\\Program Files\\7-Zip\\7z.exe',['l',archive],{encoding:'utf8',windowsHide:true});
  if(listing.status!==0)continue;
  console.log('SDK archive '+count+': '+listing.stdout.split('\n').filter(l=>/vulkan-1.lib|vulkan_core.h|glslc.exe|\\.h$/.test(l)).slice(0,4).join('\n'));
  const extract=spawnSync('C:\\Program Files\\7-Zip\\7z.exe',['x',archive,'-o'+dest,'-y','-ir!Include*','-ir!Lib*','-ir!Bin\\glslc.exe','-ir!Bin\\vulkan-1.dll'],{encoding:'utf8',windowsHide:true});
  if(extract.status>1)throw new Error(extract.stderr);
  count++;
}
console.log('Extracted build headers, libraries and shader compiler from '+count+' SDK archives.');
