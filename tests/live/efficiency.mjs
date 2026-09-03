// Load the local build before running. This suite creates only disposable models.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {connect,call,rpc,inspect} from './client.mjs';
mkdirSync('.verification',{recursive:true});
const expected=JSON.parse(readFileSync('dist/build-info.json','utf8'));
await connect();
const json=async(name,args={})=>{const result=await call(name,args);return result.structuredContent??JSON.parse(result.content.find(c=>c.type==='text').text);};
const capabilities=await json('get_project_capabilities');
assert.equal(capabilities.plugin.build_id,expected.build_id,'Load the exact current bundle');
const results=[],timings=[];
await inspect('if(Undo.current_save||Dialog.open||Timeline.playing)throw Error("Finish the current interaction");if(!window.__efficiencyImplementation){const a=window.__efficiencyImplementation={active:Project,mode:Modes.selected,tool:Toolbox.selected,originals:[],created:[]};try{for(const p of ModelProject.all){p.select();if(Undo.current_save)throw Error("Pending original edit");a.originals.push({project:p,model:Codecs.project.compile(),saved:p.saved,index:Undo.index,history:Undo.history.slice(),selected:Outliner.selected.map(e=>e.uuid)});}}finally{a.active?.select();}}true');
async function record(name,run){try{const detail=await run();results.push({name,pass:true,detail});}catch(error){results.push({name,pass:false,error:error.stack??String(error)});throw error;}}
async function unchangedFailure(args,match){
 const snapshot='({model:Codecs.project.compile(),saved:Project.saved,index:Undo.index,history:Undo.history.length,selection:Outliner.selected.map(e=>e.uuid),pending:!!Undo.current_save})';
 const before=await inspect(snapshot);
 await assert.rejects(()=>call('apply_model_batch',args),match);
 assert.deepEqual(await inspect(snapshot),before);
}
let project, batch;
try {
 await record('resource_discovery_and_compact_reads',async()=>{
  for(let n=0;n<4;n++){const start=performance.now();const result=await rpc('resources/list');timings.push({operation:'resources/list',ms:performance.now()-start,bytes:Buffer.byteLength(JSON.stringify(result))});}
  const info=await json('get_project_info');
  const id=info.root_groups[0]?.uuid;
  if(id){const result=await rpc('resources/read',{uri:`model://${info.project.uuid}/elements/${id}`});const bytes=Buffer.byteLength(JSON.stringify(result));assert.ok(bytes<4096);timings.push({operation:'compact_model_element',bytes});}
  const prompt=await rpc('prompts/get',{name:'model_creation_strategy',arguments:{}});assert.ok(prompt.messages[0].content.text.includes('apply_model_batch'));
  const tools=await rpc('tools/list');assert.ok(tools.tools.find(t=>t.name==='apply_model_batch').outputSchema);
  return {tools:tools.tools.length};
 });
 await call('create_project',{name:'efficiency_disposable',format:'free'});
 project=await inspect('window.__efficiencyImplementation.created.push(Project.uuid);Project.uuid');
 await call('place_cube',{elements:[{name:'seed',from:[0,0,0],to:[1,1,1]}]});
 await record('atomic_complete_geometry_undo_redo_retry',async()=>{
  const before=await inspect('({model:Codecs.project.compile(),index:Undo.index})');
  const revision=(await json('get_project_capabilities')).revision;
  batch={project_uuid:project,expected_revision:revision,operation_id:'efficiency-fixture',groups:[{ref:'child',name:'child',parent:'@root'},{ref:'root',name:'root'}],cubes:[{ref:'box',name:'box',parent:'@child',from:[0,0,0],to:[4,4,4]}],meshes:[{ref:'mesh',name:'quad',parent:'@root',vertices:{a:[5,0,0],b:[9,0,0],c:[9,4,0],d:[5,4,0]},faces:[{vertices:['a','b','c','d'],uv:{a:[0,0],b:[4,0],c:[4,4],d:[0,4]}}]}],patches:[{id:'seed',name:'seed_patched'}]};
  const start=performance.now();const result=await json('apply_model_batch',batch);timings.push({operation:'complete_model_batch',ms:performance.now()-start});
  assert.equal(Object.keys(result.created).length,4);
  const after=await inspect('({model:Codecs.project.compile(),index:Undo.index,faces:Object.keys(Mesh.all[0].faces).length,normal:Object.values(Mesh.all[0].faces)[0].getNormal(true)})');
  assert.equal(after.index,before.index+1);assert.equal(after.faces,1);assert.ok(after.normal.every(Number.isFinite));
  await call('undo');assert.equal(await inspect('Codecs.project.compile()'),before.model);
  await call('redo');assert.equal(await inspect('Codecs.project.compile()'),after.model);
  const replay=await json('apply_model_batch',batch);assert.equal(replay.replayed,true);assert.deepEqual(replay.created,result.created);assert.equal(await inspect('Undo.index'),after.index);
  await unchangedFailure({...batch,label:'different'},/OPERATION_ID_CONFLICT/);
  await unchangedFailure({...batch,operation_id:'stale-request'},/STALE_REVISION/);
  return {created:Object.keys(result.created).length,undoEntries:1,retry:'deduplicated'};
 });
 await record('preflight_and_native_failure_rollback',async()=>{
  await unchangedFailure({project_uuid:project,groups:[{ref:'a',name:'a',parent:'@b'},{ref:'b',name:'b',parent:'@a'}]},/cycle/);
  await unchangedFailure({project_uuid:project,meshes:[{ref:'bad',name:'bad',vertices:{a:[0,0,0],b:[1,0,0],c:[0,1,0]},faces:[{vertices:['a','b','missing']}]}]},/Unknown vertex/);
  await unchangedFailure({project_uuid:project,patches:[{id:'seed_patched',name:'changed'},{id:'missing',name:'bad'}]},/NOT_FOUND/);
  await inspect('window.__efficiencyImplementation.cubeInit=Cube.prototype.init;Cube.prototype.init=function(){const result=window.__efficiencyImplementation.cubeInit.apply(this,arguments);if(this.name==="throw_here")throw Error("Injected native failure");return result;};true');
  try{await unchangedFailure({project_uuid:project,groups:[{ref:'newgroup',name:'newgroup'}],cubes:[{ref:'newcube',name:'throw_here',parent:'@newgroup',from:[0,0,0],to:[2,2,2]}]},/Injected native failure/);}
  finally{await inspect('Cube.prototype.init=window.__efficiencyImplementation.cubeInit;delete window.__efficiencyImplementation.cubeInit;true');}
 });
 await record('bounded_pages_and_stale_cursor',async()=>{
  const first=await json('query_model',{project_uuid:project,limit:2});assert.equal(first.items.length,2);assert.ok(first.next_cursor);
  const next=await json('query_model',{project_uuid:project,limit:2,cursor:first.next_cursor});assert.equal(next.items.length,2);assert.notEqual(next.items[0].uuid,first.items[0].uuid);
  await call('rename_element',{id:'box',new_name:'renamed_box'});
  await assert.rejects(()=>call('query_model',{project_uuid:project,limit:2,cursor:first.next_cursor}),/STALE_CURSOR/);
  const vertices=await json('query_model',{project_uuid:project,kind:'mesh_vertices',owner_id:'quad'});assert.equal(vertices.total,4);
  const faces=await json('query_model',{project_uuid:project,kind:'mesh_faces',owner_id:'quad'});assert.equal(faces.total,1);
 });
 await record('patch_visibility_and_remove_subtree_undo_redo',async()=>{
  await call('apply_model_batch',{project_uuid:project,patches:[{id:'renamed_box',visibility:false}]});
  assert.equal(await inspect('Cube.all.find(c=>c.name==="renamed_box").mesh.visible'),false);
  await call('undo');
  const before=await inspect('Codecs.project.compile()');
  const removed=await json('apply_model_batch',{project_uuid:project,remove:['root']});
  assert.equal(removed.removed.length,1);assert.equal(removed.removed_count,4);
  assert.equal(await inspect('Mesh.all.length'),0);
  assert.equal(await inspect('Group.all.length'),0);
  await call('undo');assert.equal(await inspect('Codecs.project.compile()'),before);
  await call('redo');assert.equal(await inspect('Mesh.all.length'),0);
  await call('undo');assert.equal(await inspect('Codecs.project.compile()'),before);
 });
 await record('search_and_native_selection_fixes',async()=>{
  await assert.rejects(()=>call('find_elements_by_criteria',{name_pattern:'[',limit:1}),/INVALID_FILTER/);
  await call('add_armature',{name:'test_rig',add_initial_bone:false});
  await call('add_armature_bone',{parent_id:'test_rig',name:'bone_a'});
  await call('add_armature_bone',{parent_id:'test_rig',name:'bone_b'});
  await call('select_armature_bones',{ids:['bone_a','bone_b']});
  assert.deepEqual(await inspect('ArmatureBone.selected.map(b=>b.name).sort()'),['bone_a','bone_b']);
  await call('select_armature_bones',{ids:['bone_a'],clear_selection:false});assert.equal(await inspect('ArmatureBone.selected.length'),2);
  await assert.rejects(()=>call('select_armature_bones',{ids:['missing']}));assert.equal(await inspect('ArmatureBone.selected.length'),2);
  const index=await inspect('Project.saved=true;Undo.index');
  await call('select_mesh_elements',{mesh_id:'quad',mode:'vertex'});
  assert.equal(await inspect('Project.saved'),true);
  assert.equal(await inspect(`Undo.history.slice(${index}).some(entry=>entry.type==="edit")`),false);
 });
 await record('native_validation_fresh_result',async()=>{
  const result=await json('validate_model',{project_uuid:project});assert.ok(result.validated_at);assert.equal(result.project_uuid,project);return {problems:result.total};
 });
 await record('serialize_concurrent_tools',async()=>{
  const endpoint='http://127.0.0.1:3000/bb-mcp';
  const headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream',Connection:'close'};
  const initialization=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'efficiency-second-client',version:'1'}}})});
  await initialization.json();
  const secondHeaders={...headers,'mcp-session-id':initialization.headers.get('mcp-session-id')};
  const start=performance.now();
  const first=call('risky_eval',{code:'(async()=>{await new Promise(r=>setTimeout(r,180));return true;})()'});
  await new Promise(resolve=>setTimeout(resolve,25));
  try {
   const second=await fetch(endpoint,{method:'POST',headers:secondHeaders,body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'place_cube',arguments:{elements:[{name:'queued',from:[0,0,0],to:[1,1,1]}]}}})});
   const response=await second.json();assert.ok(!response.error&&!response.result.isError);
   const elapsed=performance.now()-start;await first;assert.ok(elapsed>=150);return {elapsed,clients:2};
  } finally {await fetch(endpoint,{method:'DELETE',headers:secondHeaders});}
 });
 await record('reject_queued_project_change',async()=>{
  await call('create_project',{name:'efficiency_switch',format:'free'});
  const other=await inspect('window.__efficiencyImplementation.created.push(Project.uuid);Project.uuid');
  await call('select_project',{project_uuid:project});
  const first=call('risky_eval',{code:`(async()=>{await new Promise(r=>setTimeout(r,120));ModelProject.all.find(p=>p.uuid===${JSON.stringify(other)}).select();return true;})()`});
  await new Promise(resolve=>setTimeout(resolve,25));
  await assert.rejects(()=>call('place_cube',{elements:[{name:'wrong_project'}]}),/PROJECT_CHANGED/);
  await first;assert.equal(await inspect('Outliner.elements.length'),0);
  await call('select_project',{project_uuid:project});
 });
 await record('viewport_and_save_reopen',async()=>{
  const screenshot=await call('set_camera_angle',{position:[18,15,23],target:[3,2,0],projection:'perspective'});
  const image=screenshot.content.find(c=>c.type==='image');if(image)writeFileSync('.verification/efficiency-model.png',Buffer.from(image.data,'base64'));
  const exported=await json('export_model',{codec_id:'project',max_content_length:100000});assert.ok(exported.content&&!exported.truncated);
  const reopened=await json('open_project',{bbmodel:exported.content});
  assert.notEqual(reopened.project_uuid,project);
  await inspect('window.__efficiencyImplementation.created.push(Project.uuid);true');
  assert.equal(await inspect('Object.keys(Mesh.all[0].faces).length'),1);assert.ok(await inspect('Group.all.some(g=>g.name==="root")'));
 });
 await record('texture_identity_optional_preview_and_explicit_layer',async()=>{
  const result=await call('create_texture',{name:'agent_texture',width:32,height:16,fill_color:'#ff8000',layer_name:'base',include_preview:false});
  assert.ok(result.structuredContent.texture_uuid);assert.ok(result.content.every(c=>c.type==='text'));
  const {texture_uuid,layer_ids}=result.structuredContent;
  await call('texture_layer_management',{action:'create_layer',texture_id:texture_uuid,layer_name:'overlay'});
  await call('texture_layer_management',{action:'rename_layer',texture_id:texture_uuid,layer_id:layer_ids[0],layer_name:'base_named_by_id'});
  assert.equal(await inspect('Texture.selected.layers[0].name'),'base_named_by_id');
  await assert.rejects(()=>call('texture_layer_management',{action:'delete_layer',texture_id:texture_uuid,layer_id:'missing'}),/NOT_FOUND/);
  assert.equal(await inspect('Texture.selected.layers.length'),2);
  const fallback=await call('create_texture',{name:'legacy_preview'});assert.equal(fallback.content[0].type,'image');
 });
} catch(error) {process.exitCode=1;console.error(error);}
finally {
 const preservation=await inspect('(async()=>{const a=window.__efficiencyImplementation;if(a.cubeInit){Cube.prototype.init=a.cubeInit;delete a.cubeInit;}for(const p of [...ModelProject.all])if(a.created.includes(p.uuid))await p.close(true);const checks=[];for(const o of a.originals){o.project.select();checks.push({model:Codecs.project.compile()===o.model,saved:o.project.saved===o.saved,index:Undo.index===o.index,history:Undo.history.length===o.history.length&&Undo.history.every((v,i)=>v===o.history[i]),selection:JSON.stringify(Outliner.selected.map(e=>e.uuid))===JSON.stringify(o.selected)});}a.active?.select();a.mode?.select();a.tool?.select();return {count:checks.length,checks,active:Project===a.active};})()');
 const pass=preservation.active&&preservation.checks.every(row=>Object.values(row).every(Boolean));if(!pass)process.exitCode=1;
 const report={date:new Date().toISOString(),build:capabilities.plugin,results,timings,preservation};writeFileSync('.verification/efficiency-live.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({results,timings,preservation:{count:preservation.count,pass}},null,2));
 if(pass)await inspect('delete window.__efficiencyImplementation;true');
}
