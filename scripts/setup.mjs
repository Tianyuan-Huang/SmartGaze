import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {parseEnv} from 'node:util'
import {spawnSync} from 'node:child_process'
import {initialize,standardizeAccounts} from '../auth.mjs'
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'))
if(!fs.existsSync('.env'))fs.copyFileSync('.env.example','.env')
let text=fs.readFileSync('.env','utf8'),env={...parseEnv(text),...process.env}
if(!env.JOYAI_DEMO_KEY){const token=crypto.randomBytes(32).toString('hex');text=text.replace(/^JOYAI_DEMO_KEY=.*$/m,'JOYAI_DEMO_KEY='+token);fs.writeFileSync('.env',text,{mode:0o600});env.JOYAI_DEMO_KEY=token}
const file=env.DEMO_STORE||'.runtime/accounts.json',key=env.DEMO_TLS_KEY||'.runtime/tls/server.key',cert=env.DEMO_TLS_CERT||'.runtime/tls/server.crt'
for(const name of [file,key,cert])fs.mkdirSync(path.dirname(name),{recursive:true})
if(fs.existsSync(key)!==fs.existsSync(cert))throw Error('Provide both TLS key and certificate, or remove the incomplete pair before setup.')
if(!fs.existsSync(cert)){
 const config=path.join(path.dirname(cert),'localhost.cnf');fs.writeFileSync(config,'[req]\ndistinguished_name=dn\n[dn]\n');
 const result=spawnSync('openssl',['req','-config',config,'-x509','-newkey','rsa:2048','-sha256','-days','365','-nodes','-keyout',key,'-out',cert,'-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'})
 if(result.error||result.status!==0)throw Error('OpenSSL 1.1.1+ is required to create local TLS certificates. Install it and rerun setup.')
 try{fs.chmodSync(key,0o600)}catch{}
}
if(!fs.existsSync(file)){
 const temporary=file+'.initial-credentials'
 await initialize(file,temporary)
 try{await standardizeAccounts(file)}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
 console.log('Created user01–user05 and administrator user06. Each initial password equals its username.')
}else console.log('Existing accounts and preferences preserved.')
console.log('Setup complete. Configure MODEL_API_BASE / DEMO_SPEECH_KEY in .env, then build and start.')
