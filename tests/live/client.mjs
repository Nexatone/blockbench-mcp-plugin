import { writeFileSync } from 'node:fs';
let session, id=0;
export async function rpc(method,params={}) {
 const response=await fetch('http://127.0.0.1:3000/bb-mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Connection:'close',...(session?{'mcp-session-id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(30000)});
 const body=await response.json(); if(body.error)throw Error(JSON.stringify(body.error));
 session=response.headers.get('mcp-session-id')??session; return body.result;
}
export async function connect(){session=undefined;return rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'bug-review-fix-verification',version:'1'}});}
export async function call(name,args={}) {const r=await rpc('tools/call',{name,arguments:args});if(r.isError)throw Error(JSON.stringify(r));return r;}
export async function inspect(code){const r=await call('risky_eval',{code:'Undo.cancelEdit(false); '+code});const text=r.content.find(c=>c.type==='text')?.text;if(text?.startsWith('Error executing'))throw Error(text+'; code: '+code);return JSON.parse(text);}
export const log=(label,value)=>{console.log(JSON.stringify({label,value}));return value;};
export async function reload(){await inspect('setTimeout(()=>Plugins.all.find(p=>p.id==="mcp").reload(),100);true');await new Promise(r=>setTimeout(r,1600));for(let n=0;n<20;n++){try{await connect();return;}catch(e){if(n===19)throw e;await new Promise(r=>setTimeout(r,500));}}}
