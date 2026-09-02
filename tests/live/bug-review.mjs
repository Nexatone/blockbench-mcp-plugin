import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {connect,call,inspect,rpc} from './client.mjs';
const results=[];
mkdirSync('.verification',{recursive:true});
function record(name,value){results.push({name,...value});console.log(JSON.stringify(results.at(-1)));writeFileSync('.verification/bug-review-live.json',JSON.stringify(results,null,2));}
await connect();
await inspect('window.__reviewFix={project:Project,model:Codecs.project.compile(),history:Undo.history.slice(),index:Undo.index,saved:Project.saved,mode:Modes.selected,tool:Toolbox.selected,paintSide:settings.paint_side_restrict.value,created:[]};true');
async function scenario(name,format,fn){
 if(process.env.REVIEW_SCENARIO && process.env.REVIEW_SCENARIO!==name)return;
 try{await call('create_project',{name:'codex_fix_'+name,format});await inspect('window.__reviewFix.created.push(Project.uuid);true');await fn();record(name,{pass:true});}
 catch(error){record(name,{pass:false,error:error.stack ?? String(error)});}
 finally {await inspect('(async()=>{if(window.__reviewFix.created.includes(Project.uuid)){await Project.close(true);}window.__reviewFix.project.select();return true;})()');}
}
const text=r=>r.content.find(c=>c.type==='text')?.text;
async function reopen() {
 await inspect('(async()=>{let data=JSON.parse(Codecs.project.compile());Codecs.project.load(data,{path:"codex_roundtrip.bbmodel",no_file:true});window.__reviewFix.created.push(Project.uuid);await Promise.all(Texture.all.flatMap(t=>[t.img,...t.layers.map(l=>l.img)]).map(img=>img.complete?Promise.resolve():new Promise(r=>img.addEventListener("load",r,{once:true}))));await new Promise(r=>setTimeout(r,100));return true;})()');
}
try{
 await scenario('geometry','bedrock',async()=>{
  await call('place_cube',{elements:[{name:'plain'}]});
  assert.equal(await inspect('Cube.all.length'),1);
  await inspect('Undo.undo();true');assert.equal(await inspect('Cube.all.length'),0);
  await inspect('Undo.redo();true');assert.equal(await inspect('Cube.all.length'),1);
  await call('create_texture',{name:'tex',width:64,height:32,fill_color:'#34B6A0',layer_name:'base'});
  await inspect('Undo.undo();true');assert.equal(await inspect('Texture.all.length'),0);
  await inspect('Undo.redo();true');
  assert.deepEqual(await inspect('Array.from(Texture.all[0].layers[0].ctx.getImageData(63,31,1,1).data)'),[52,182,160,255]);
  await call('place_cube',{elements:[{name:'source'}],texture:'tex',faces:[{face:'north',uv:[2,3,6,7]}]});
  await inspect('Cube.all[1].faces.north.rotation=90;Cube.all[1].faces.north.tint=2;true');
  await call('duplicate_element',{id:'source',offset:[3,4,5],newName:'copy'});
  assert.deepEqual(await inspect('Cube.all.find(c=>c.name==="copy").faces.north.getSaveCopy()'),await inspect('Cube.all.find(c=>c.name==="source").faces.north.getSaveCopy()'));
  await inspect('Undo.undo();true');assert.equal(await inspect('Cube.all.length'),2);
  await inspect('Undo.redo();true');assert.equal(await inspect('Cube.all.length'),3);
  await call('remove_element',{id:'source'});assert.equal(await inspect('Cube.all.length'),2);
  await inspect('Undo.undo();true');assert.equal(await inspect('Cube.all.length'),3);
  await inspect('Undo.redo();true');assert.equal(await inspect('Cube.all.length'),2);
  assert.equal(await inspect('new Set(Outliner.root.map(n=>n.uuid)).size===Outliner.root.length'),true);
  const saved=JSON.parse(text(await call('export_model',{codec_id:'project'})));
  const model=JSON.parse(saved.content);assert.equal(model.textures[0].width,64);assert.equal(model.textures[0].height,32);
  assert.deepEqual(await inspect('Array.from(Texture.all[0].layers[0].ctx.getImageData(63,31,1,1).data)'),[52,182,160,255]);
  await reopen();
  assert.deepEqual(await inspect('Array.from(Texture.all[0].ctx.getImageData(63,31,1,1).data)'),[52,182,160,255]);
  assert.deepEqual(await inspect('[Texture.all[0].width,Texture.all[0].height,Texture.all[0].layers[0].name]'),[64,32,'base']);
 });
 await scenario('meshes','free',async()=>{
  await inspect('for(let name of ["requested","other"]){let m=new Mesh({name,vertices:{a:[0,0,0],b:[4,0,0],c:[4,4,0],d:[0,4,0]},faces:{}}).init();m.addFaces(new MeshFace(m,{vertices:["a","b","c","d"],uv:{a:[0,0],b:[4,0],c:[4,4],d:[0,4]}}));}Mesh.all[1].select();true');
  const mesh=await inspect('Mesh.all[0].uuid');const faces=await inspect('Object.keys(Mesh.all[0].faces)');
  const other=await inspect('JSON.stringify(Mesh.all[1].getSaveCopy())');
  await call('rotate_mesh_uv',{mesh_id:mesh,angle:'90',faces});
  assert.equal(await inspect('JSON.stringify(Mesh.all[1].getSaveCopy())'),other);
  assert.notDeepEqual(await inspect('Mesh.all[0].faces[Object.keys(Mesh.all[0].faces)[0]].uv.a'),[0,0]);
  await call('auto_uv_mesh',{mesh_id:mesh,mode:'sphere',faces});assert.equal(await inspect('Object.values(Mesh.all[0].faces).every(f=>Object.values(f.uv).every(v=>v.every(Number.isFinite)))'),true);
  await call('select_mesh_elements',{mesh_id:mesh,mode:'vertex',elements:['a','b'],action:'select'});assert.equal(await inspect('Project.mesh_selection[Mesh.all[0].uuid].vertices.length'),2);
  await call('duplicate_element',{id:mesh,offset:[2,0,0],newName:'mesh_copy'});assert.equal(await inspect('Object.keys(Mesh.all.find(m=>m.name==="mesh_copy").faces).length'),1);
  await inspect('Undo.undo();true');assert.equal(await inspect('Mesh.all.length'),2);await inspect('Undo.redo();true');assert.equal(await inspect('Mesh.all.length'),3);
  await call('select_mesh_elements',{mesh_id:mesh,mode:'face',elements:faces,action:'select'});
  await call('subdivide_mesh',{mesh_id:mesh,cuts:2});assert.equal(await inspect('Object.keys(Mesh.all[0].faces).length'),9);
  await inspect('Undo.undo();true');assert.equal(await inspect('Object.keys(Mesh.all[0].faces).length'),1);
  await call('select_mesh_elements',{mesh_id:mesh,mode:'face',elements:faces,action:'select'});
  await call('extrude_mesh',{mesh_id:mesh,distance:3,mode:'faces'});assert.equal(await inspect('Math.max(...Object.values(Mesh.all[0].vertices).map(v=>Math.abs(v[2])))'),3);
  assert.equal(await inspect('JSON.stringify(Mesh.all[1].getSaveCopy())'),other);
  await call('delete_mesh_elements',{mesh_id:mesh,mode:'faces',keep_vertices:true});await inspect('Undo.undo();true');
 });
 await scenario('animation','bedrock',async()=>{
  await call('add_group',{name:'bone',origin:[0,0,0],rotation:[0,0,0]});
  await inspect('Modes.options.animate.select();true');
  await call('create_animation',{name:'first',bones:{bone:[]},animation_length:2});
  const first=await inspect('Animation.selected.uuid');
  await call('create_animation',{name:'second',bones:{bone:[]}});
  const second=await inspect('Animation.selected.uuid');
  await call('manage_keyframes',{animation_id:first,action:'create',bone_name:'bone',channel:'position',keyframes:[{time:0,values:[0,0,0]},{time:1,values:[4,5,6]}]});
  const get=`Animation.all.find(a=>a.uuid===${JSON.stringify(first)}).animators[Group.all[0].uuid].position`;
  assert.deepEqual((await inspect(get+'.map(k=>k.getArray().map(Number))')).at(-1),[4,5,6]);
  assert.equal(await inspect('Animation.selected.uuid'),second);
  await call('manage_keyframes',{animation_id:first,action:'edit',bone_name:'bone',channel:'position',keyframes:[{time:1,values:[7,8,9]}]});
  assert.deepEqual((await inspect(get+'.map(k=>k.getArray().map(Number))')).at(-1),[7,8,9]);
  await inspect('Undo.undo();true');assert.deepEqual((await inspect(get+'.map(k=>k.getArray().map(Number))')).at(-1),[4,5,6]);await inspect('Undo.redo();true');
  await call('animation_graph_editor',{animation_id:first,bone_name:'bone',channel:'position',axis:'x',action:'ease_in'});
  assert.equal(await inspect(get+'.every(k=>Array.isArray(k.bezier_left_time)&&Array.isArray(k.bezier_right_time))'),true);
  assert.equal((await inspect(get+'[0].bezier_right_time'))[1],0.1);
  const handles=await inspect(get+'.map(k=>({left:k.bezier_left_time,right:k.bezier_right_time}))');
  await reopen();assert.deepEqual(await inspect(get+'.map(k=>({left:k.bezier_left_time,right:k.bezier_right_time}))'),handles);
  const result=await rpc('tools/call',{name:'batch_keyframe_operations',arguments:{selection:'all',operation:'bake',parameters:{bake_interval:-1}}});assert.equal(result.isError,true);
  await inspect(`Animation.all.find(a=>a.uuid===${JSON.stringify(first)}).select();Animation.selected.animators[Group.all[0].uuid].addToTimeline();true`);
  await call('batch_keyframe_operations',{selection:'all',operation:'bake',parameters:{bake_interval:0.25}});
  assert.equal(await inspect(get+'.length'),5);
 });
 await scenario('painting','free',async()=>{
  await call('create_texture',{name:'paint',width:64,height:32});
  await inspect('(async()=>{await new Promise(r=>setTimeout(r,50));Modes.options.paint.select();return true;})()');
  await call('paint_with_brush',{texture_id:'paint',coordinates:[{x:20,y:20},{x:40,y:20}],brush_settings:{color:'#ff0000',opacity:128,size:1},connect_strokes:true});
  assert.deepEqual(await inspect('Array.from(Texture.all[0].ctx.getImageData(30,20,1,1).data)'),[255,0,0,128]);
  await inspect('Undo.undo();true');assert.equal((await inspect('Array.from(Texture.all[0].ctx.getImageData(30,20,1,1).data)'))[3],0);await inspect('Undo.redo();true');
  await call('paint_with_brush',{texture_id:'paint',coordinates:[{x:50,y:20}],brush_settings:{color:'#0000ff',opacity:0,size:1}});
  assert.equal(await inspect('Texture.all[0].ctx.getImageData(50,20,1,1).data[3]'),0);
  await call('paint_with_brush',{texture_id:'paint',coordinates:[{x:50,y:20}],brush_settings:{color:'#0000ff',opacity:255,size:1}});
  assert.deepEqual(await inspect('Array.from(Texture.all[0].ctx.getImageData(50,20,1,1).data)'),[0,0,255,255]);
  await call('paint_with_brush',{texture_id:'paint',coordinates:[{x:50,y:20}],brush_settings:{color:'#ff0000',opacity:255,size:1,blend_mode:'multiply'}});
  assert.deepEqual(await inspect('Array.from(Texture.all[0].ctx.getImageData(50,20,1,1).data)'),[0,0,0,255]);
  await call('paint_settings',{paint_side_restrict:true});assert.equal(await inspect('settings.paint_side_restrict.value'),true);await call('paint_settings',{paint_side_restrict:false});
  await call('texture_selection',{texture_id:'paint',action:'select_rectangle',coordinates:{x1:20,y1:20,x2:40,y2:25}});
  assert.equal(await inspect('Boolean(Texture.all[0].selection.get(30,22))'),true);assert.equal(await inspect('Boolean(Texture.all[0].selection.get(2,2))'),false);
  await call('texture_selection',{texture_id:'paint',action:'invert_selection'});assert.equal(await inspect('Boolean(Texture.all[0].selection.get(30,22))'),false);
  await call('texture_selection',{texture_id:'paint',action:'select_all'});assert.equal(await inspect('Texture.all[0].selection.hasSelection()'),true);
  await call('texture_layer_management',{texture_id:'paint',action:'create_layer',layer_name:'colored'});
  await inspect('let l=TextureLayer.selected;l.ctx.fillStyle="#00ff00";l.ctx.fillRect(0,0,64,32);l.texture.updateLayerChanges(true);true');
  await call('texture_layer_management',{texture_id:'paint',action:'set_opacity',opacity:50});assert.equal(await inspect('TextureLayer.selected.opacity'),50);
  await call('texture_layer_management',{texture_id:'paint',action:'duplicate_layer'});assert.equal(await inspect('Texture.all[0].layers.length'),3);
  const before=await inspect('Texture.all[0].getDataURL()');
  await call('texture_layer_management',{texture_id:'paint',action:'flatten_layers'});assert.equal(await inspect('Texture.all[0].layers_enabled'),false);assert.equal(await inspect('Texture.all[0].getDataURL()'),before);
  await inspect('Undo.undo();true');assert.equal(await inspect('Texture.all[0].layers.length'),3);
 });
 await scenario('materials','bedrock',async()=>{
  for(const name of ['color_a','color_b','normal']) await call('create_texture',{name});
  await call('create_pbr_material',{name:'mat',color_texture:'color_a',normal_texture:'normal'});
  assert.equal(await inspect('TextureGroup.all.length'),1);await inspect('Undo.undo();true');assert.equal(await inspect('TextureGroup.all.length'),0);await inspect('Undo.redo();true');
  await call('assign_texture_channel',{material:'mat',texture:'color_b',channel:'color'});
  assert.equal(await inspect('TextureGroup.all[0].getTextures().filter(t=>t.pbr_channel==="color").length'),1);
  assert.equal(await inspect('Texture.all.find(t=>t.name==="color_a").group'),'');
  await inspect('Undo.undo();true');assert.equal(await inspect('TextureGroup.all[0].getTextures().find(t=>t.pbr_channel==="color").name'),'color_a');
  await call('create_pbr_material',{name:'second_mat',color_texture:'color_b'});
  await call('configure_material',{material:'mat',color_texture:'color_b'});
  assert.equal(await inspect('TextureGroup.all.find(g=>g.name==="second_mat").getTextures().length'),0);
  assert.equal(await inspect('TextureGroup.all[0].getTextures().filter(t=>t.pbr_channel==="color").length'),1);
  const material=await inspect('TextureGroup.all[0].material_config.compileForBedrock()');
  await reopen();assert.deepEqual(await inspect('TextureGroup.all[0].material_config.compileForBedrock()'),material);
 });
 await scenario('imports','bedrock',async()=>{
  const geometry={format_version:'1.12.0','minecraft:geometry':[{description:{identifier:'geometry.review',texture_width:16,texture_height:16},bones:[{name:'imported',pivot:[0,0,0],cubes:[{origin:[0,0,0],size:[4,4,4],uv:[0,0]}]}]}]};
  const original=await inspect('Project.uuid');
  await call('from_geo_json',{geojson:' \n'+JSON.stringify(geometry)});
  await inspect('window.__reviewFix.created.push(Project.uuid);true');
  assert.notEqual(await inspect('Project.uuid'),original);assert.equal(await inspect('Cube.all.length'),1);
  await call('create_texture',{name:'import_source',width:64,height:32,fill_color:'#34B6A0',layer_name:'base'});
  const data=await inspect('Texture.all[0].getDataURL()');
  await call('create_texture',{name:'imported_image',data,width:16,height:16});
  assert.deepEqual(await inspect('[Texture.all[1].width,Texture.all[1].height]'),[64,32]);
  assert.deepEqual(await inspect('Array.from(Texture.all[1].ctx.getImageData(63,31,1,1).data)'),[52,182,160,255]);
 });
 await scenario('export_resources','free',async()=>{
  const result=JSON.parse(text(await call('export_model',{codec_id:'gltf',options:{animations:false}})));assert.equal(JSON.parse(result.content).asset.version,'2.0');assert.equal(result.byte_length,Buffer.byteLength(result.content));
  for(const uri of ['projects://','textures://','validator://checks']) {const resource=await rpc('resources/read',{uri});assert(resource.contents.length);}
  const list=await rpc('tools/list');assert(list.tools.every(t=>t.annotations));
  const active=await inspect('Project.uuid');
  const original=await inspect('window.__reviewFix.project.uuid');
  await call('capture_screenshot',{project:original});assert.equal(await inspect('Project.uuid'),active);
  await inspect('window.__reviewFix.project.select();true');
  await call('capture_screenshot',{project:active});assert.equal(await inspect('Project.uuid'),original);
  await inspect(`ModelProject.all.find(p=>p.uuid===${JSON.stringify(active)}).select();true`);
 });
}finally{
 const cleanup=await inspect('(async()=>{let s=window.__reviewFix;for(let id of s.created){let p=ModelProject.all.find(p=>p.uuid===id);if(p){p.select();await p.close(true);}}s.project.select();settings.paint_side_restrict.set(s.paintSide);Settings.save();if(s.mode)s.mode.select();if(s.tool)s.tool.select();let result={model:Codecs.project.compile()===s.model,history:Undo.index===s.index&&Undo.history.length===s.history.length&&Undo.history.every((h,i)=>h===s.history[i]),saved:Project.saved===s.saved,projects:ModelProject.all.map(p=>p.name)};delete window.__reviewFix;return result;})()');record('cleanup',{pass:cleanup.model&&cleanup.history&&cleanup.saved,...cleanup});
}
if(results.some(r=>!r.pass))process.exitCode=1;
