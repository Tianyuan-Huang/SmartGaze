import fs from 'node:fs'
import {spawn} from 'node:child_process'
for(const name of ['dist/index.html',process.env.DEMO_STORE,process.env.DEMO_TLS_CERT,process.env.DEMO_TLS_KEY])if(!name||!fs.existsSync(name))throw Error('Missing configuration or build. Run pnpm run setup and pnpm build first.')
if(!process.env.JOYAI_DEMO_KEY)throw Error('Run pnpm run setup to create an adapter token.')
const processes=[];let stopping=false
function stop(code=0){if(stopping)return;stopping=true;for(const child of processes)child.kill();process.exitCode=code}
for(const entry of ['model-adapter.mjs','server.mjs']){
 const child=spawn(process.execPath,[entry],{stdio:'inherit',env:process.env});processes.push(child)
 child.on('error',()=>stop(1));child.on('exit',code=>{if(!stopping)stop(code||1)})
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop())
