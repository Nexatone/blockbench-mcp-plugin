import net from 'node:net';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const log=[]; mkdirSync('.verification',{recursive:true});
const record=(label,value)=>{log.push({label,value});console.log(JSON.stringify({label,value}));writeFileSync('.verification/connection-live.json',JSON.stringify(log,null,2));};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function client(){let session,id=0;return {get session(){return session;},async rpc(method,params={}){const r=await fetch('http://127.0.0.1:3000/bb-mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Connection:'close',...(session?{'mcp-session-id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(3000)});session=r.headers.get('mcp-session-id')??session;const body=await r.json();if(body.error)throw new Error(JSON.stringify(body.error));return body.result;},async initialize(){return this.rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'connection-stability-review',version:'1.0'}});},async inspect(code){const r=await this.rpc('tools/call',{name:'risky_eval',arguments:{code:'Undo.cancelEdit(false); '+code}});const text=r.content.find(c=>c.type==='text')?.text;if(r.isError||text?.startsWith('Error executing'))throw new Error(text);return JSON.parse(text);}};}
async function ready(){for(let i=0;i<100;i++){try{const c=client();await c.initialize();return c;}catch{await delay(100);}}throw new Error('MCP did not restart');}
async function stream(session){const s=net.connect({host:'127.0.0.1',port:3000});s.on('error',()=>{});await once(s,'connect');let data='';s.on('data',chunk=>{data+=chunk.toString();});s.write(`GET /bb-mcp HTTP/1.1\r\nHost: localhost:3000\r\nAccept: text/event-stream\r\nMcp-Session-Id: ${session}\r\n\r\n`);for(let i=0;!data.includes('\r\n\r\n')&&i<100;i++)await delay(10);return {socket:s,get data(){return data;}};}
let control=await ready();
await control.inspect('window.__connectionReviewOriginal??={project:Project,model:Codecs.project.compile(),history:Undo.history.slice(),index:Undo.index,saved:Project.saved};window.__connectionReviewGeneration=Plugins.all.find(p=>p.id==="mcp").onunload;setTimeout(()=>Plugins.all.find(p=>p.id==="mcp").reload(),100);true');
await delay(1500);
control=await ready();
const provenance=await control.inspect('({version:Blockbench.version,plugin:Plugins.all.filter(p=>p.id==="mcp").map(p=>({source:p.source,path:p.path,version:p.version})),generationChanged:window.__connectionReviewGeneration!==Plugins.all.find(p=>p.id==="mcp").onunload,shutdownPatched:Plugins.all.find(p=>p.id==="mcp").onunload.toString().includes("closeAllConnections"),validationPatched:getAllToolDefinitions().create_texture.execute.toString().includes("parseAsync")})');
assert.equal(provenance.generationChanged,true);assert.equal(provenance.shutdownPatched,true);assert.equal(provenance.validationPatched,true);
record('build-provenance',{...provenance,sha256:createHash('sha256').update(readFileSync('dist/mcp.js')).digest('hex')});
const session=await ready();
const statuses=[];
for(let i=0;i<20;i++){const s=await stream(session.session);statuses.push(s.data.split('\r\n')[0]);assert.match(s.data,/^HTTP\/1.1 200/);s.socket.destroy(); for(let attempt=0;attempt<50;attempt++){const pending=await control.inspect(`sessionTransports.get(${JSON.stringify(session.session)})?.transport._streamMapping.has(sessionTransports.get(${JSON.stringify(session.session)})?.transport._standaloneSseStreamId)??false`);if(!pending)break;await delay(25);}}
record('twenty-sse-reconnections',{sameSession:true,statuses});
const sse=await stream(session.session);
assert.match(sse.data,/connection: close/i);
const ping=await session.rpc('ping');record('post-while-sse-open',{ping});
for(let i=0;!sse.data.includes(': keepalive\n\n')&&i<180;i++)await delay(100);
assert.ok(sse.data.includes(': keepalive\n\n'));record('live-heartbeat',{received:true});
const idle=net.connect({host:'127.0.0.1',port:3000});idle.on('error',()=>{});await once(idle,'connect');
let sseClosed=false,idleClosed=false;sse.socket.on('close',()=>{sseClosed=true;});idle.on('close',()=>{idleClosed=true;});
await control.inspect('window.__connectionReviewGeneration=Plugins.all.find(p=>p.id==="mcp").onunload;setTimeout(()=>Plugins.all.find(p=>p.id==="mcp").reload(),100);true');
await delay(1500);control=await ready();
record('reload-open-connections',{sseClosed,idleClosed,tools:(await control.rpc('tools/list')).tools.length});assert.ok(sseClosed&&idleClosed);
let staleRejected=false;try{await session.rpc('ping');}catch(e){staleRejected=String(e).includes('Session not found');}assert.ok(staleRejected);record('reload-session-recovery',{oldSessionRejected:staleRejected,newSessionConnected:true});
record('original-project-preservation',await control.inspect('let s=window.__connectionReviewOriginal;let r={modelUnchanged:Codecs.project.compile()===s.model,historyUnchanged:Undo.index===s.index&&Undo.history.length===s.history.length&&Undo.history.every((h,i)=>h===s.history[i]),savedUnchanged:Project.saved===s.saved,active:Project.name,projects:ModelProject.all.map(p=>p.name)};delete window.__connectionReviewOriginal;delete window.__connectionReviewGeneration;if(!r.modelUnchanged||!r.historyUnchanged||!r.savedUnchanged)throw new Error("Original project changed");r'));
