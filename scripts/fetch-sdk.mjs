import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
const cache=path.resolve('.runtime-cache');await mkdir(cache,{recursive:true});
const filename='vulkansdk-windows-X64-1.4.357.0.exe', target=path.join(cache,filename);
try{await access(target);}catch{
  console.log('Downloading the portable Vulkan build SDK (no system installation).');
  const response=await fetch('https://sdk.lunarg.com/sdk/download/1.4.357.0/windows/'+filename);
  if(!response.ok||!response.body)throw new Error('Vulkan SDK download failed: '+response.status);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(target));
}
const hash=createHash('sha256');
for await(const chunk of createReadStream(target))hash.update(chunk);
if(hash.digest('hex')!=='81f474711e9042f4cd22b31b2f7a8870db2e428b21586fb43dd80150be97310d')throw new Error('Vulkan SDK checksum mismatch');
await import('./extract-sdk.mjs');
