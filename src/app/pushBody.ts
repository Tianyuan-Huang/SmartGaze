// Recover base64 transport overhead without lowering image resolution/quality.
export async function pushBody(value:unknown):Promise<{body:BodyInit;headers:Record<string,string>;bytes:number;originalBytes:number}>{
 const text=JSON.stringify(value),originalBytes=new TextEncoder().encode(text).byteLength
 if(originalBytes>=32000&&typeof CompressionStream!=='undefined')try{
  const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')),body=await new Response(stream).arrayBuffer()
  if(body.byteLength<originalBytes*.95)return {body,headers:{'content-encoding':'gzip'},bytes:body.byteLength,originalBytes}
 }catch{/* Older mobile browsers keep the ordinary JSON request path. */}
 return {body:text,headers:{},bytes:originalBytes,originalBytes}
}
