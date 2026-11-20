import {mkdir,copyFile} from 'node:fs/promises'
await mkdir(new URL('../dist/prism/',import.meta.url),{recursive:true})
for(const name of ['core.js','data.json'])await copyFile(new URL('../prism/'+name,import.meta.url),new URL('../dist/prism/'+name,import.meta.url))
