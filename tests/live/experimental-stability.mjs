// Run with the locally built plugin loaded. Creates and closes only test projects.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { connect, call as mcpCall, inspect } from './client.mjs';
async function call(name, args) {
  try { return await mcpCall(name,args); }
  catch(error) { throw new Error(`${name}: ${error.message}`, {cause:error}); }
}

mkdirSync('.verification', {recursive:true});
const server = await connect();
assert.equal(server.serverInfo.version, JSON.parse(readFileSync('package.json')).version, 'Load the current build before testing');
const results = [];
const text = r => r.content.find(c => c.type === 'text')?.text;
const json = async (name, args) => JSON.parse(text(await call(name, args)));
const undo = async () => { await call('undo'); };
const redo = async () => { await call('redo'); };
async function fails(name,args) {
  const before = await inspect('({index:Undo.index,length:Undo.history.length,pending:!!Undo.current_save,model:Codecs.project.compile()})');
  await assert.rejects(()=>call(name,args));
  assert.deepEqual(await inspect('({index:Undo.index,length:Undo.history.length,pending:!!Undo.current_save,model:Codecs.project.compile()})'), before, name+' must fail without edits');
}
await inspect('window.__stability={active:Project,mode:Modes.selected,tool:Toolbox.selected,originals:[],created:[],presets:structuredClone(StateMemory.brush_presets),color:ColorPanel.get(),secondary:ColorPanel.get(true)};for(let p of ModelProject.all){p.select();window.__stability.originals.push({project:p,model:Codecs.project.compile(),saved:p.saved,index:Undo.index,history:Undo.history.slice()});}window.__stability.active?.select();true');
const provenance = await inspect('({blockbench:Blockbench.version,plugin:Plugins.all.filter(p=>p.id==="mcp").map(p=>({path:p.path,version:p.version})),originalProjects:window.__stability.originals.length})');
writeFileSync('.verification/stability-project-snapshots.json', JSON.stringify(await inspect('window.__stability.originals.map(o=>({uuid:o.project.uuid,model:o.model,saved:o.saved,index:o.index}))')));
async function scenario(name,format,run) {
  if (process.env.STABILITY_SCENARIO && process.env.STABILITY_SCENARIO !== name) return;
  try {
    await call('create_project',{name:'stability_'+name,format});
    await inspect('window.__stability.created.push(Project.uuid);true');
    await run();
    results.push({name,pass:true});
  } catch(error) { results.push({name,pass:false,error:error.stack??String(error)}); }
  finally {
    await inspect('(async()=>{for(let p of [...ModelProject.all])if(window.__stability.created.includes(p.uuid))await p.close(true);window.__stability.active?.select();return true;})()');
    console.log(JSON.stringify(results.at(-1)));
  }
}
async function reopen() {
  await inspect('(async()=>{let data=JSON.parse(Codecs.project.compile());Codecs.project.load(data,{path:"stability.bbmodel",no_file:true});window.__stability.created.push(Project.uuid);await Promise.all(Texture.all.flatMap(t=>[t.img,...t.layers.map(l=>l.img)]).map(img=>img.complete?Promise.resolve():new Promise(r=>img.addEventListener("load",r,{once:true}))));await new Promise(r=>setTimeout(r,100));return true;})()');
}
const meshFixture = 'let m=new Mesh({name:"target",vertices:{a:[0,0,0],b:[4,0,0],c:[4,4,0],d:[0,4,0]},faces:{}}).init();m.addFaces(new MeshFace(m,{vertices:["a","b","c","d"],uv:{a:[0,0],b:[4,0],c:[4,4],d:[0,4]}}));';
try {
  await scenario('elements_materials_history','bedrock_block',async()=>{
    await call('add_group',{name:'parent',origin:[0,0,0],rotation:[0,0,0]});
    await call('place_cube',{elements:[{name:'cube'}],group:'parent'});
    await call('rename_element',{id:'cube',new_name:'renamed'});
    assert.equal(await inspect('Cube.all[0].name'),'renamed'); await undo(); assert.equal(await inspect('Cube.all[0].name'),'cube'); await redo();
    await call('duplicate_element',{id:'parent',newName:'copy',offset:[2,3,4]});
    assert.equal(await inspect('Group.all.length'),2); await undo(); assert.equal(await inspect('Group.all.length'),1); await redo();
    await call('remove_element',{id:'copy'}); assert.equal(await inspect('Cube.all.length'),1); await undo(); assert.equal(await inspect('Cube.all.length'),2); await redo();
    await call('set_face_material_instance',{cube_id:'renamed',faces:['north'],material_name:'__proto__'});
    assert.equal(await inspect('Cube.all[0].faces.north.material_name'),'__proto__');
    assert.equal((await json('list_material_instances')).material_instances[0].name,'__proto__');
    await call('bulk_set_material_instances',{assignments:[{cube_id:'renamed',faces:['south'],material_name:'stone'}]});
    await fails('bulk_set_material_instances',{assignments:[{cube_id:'renamed',faces:['north'],material_name:'bad'},{cube_id:'missing',faces:['north'],material_name:'bad'}]});
    await reopen(); assert.equal(await inspect('Cube.all[0].faces.north.material_name'),'__proto__');
    await call('clear_material_instances',{all_cubes:true}); assert.equal(await inspect('Cube.all[0].faces.north.material_name'),''); await undo(); assert.equal(await inspect('Cube.all[0].faces.north.material_name'),'__proto__'); await redo();
    await inspect('Project.saved=true;true');
    const checkpoint = await json('save_checkpoint',{name:'marker'}); assert.equal(await inspect('Project.saved'),true);
    assert.equal((await json('get_undo_stack')).entries[0].action,checkpoint.label);
    await undo(); assert.equal(await inspect('Cube.all[0].faces.north.material_name'),''); await redo();
  });
  await scenario('mesh_uv','free',async()=>{
    await inspect(meshFixture+'let other=new Mesh({name:"other"}).init();other.select();window.__stability.other=JSON.stringify(other.getSaveCopy());true');
    const mesh = await inspect('Mesh.all[0].uuid');
    const face = await inspect('Object.keys(Mesh.all[0].faces)[0]');
    await call('set_mesh_uv',{mesh_id:mesh,face_key:face,uv_mapping:{a:[1,2]}}); assert.deepEqual(await inspect('Mesh.all[0].faces[Object.keys(Mesh.all[0].faces)[0]].uv.a'),[1,2]); await undo(); await redo();
    await fails('set_mesh_uv',{mesh_id:mesh,face_key:face,uv_mapping:{missing:[3,4]}});
    await fails('auto_uv_mesh',{mesh_id:mesh,mode:'sphere',faces:['missing']});
    for (const mode of ['project','unwrap','cylinder','sphere']) {
      const before = await inspect('JSON.stringify(Mesh.all[0].getSaveCopy())');
      const index = await inspect('Undo.index');
      await call('auto_uv_mesh',{mesh_id:mesh,mode,faces:[face]});
      assert.equal(await inspect('Undo.index'),index+1);
      assert.equal(await inspect('Object.values(Mesh.all[0].faces).every(f=>Object.values(f.uv).every(v=>v.every(Number.isFinite)))'),true);
      await undo(); assert.equal(await inspect('JSON.stringify(Mesh.all[0].getSaveCopy())'),before); await redo();
    }
    for(const angle of ['90','180','-90']) await call('rotate_mesh_uv',{mesh_id:mesh,angle,faces:[face]});
    assert.equal(await inspect('JSON.stringify(Mesh.all[1].getSaveCopy())===window.__stability.other'),true);
    await fails('create_mesh_face',{mesh_id:mesh,vertices:['a','b','missing']});
    await fails('create_mesh_face',{mesh_id:mesh,vertices:['a','a','b']});
    await call('create_mesh_face',{mesh_id:mesh,vertices:['a','b','c']}); assert.equal(await inspect('Object.keys(Mesh.all[0].faces).length'),2); await undo();
    await fails('move_mesh_vertices',{mesh_id:mesh,vertices:['a','missing'],offset:[1,0,0]});
    await call('move_mesh_vertices',{mesh_id:mesh,vertices:['a'],offset:[1,2,3]}); assert.deepEqual(await inspect('Mesh.all[0].vertices.a'),[1,2,3]); await undo();
    for(const mode of ['vertex','edge','face']) {
      await call('select_mesh_elements',{mesh_id:mesh,mode});
      assert.ok((await json('select_mesh_elements',{mesh_id:mesh,mode,action:'toggle'})).selected.vertices===0);
    }
    for(const mode of ['faces','edges','vertices']) {
      await call('select_mesh_elements',{mesh_id:mesh,mode:{faces:'face',edges:'edge',vertices:'vertex'}[mode]});
      await call('extrude_mesh',{mesh_id:mesh,mode,distance:2}); assert.ok(await inspect('Object.keys(Mesh.all[0].vertices).length>4')); await undo();
    }
    await call('select_mesh_elements',{mesh_id:mesh,mode:'face',elements:[face]});
    await call('subdivide_mesh',{mesh_id:mesh,cuts:2}); assert.equal(await inspect('Object.keys(Mesh.all[0].faces).length'),9); await undo();
    await call('delete_mesh_elements',{mesh_id:mesh,mode:'faces',keep_vertices:true}); assert.equal(await inspect('Object.keys(Mesh.all[0].faces).length'),0); await undo();
    await inspect('Mesh.all[0].vertices.extra=[0,0,0];true');
    await call('merge_mesh_vertices',{mesh_id:mesh,threshold:0,selected_only:false}); assert.equal(await inspect('Object.keys(Mesh.all[0].vertices).length'),4); await undo(); await redo();
    await call('place_mesh',{elements:[{name:'placed',vertices:[[0,0,0],[1,0,0],[0,1,0]]}]}); assert.equal(await inspect('Mesh.all.length'),3); await undo(); await redo();
    await call('create_cylinder',{elements:[{name:'cylinder',position:[0,0,0],sides:6,capped:true}]}); assert.equal(await inspect('Object.keys(Mesh.all.at(-1).faces).length'),18); await undo(); await redo();
    assert.equal(await inspect('Object.values(Mesh.all.at(-1).faces).every(f=>{let c=f.getCenter(),n=f.getNormal(true);return c.reduce((sum,v,i)=>sum+v*n[i],0)>0;})'),true,'Cylinder normals point outward');
    await reopen(); assert.equal(await inspect('Mesh.all.length'),4);
  });
  await scenario('armatures','free',async()=>{
    assert.equal(await inspect('Format.armature_rig'),true);
    await call('add_armature',{name:'rig',add_initial_bone:false});
    await call('add_armature_bone',{parent_id:'rig',name:'bone'});
    await call('add_armature_bone',{parent_id:'bone',name:'child'});
    await inspect(meshFixture+'m.addTo(Armature.all[0]);true');
    await call('update_armature_bones_batch',{ids:['bone','child'],visibility:false,locked:true,color:2});
    assert.equal(await inspect('ArmatureBone.all.every(b=>!b.visibility&&b.locked&&b.color===2)'),true); await undo(); await redo();
    await call('set_vertex_weights_batch',{bone_id:'bone',mesh_id:'target',weights:{a:0.25,b:0.75}});
    assert.equal(await inspect('ArmatureBone.all[0].getVertexWeight(Mesh.all[0],"a")'),0.25); await undo(); assert.equal(await inspect('ArmatureBone.all[0].getVertexWeight(Mesh.all[0],"a")'),0); await redo();
    await fails('set_vertex_weights_batch',{bone_id:'bone',mesh_id:'target',weights:{a:1,missing:1}});
    await inspect('ArmatureBone.all[0].vertex_weights.c=0.5;ArmatureBone.all[0].vertex_weights[Mesh.all[0].uuid.substring(0,6)+":removed"]=0.5;true');
    assert.equal((await json('clear_vertex_weights',{bone_id:'bone',mesh_id:'target'})).weightsCleared,4); assert.equal(await inspect('Object.keys(ArmatureBone.all[0].vertex_weights).length'),0); await undo(); assert.equal(await inspect('ArmatureBone.all[0].getVertexWeight(Mesh.all[0],"c")'),0.5); await redo();
    await call('remove_armature_bone',{id:'bone',remove_children:false}); assert.equal(await inspect('ArmatureBone.all[0].parent.name'),'rig'); await undo(); await redo(); await undo();
    await reopen(); assert.equal(await inspect('ArmatureBone.all.length'),2);
    await call('remove_armature_bone',{id:'bone',remove_children:true}); assert.equal(await inspect('ArmatureBone.all.length'),0); await undo();
    await call('remove_armature',{id:'rig'}); assert.equal(await inspect('Armature.all.length'),0); await undo(); assert.equal(await inspect('ArmatureBone.all.length'),2); await redo();
  });
  await scenario('animation','bedrock',async()=>{
    await call('add_group',{name:'bone',origin:[0,0,0],rotation:[0,0,0]});
    await call('create_animation',{name:'first',animation_length:2,bones:{bone:[{time:0,position:[0,0,0]},{time:1,position:[2,4,6]}]}});
    const animation = await inspect('Animation.selected.uuid');
    await call('create_animation',{name:'other',bones:{bone:[]}});
    await call('manage_keyframes',{animation_id:animation,bone_name:'bone',channel:'scale',action:'create',keyframes:[{time:0,values:[1,2,3]},{time:1,values:[4,5,6]}]});
    await fails('manage_keyframes',{animation_id:animation,bone_name:'bone',channel:'scale',action:'delete',keyframes:[{time:9}]});
    await call('manage_keyframes',{animation_id:animation,bone_name:'bone',channel:'scale',action:'edit',keyframes:[{time:0,values:[2,3,4]}]}); await undo(); await redo();
    const index = await inspect('Undo.index');
    await call('manage_keyframes',{animation_id:animation,bone_name:'bone',channel:'scale',action:'select',keyframes:[{time:0},{time:1}]});
    assert.equal(await inspect('Timeline.selected.length'),2); assert.equal(await inspect('Undo.index'),index);
    await call('animation_timeline',{action:'select_range',range:{start:0,end:1}}); assert.ok(await inspect('Timeline.selected.length>=4'));
    await fails('animation_timeline',{action:'set_length',length:-1});
    for(const [action,extra,expression,expected] of [
      ['set_length',{length:3},'Animation.selected.length',3],['set_fps',{fps:30},'Animation.selected.snapping',30],['loop',{loop_mode:'hold'},'Animation.selected.loop','hold']
    ]) {
      const before=await inspect(expression); await call('animation_timeline',{action,...extra}); assert.equal(await inspect(expression),expected); await undo(); assert.equal(await inspect(expression),before); await redo();
    }
    await call('animation_timeline',{action:'set_time',time:0.5}); assert.equal(await inspect('Timeline.time'),0.5);
    await call('animation_timeline',{action:'play'}); await call('animation_timeline',{action:'pause'}); await call('animation_timeline',{action:'stop'}); assert.equal(await inspect('Timeline.time'),0);
    await call('manage_keyframes',{animation_id:animation,bone_name:'bone',channel:'scale',action:'delete',keyframes:[{time:1}]}); await undo();
    await call('manage_keyframes',{animation_id:animation,bone_name:'bone',channel:'rotation',action:'create',keyframes:[{time:0,values:[10,20,30],interpolation:'bezier',bezier_handles:{right_value:[1,2,3]}}]});
    await inspect('Animation.all[0].animators[Group.all[0].uuid].rotation[0].data_points[0].x="query.anim_time+10";true');
    await call('animation_copy_paste',{action:'copy',source:{animation,bone:'bone'}});
    await inspect('Animation.all[0].animators[Group.all[0].uuid].rotation[0].bezier_right_value[0]=999;true');
    const destination=await inspect('Animation.all[1].uuid');
    await call('animation_copy_paste',{action:'paste',target:{animation:destination,bone:'bone'}});
    assert.deepEqual(await inspect('Animation.all[1].animators[Group.all[0].uuid].rotation[0].bezier_right_value'),[1,2,3]);
    assert.equal(await inspect('Animation.all[1].animators[Group.all[0].uuid].rotation[0].get("x")'),'query.anim_time+10'); await undo(); await redo();
    await call('animation_copy_paste',{action:'mirror_paste',target:{animation:destination,bone:'bone',mirror_axis:'x'}});
    assert.deepEqual(await inspect('Animation.all[1].animators[Group.all[0].uuid].rotation[0].bezier_right_value'),[1,-2,-3]);
    assert.deepEqual(await inspect('Animation.all[1].animators[Group.all[0].uuid].rotation[0].getArray().slice(1)'),[-20,-30]);
    await fails('animation_copy_paste',{action:'paste',target:{animation:destination,bone:'bone',time_offset:-100}});
    await reopen(); assert.equal(await inspect('Animation.all[0].snapping'),30);
  });
  await scenario('textures_layers_brush','free',async()=>{
    await call('create_texture',{name:'color',width:32,height:16,fill_color:'#ff0000',layer_name:'base'});
    await call('create_texture',{name:'normal',width:32,height:16,fill_color:'#8080ff',layer_name:'base'});
    await call('add_texture_group',{name:'group',textures:['normal']}); await undo(); await redo();
    await call('create_pbr_material',{name:'mat',color_texture:'color',normal_texture:'normal'});
    assert.equal((await json('get_material_info',{material:'mat'})).textures.length,2); await undo(); await redo();
    await call('configure_material',{material:'mat',mer_value:[128,0,32]});
    assert.deepEqual((await json('get_material_info',{material:'mat'})).config.mer_value,[128,0,32]); await undo(); await redo();
    await call('assign_texture_channel',{material:'mat',texture:'normal',channel:'height'}); assert.equal(await inspect('Texture.all[1].pbr_channel'),'height'); await undo(); await redo();
    await call('paint_with_brush',{texture_id:'color',coordinates:[{x:1,y:1},{x:5,y:1}],brush_settings:{color:'#00ff00',size:1,opacity:255},connect_strokes:true});
    assert.deepEqual(await inspect('Array.from(Texture.all[0].getActiveCanvas().ctx.getImageData(3,1,1,1).data)'),[0,255,0,255]); await undo(); assert.deepEqual(await inspect('Array.from(Texture.all[0].getActiveCanvas().ctx.getImageData(3,1,1,1).data)'),[255,0,0,255]); await redo();
    await call('texture_layer_management',{texture_id:'color',action:'create_layer',layer_name:'top'});
    await call('paint_with_brush',{texture_id:'color',coordinates:[{x:3,y:3}],brush_settings:{color:'#0000ff',size:3,softness:50,shape:'circle',opacity:128}});
    await call('texture_layer_management',{texture_id:'color',action:'duplicate_layer'}); assert.equal(await inspect('Texture.all[0].layers.length'),3); await undo(); await redo();
    for(const args of [{action:'set_opacity',opacity:50},{action:'set_blend_mode',blend_mode:'multiply'},{action:'rename_layer',layer_name:'renamed'},{action:'move_layer',target_index:1}]) { await call('texture_layer_management',{texture_id:'color',...args}); await undo(); await redo(); }
    await call('texture_layer_management',{texture_id:'color',action:'merge_down'}); assert.equal(await inspect('Texture.all[0].layers.length'),2); await undo(); await redo();
    await call('texture_layer_management',{texture_id:'color',action:'delete_layer'}); assert.equal(await inspect('Texture.all[0].layers.length'),1); await undo();
    await reopen(); assert.equal(await inspect('Texture.all[0].layers.length'),2);
    await call('texture_layer_management',{texture_id:'color',action:'flatten_layers'}); assert.equal(await inspect('Texture.all[0].layers_enabled'),false); await undo(); assert.equal(await inspect('Texture.all[0].layers.length'),2); await redo();
    await call('create_brush_preset',{name:'stability_temporary',color:'#345678',size:3,opacity:123,softness:20,shape:'square',blend_mode:'default'});
    await call('load_brush_preset',{preset_name:'stability_temporary'}); assert.equal((await inspect('ColorPanel.get()')).toLowerCase(),'#345678');
    const primary = await inspect('ColorPanel.get()');
    const picked = text(await call('color_picker_tool',{texture_id:'normal',x:0,y:0,set_as_secondary:true,pick_opacity:true}));
    assert.ok(picked.includes('255')); assert.equal(await inspect('ColorPanel.get()'),primary); assert.equal((await inspect('ColorPanel.get(true)')).toLowerCase(),'#8080ff');
  });
  await scenario('dialogs_actions','free',async()=>{
    assert.equal(await inspect('Dialog.open===undefined||Dialog.open===null'),true,'Close unrelated dialogs before this suite');
    await inspect('window.__stability.action=new Action("stability_action",{name:"Stability",click(){window.__stability.clicked=true;}});window.__stability.dialog=new Dialog({id:"stability_dialog",title:"Stability",form:{name:{type:"text",value:"before"}},onConfirm(values){window.__stability.form=values;this.hide();}}).show();true');
    try {
      await call('trigger_action',{action:'stability_action'}); assert.equal(await inspect('window.__stability.clicked'),true); assert.equal(await inspect('Dialog.open.id'),'stability_dialog');
      await assert.rejects(()=>call('fill_dialog',{values:'null'})); assert.equal(await inspect('Dialog.open.id'),'stability_dialog');
      await call('fill_dialog',{values:JSON.stringify({name:'after'})}); assert.equal(await inspect('window.__stability.form.name'),'after');
      await inspect('window.__stability.action.click=()=>new Dialog({id:"stability_new",title:"Stability",form:{value:{type:"text",value:"new"}},onConfirm(values){window.__stability.form=values;this.hide();}}).show();true');
      await call('trigger_action',{action:'stability_action'}); assert.equal(await inspect('window.__stability.form.value'),'new');
      await inspect('window.__stability.action.condition=()=>false;true'); await assert.rejects(()=>call('trigger_action',{action:'stability_action'}));
    } finally { await inspect('window.__stability.action.delete();for(let d of [...Dialog.stack])if(d.id.startsWith("stability_"))d.hide();true'); }
  });
  await scenario('camera_export','free',async()=>{
    await call('place_cube',{elements:[{name:'cube'}]});
    for(const projection of ['orthographic','perspective','unset']) {
      const result=await call('set_camera_angle',{position:[32,24,32],target:[0,0,0],projection}); assert.ok(result.content.some(c=>c.type==='image'&&c.data.length>100));
      assert.deepEqual(await inspect('Preview.selected.controls.target.toArray()'),[0,0,0]);
    }
    await call('set_camera_angle',{position:[0,0,32],rotation:[0,90,0],projection:'perspective'});
    assert.deepEqual((await inspect('Preview.selected.controls.target.toArray()')).map(Math.round),[16,0,32]);
    const model=await json('export_model',{codec_id:'project'}); assert.equal(JSON.parse(model.content).elements[0].name,'cube');
    assert.equal((await json('export_model',{codec_id:'project',max_content_length:10})).content.length,10);
    await fails('export_model',{codec_id:'missing'});
  });
} finally {
  const preserved = await inspect('(async()=>{let s=window.__stability;for(let p of [...ModelProject.all])if(s.created.includes(p.uuid))await p.close(true);let issues=[];for(let o of s.originals){o.project.select();if(Codecs.project.compile()!==o.model||o.project.saved!==o.saved||Undo.index!==o.index||Undo.history.length!==o.history.length||Undo.history.some((h,i)=>h!==o.history[i]))issues.push(o.project.uuid);}StateMemory.brush_presets.splice(0,StateMemory.brush_presets.length,...s.presets);StateMemory.save("brush_presets");ColorPanel.set(s.color);ColorPanel.set(s.secondary,true);s.active?.select();s.mode?.select();s.tool?.select();return {issues,projects:ModelProject.all.length};})()');
  results.push({name:'preserve_existing_projects',pass:preserved.issues.length===0,...preserved});
  const report={...provenance,server,sha256:createHash('sha256').update(readFileSync('dist/mcp.js')).digest('hex'),results};
  writeFileSync('.verification/experimental-stability-live.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(results.at(-1)));
  await inspect('delete window.__stability;true');
}
if(results.some(r=>!r.pass))process.exitCode=1;
