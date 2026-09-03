import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {connect,call,inspect} from './client.mjs';
mkdirSync('.verification',{recursive:true});
const server=await connect(), results=[];
assert.equal(server.serverInfo.version,JSON.parse(readFileSync('package.json')).version);
const runtime=await inspect('({version:Blockbench.version,path:Plugins.all.find(p=>p.id==="mcp").path,source:Plugins.all.find(p=>p.id==="mcp").source})');
assert.equal(runtime.source,'file');assert.equal(resolve(runtime.path),resolve('dist/mcp.js'));
await inspect('window.__remaining={active:Project,mode:Modes.selected,tool:Toolbox.selected,color:ColorPanel.get(),secondary:ColorPanel.get(true),settings:Object.fromEntries(Object.entries(settings).map(([k,v])=>[k,v.value])),toolSettings:Object.fromEntries(Object.entries(BarItems).filter(([k,v])=>v.tool_settings).map(([k,v])=>[k,structuredClone(v.tool_settings)])),barValues:Object.fromEntries(["mirror_painting","pixel_perfect_drawing","color_erase_mode","draw_shape_type","blend_mode","copy_brush_mode","brush_shape"].map(k=>[k,BarItems[k]?.value])),mirror:structuredClone(Painter.mirror_painting_options),mirrorEnabled:Painter.mirror_painting,lock:Painter.lock_alpha,erase:Painter.erase_mode,created:[],originals:[]};for(let p of ModelProject.all){p.select();window.__remaining.originals.push({p,model:Codecs.project.compile(),saved:p.saved,index:Undo.index,history:Undo.history.slice()});}window.__remaining.active?.select();true');
const record=(name,extra)=>{results.push({name,...extra});console.log(JSON.stringify(results.at(-1)));};
const evalCode=code=>inspect(code);
const undo=()=>call('undo'), redo=()=>call('redo');
async function invalid(name,args){const before=await inspect('({model:Codecs.project.compile(),index:Undo.index,length:Undo.history.length,pending:!!Undo.current_save})');await assert.rejects(()=>call(name,args));assert.deepEqual(await inspect('({model:Codecs.project.compile(),index:Undo.index,length:Undo.history.length,pending:!!Undo.current_save})'),before);}
async function scenario(name,format,fn){
  if(process.env.REMAINING_SCENARIO&&process.env.REMAINING_SCENARIO!==name)return;
  try {await call('create_project',{name:'remaining_'+name,format});await inspect('window.__remaining.created.push(Project.uuid);true');await fn();record(name,{pass:true});}
  catch(error){record(name,{pass:false,error:error.stack??String(error)});}
  finally{await inspect('(async()=>{if(Undo.current_save)Undo.cancelEdit();for(let p of [...ModelProject.all])if(window.__remaining.created.includes(p.uuid))await p.close(true);window.__remaining.active?.select();return true;})()');}
}
const pixel=(x,y)=>inspect(`Array.from(Texture.all[0].getActiveCanvas().ctx.getImageData(${x},${y},1,1).data)`);
async function texture(){await call('create_texture',{name:'pixels',width:16,height:16,fill_color:'#ffffff',layer_name:'base'});await inspect('Modes.options.paint.select();Painter.lock_alpha=false;Painter.erase_mode=false;Painter.mirror_painting=false;settings.paint_with_stylus_only.set(false);Texture.all[0].selection.setOverride(true);true');}
async function paintUndo(fn){const before=await inspect('({pixels:Array.from(Texture.all[0].getActiveCanvas().ctx.getImageData(0,0,16,16).data),index:Undo.index})');await fn();assert.equal(await inspect('!!Undo.current_save'),false);assert.equal(await inspect('Undo.index'),before.index+1);const after=await inspect('Array.from(Texture.all[0].getActiveCanvas().ctx.getImageData(0,0,16,16).data)');await undo();assert.deepEqual(await inspect('Array.from(Texture.all[0].getActiveCanvas().ctx.getImageData(0,0,16,16).data)'),before.pixels);await redo();assert.deepEqual(await inspect('Array.from(Texture.all[0].getActiveCanvas().ctx.getImageData(0,0,16,16).data)'),after);}
try{
  await scenario('paint_settings','free',async()=>{
    await call('paint_settings',{mirror_painting:{enabled:true,axis:['x','z'],texture:true,texture_center:{x:8,y:9}}});
    await call('paint_settings',{mirror_painting:{enabled:false,axis:['y'],texture:false}});
    assert.deepEqual(await inspect('({enabled:Painter.mirror_painting,x:Painter.mirror_painting_options.x,y:Painter.mirror_painting_options.y,z:Painter.mirror_painting_options.z,texture:Painter.mirror_painting_options.texture,center:Painter.mirror_painting_options.texture_center})'),{enabled:false,x:false,y:true,z:false,texture:false,center:[8,9]});
    await call('paint_settings',{mirror_painting:{enabled:true,axis:[]}});assert.equal(await inspect('["x","y","z"].some(k=>Painter.mirror_painting_options[k])'),false);
    for(const value of [true,false]){
      await call('paint_settings',{lock_alpha:value,pixel_perfect:value,color_erase_mode:value,paint_side_restrict:value,paint_with_stylus_only:value,pick_color_opacity:value,pick_combined_color:value,brush_opacity_modifier:value?'pressure':'none',brush_size_modifier:value?'tilt':'none'});
      assert.equal(await inspect('Painter.lock_alpha'),value);assert.equal(await inspect('Painter.erase_mode'),value);
      assert.equal(await inspect('settings.pick_combined_color.value'),value);assert.equal(await inspect('BarItems.pixel_perfect_drawing.value'),value);
    }
  });
  await scenario('native_paint','free',async()=>{
    await texture();
    for(const shape of ['rectangle','rectangle_h','ellipse','ellipse_h']) await paintUndo(()=>call('draw_shape_tool',{texture_id:'pixels',shape,start:{x:2,y:2},end:{x:12,y:12},color:'#ff0000',line_width:2,opacity:255,blend_mode:'default'}));
    assert.deepEqual(await pixel(7,7),[255,0,0,255]);
    await paintUndo(()=>call('eraser_tool',{texture_id:'pixels',coordinates:[{x:2,y:2},{x:10,y:2}],brush_size:1,opacity:255,softness:0,shape:'square',connect_strokes:false}));
    assert.equal((await pixel(2,2))[3],0);assert.equal((await pixel(6,2))[3],255);
    await paintUndo(()=>call('eraser_tool',{texture_id:'pixels',coordinates:[{x:2,y:3},{x:10,y:3}],brush_size:1,opacity:255,softness:0,shape:'square',connect_strokes:true}));assert.equal((await pixel(6,3))[3],0);
    await paintUndo(()=>call('eraser_tool',{texture_id:'pixels',coordinates:[{x:7,y:7}],brush_size:5,opacity:128,softness:50,shape:'circle'}));assert.ok((await pixel(7,7))[3]<255);
    const beforeZero = await pixel(0,0); await paintUndo(()=>call('eraser_tool',{texture_id:'pixels',coordinates:[{x:0,y:0}],brush_size:1,opacity:0,softness:0}));assert.deepEqual(await pixel(0,0),beforeZero);
    for(const mode of ['copy','sample','pattern']){
      await call('paint_with_brush',{texture_id:'pixels',coordinates:[{x:1,y:1}],brush_settings:{color:'#00ff00',size:1}});
      await inspect('BarItems.copy_brush.tool_settings.brush_softness=0;BarItems.copy_brush.tool_settings.brush_shape="square";true');
      await paintUndo(()=>call('copy_brush_tool',{texture_id:'pixels',source:{x:1,y:1},target:{x:14,y:14},brush_size:1,opacity:255,mode}));
      if(mode!=='pattern')assert.deepEqual(await pixel(14,14),[0,255,0,255]);
    }
    await invalid('eraser_tool',{coordinates:[],brush_size:1,opacity:255,softness:0});
    await invalid('draw_shape_tool',{shape:'rectangle',start:{x:-1,y:0},end:{x:1,y:1},color:'#ff0000',opacity:255});
    await inspect('settings.paint_with_stylus_only.set(true);true');await invalid('draw_shape_tool',{shape:'rectangle',start:{x:0,y:0},end:{x:1,y:1},color:'#ff0000',opacity:255});await inspect('settings.paint_with_stylus_only.set(false);true');
  });
  await scenario('gradient','free',async()=>{
    await texture();
    await paintUndo(()=>call('gradient_tool',{texture_id:'pixels',start:{x:0,y:0},end:{x:10,y:0},start_color:'#ff0000',end_color:'#0000ff',opacity:255}));
    assert.deepEqual(await pixel(0,0),[255,0,0,255]);assert.deepEqual(await pixel(10,0),[0,0,255,255]);assert.deepEqual(await pixel(5,0),[128,0,128,255]);
    await call('texture_selection',{texture_id:'pixels',action:'select_rectangle',coordinates:{x1:0,y1:0,x2:3,y2:3}});
    await paintUndo(()=>call('gradient_tool',{texture_id:'pixels',start:{x:0,y:0},end:{x:10,y:0},start_color:'#00ff00',end_color:'#00ff00',opacity:255}));assert.deepEqual(await pixel(0,0),[0,255,0,255]);assert.deepEqual(await pixel(10,0),[0,0,255,255]);
    for(const blend_mode of ['default','set_opacity','color','behind','multiply','add','screen','overlay','difference'])await paintUndo(()=>call('gradient_tool',{texture_id:'pixels',start:{x:0,y:0},end:{x:10,y:0},start_color:'#123456',end_color:'#fedcba',opacity:128,blend_mode}));
    await paintUndo(()=>call('gradient_tool',{texture_id:'pixels',start:{x:0,y:0},end:{x:10,y:0},start_color:'#123456',end_color:'#fedcba',opacity:0,blend_mode:'set_opacity'}));assert.equal((await pixel(0,0))[3],0);await undo();
    await invalid('gradient_tool',{start:{x:0,y:0},end:{x:0,y:0},start_color:'#fff',end_color:'#000',opacity:255});
    await invalid('gradient_tool',{start:{x:0,y:0},end:{x:1,y:0},start_color:'bad!',end_color:'#000',opacity:255});
    await call('texture_selection',{action:'select_all'});await inspect('Texture.all[0].selected_layer.offset=[2,3];true');
    await call('gradient_tool',{start:{x:2,y:3},end:{x:12,y:3},start_color:'#ff0000',end_color:'#0000ff',opacity:255});assert.deepEqual(await pixel(0,0),[255,0,0,255]);assert.deepEqual(await pixel(10,0),[0,0,255,255]);
  });
  await scenario('batch_and_curves','bedrock',async()=>{
    for(const name of ['first','hidden'])await call('add_group',{name,origin:[0,0,0],rotation:[0,0,0]});
    await call('create_animation',{name:'curves',animation_length:4,bones:{first:[{time:0,position:[0,0,0]},{time:2,position:[10,20,30]}],hidden:[{time:0,position:[1,2,3]},{time:2,position:[4,5,6]}]}});
    const sample=time=>inspect(`(()=>{Timeline.time=${time};return Animation.selected.animators[Group.all[0].uuid].interpolate("position",false);})()`);
    for(const [action,atHalf]of [['linear',5],['ease_in',3.153568],['ease_out',6.846432],['ease_in_out',5],['smooth',5],['stepped',0],['custom',5]]){
      const args={bone_name:'first',channel:'position',action,...(action==='custom'?{custom_curve:{control_point_1:[1/3,1/3],control_point_2:[2/3,2/3]}}:{})};
      await call('animation_graph_editor',args);assert.ok(Math.abs((await sample(1))[0]+atHalf)<0.08,action+JSON.stringify(await sample(1))+JSON.stringify(await inspect('Animation.selected.animators[Group.all[0].uuid].keyframes.map(k=>k.getUndoCopy())')));await undo();await redo();
    }
    await invalid('animation_graph_editor',{bone_name:'first',channel:'position',action:'custom',custom_curve:{control_point_1:[-1,0],control_point_2:[1,1]}});
    await invalid('animation_graph_editor',{bone_name:'first',channel:'position',action:'smooth',keyframe_range:{start:4,end:2}});
    await call('animation_graph_editor',{bone_name:'first',channel:'position',action:'custom',axis:'y',custom_curve:{control_point_1:[0.2,-0.1],control_point_2:[0.8,1.1]}});assert.equal(await inspect('Animation.selected.animators[Group.all[0].uuid].position[0].bezier_right_time[0]'),2/3);await undo();
    await inspect('Animation.selected.animators[Group.all[0].uuid].position[0].set("x","query.anim_time");true');
    await invalid('animation_graph_editor',{bone_name:'first',channel:'position',action:'ease_in'});
    await call('animation_graph_editor',{bone_name:'first',channel:'position',action:'linear'});assert.equal(await inspect('Animation.selected.animators[Group.all[0].uuid].position[0].get("x")'),'query.anim_time');await inspect('Animation.selected.animators[Group.all[0].uuid].position[0].set("x",0);true');
    await call('manage_keyframes',{bone_name:'first',channel:'position',action:'select',keyframes:[{time:0}]});
    await invalid('batch_keyframe_operations',{selection:'selected',operation:'offset',parameters:{offset_time:2}});
    await call('batch_keyframe_operations',{selection:'selected',operation:'offset',parameters:{offset_values:[1,0,0]}});assert.equal(await inspect('Animation.selected.animators[Group.all[1].uuid].position[0].get("x")'),-1);await undo();
    await call('animation_graph_editor',{bone_name:'first',channel:'position',action:'ease_in'});
    const sampleBefore=await sample(0.5);
    await inspect('Timeline.animators.empty();true');
    await call('batch_keyframe_operations',{selection:'all',operation:'scale',parameters:{scale_factor:2}});assert.deepEqual(await inspect('Object.values(Animation.selected.animators).map(a=>a.keyframes.map(k=>k.time))'),[[0,4],[0,4]]);assert.ok(Math.abs((await sample(1))[0]-sampleBefore[0])<0.02);await undo();await redo();
    await call('batch_keyframe_operations',{selection:'all',operation:'reverse'});assert.ok(Math.abs((await sample(3))[0]-sampleBefore[0])<0.02);await undo();await redo();
    await call('batch_keyframe_operations',{selection:'all',operation:'mirror',parameters:{mirror_axis:'x'}});assert.ok((await sample(3))[0]>0);await undo();await redo();
    await invalid('batch_keyframe_operations',{selection:'all',operation:'offset',parameters:{offset_time:-100}});
    await invalid('batch_keyframe_operations',{selection:'all',operation:'mirror'});
    await invalid('batch_keyframe_operations',{selection:'all',operation:'scale',parameters:{scale_factor:0}});
    await call('batch_keyframe_operations',{selection:'pattern',pattern:{interval:4,offset:0},operation:'offset',parameters:{offset_time:1,offset_values:[1,2,3]}});assert.deepEqual(await inspect('Object.values(Animation.selected.animators).map(a=>a.keyframes.map(k=>k.time).sort())'),[[1,5],[1,5]]);await undo();
    await call('batch_keyframe_operations',{selection:'all',operation:'smooth'});await undo();
    await call('batch_keyframe_operations',{selection:'range',range:{start:0,end:4},operation:'bake',parameters:{bake_interval:1}});assert.equal(await inspect('Object.values(Animation.selected.animators).reduce((n,a)=>n+a.keyframes.length,0)'),10);await undo();await redo();
    await inspect('(async()=>{let data=JSON.parse(Codecs.project.compile());Codecs.project.load(data,{path:"remaining-curves.bbmodel",no_file:true});window.__remaining.created.push(Project.uuid);return true;})()');assert.equal(await inspect('Object.values(Animation.all[0].animators).reduce((n,a)=>n+a.keyframes.length,0)'),10);
  });
  await scenario('material_save','free',async()=>{
    await texture();await call('create_pbr_material',{name:'material',color_texture:'pixels'});
    await invalid('save_material_config',{material:'material'});
    const target=resolve('.verification/remaining-material.png').replaceAll('\\','/');
    await inspect(`Texture.all[0].path=${JSON.stringify(target)};true`);
    await call('save_material_config',{material:'material'});
    const saved=JSON.parse(readFileSync(target.replace('.png','.texture_set.json'),'utf8'));assert.ok(saved['minecraft:texture_set']);assert.equal(await inspect('TextureGroup.all[0].material_config.saved'),true);
    await inspect(`Texture.all[0].path=${JSON.stringify(target.replace('remaining-material.png','absent-directory/remaining-material.png'))};TextureGroup.all[0].material_config.saved=false;true`);await invalid('save_material_config',{material:'material'});assert.equal(await inspect('TextureGroup.all[0].material_config.saved'),false);
  });
  await scenario('fill_and_selection','free',async()=>{
    await texture();
    await inspect('let t=Texture.all[0],c=t.getActiveCanvas().ctx;c.fillStyle="rgb(100,0,0)";c.fillRect(0,0,5,16);c.fillStyle="rgb(110,0,0)";c.fillRect(5,0,5,16);c.fillStyle="rgb(100,0,0)";c.fillRect(13,0,3,16);t.updateLayerChanges(true);true');
    await paintUndo(()=>call('paint_fill_tool',{texture_id:'pixels',x:0,y:0,color:'#00ff00',opacity:255,tolerance:4,fill_mode:'color_connected'}));
    assert.deepEqual(await pixel(7,0),[0,255,0,255]);assert.deepEqual(await pixel(14,0),[100,0,0,255]);await undo();
    await paintUndo(()=>call('paint_fill_tool',{texture_id:'pixels',x:0,y:0,color:'#00ff00',opacity:255,tolerance:0,fill_mode:'color'}));assert.deepEqual(await pixel(14,0),[0,255,0,255]);assert.deepEqual(await pixel(7,0),[110,0,0,255]);
    const history=await inspect('Undo.index');
    await call('texture_selection',{action:'select_rectangle',coordinates:{x1:1,y1:1,x2:4,y2:4}});assert.equal(await inspect('Texture.all[0].selection.get(2,2)'),1);assert.equal(await inspect('Texture.all[0].selection.get(4,4)'),0);
    for(const mode of ['add','subtract','intersect','create'])await call('texture_selection',{action:'select_ellipse',coordinates:{x1:0,y1:0,x2:8,y2:8},mode});
    for(const action of ['expand_selection','contract_selection'])await call('texture_selection',{action,radius:1});
    await call('texture_selection',{action:'invert_selection'});await call('texture_selection',{action:'clear_selection'});assert.equal(await inspect('Texture.all[0].selection.get(0,0)'),false);
    await call('texture_selection',{action:'select_all'});assert.equal(await inspect('Texture.all[0].selection.get(15,15)'),true);assert.equal(await inspect('Undo.index'),history);
    await invalid('texture_selection',{action:'feather_selection',radius:3});await invalid('texture_selection',{action:'expand_selection',radius:-1});
    for(const fill_mode of ['selection','face','element','selected_elements'])await paintUndo(()=>call('paint_fill_tool',{texture_id:'pixels',x:1,y:1,color:'#123456',opacity:128,fill_mode,blend_mode:'default'}));
    await inspect('Texture.all[0].selected_layer.offset=[2,3];true');
    await call('paint_fill_tool',{texture_id:'pixels',x:2,y:3,color:'#abcdef',opacity:255,tolerance:100,fill_mode:'color_connected'});assert.deepEqual(await pixel(0,0),[171,205,239,255]);
  });
  await scenario('texture_set_import','free',async()=>{
    await texture();
    const directory=resolve('.verification/remaining-import');mkdirSync(directory,{recursive:true});
    const png=Buffer.from((await inspect('Texture.all[0].getDataURL()')).split(',')[1],'base64');writeFileSync(resolve(directory,'color.png'),png);
    const tga=Buffer.alloc(18+16*16*3);tga[2]=2;tga.writeUInt16LE(16,12);tga.writeUInt16LE(16,14);tga[16]=24;tga[17]=32;for(let i=18;i<tga.length;i+=3){tga[i]=255;tga[i+1]=128;tga[i+2]=128;}writeFileSync(resolve(directory,'normal.tga'),tga);
    const file=resolve(directory,'fixture.texture_set.json');
    const payload={'minecraft:texture_set':{color:'color',normal:'normal',metalness_emissive_roughness_subsurface:[10,20,30,40]}};
    writeFileSync(file,JSON.stringify(payload));
    const index=await inspect('Undo.index');await call('import_texture_set',{path:file});assert.equal(await inspect('Undo.index'),index+1);assert.equal(await inspect('Texture.all.length'),3);assert.equal(await inspect('TextureGroup.all.length'),1);assert.equal(await inspect('Texture.all[2].width'),16);assert.deepEqual(await inspect('Array.from(Texture.all[2].ctx.getImageData(0,0,1,1).data)'),[128,128,255,255]);assert.equal(await inspect('TextureGroup.all[0].material_config.subsurface_value'),40);
    await undo();assert.equal(await inspect('Texture.all.length'),1);assert.equal(await inspect('TextureGroup.all.length'),0);await redo();assert.equal(await inspect('Texture.all.length'),3);
    await invalid('import_texture_set',{path:file});assert.equal(await inspect('Texture.all.length'),3,'Existing images must not be replaced');
    for(const content of ['{bad',JSON.stringify({}),JSON.stringify({'minecraft:texture_set':{color:'missing'}}),JSON.stringify({'minecraft:texture_set':{color:'#ZZ0000'}}),JSON.stringify({'minecraft:texture_set':{normal:'normal',heightmap:'normal'}})]){writeFileSync(file,content);await invalid('import_texture_set',{path:file});}
    writeFileSync(resolve(directory,'broken.png'),'not an image');writeFileSync(file,JSON.stringify({'minecraft:texture_set':{color:'broken'}}));await invalid('import_texture_set',{path:file});
    writeFileSync(file,JSON.stringify({'minecraft:texture_set':{color:'#112233',metalness_emissive_roughness:[0,64,255]}}));await call('import_texture_set',{path:file});assert.deepEqual(await inspect('TextureGroup.all.at(-1).material_config.color_value'),[17,34,51,255]);await undo();await redo();
    await inspect('(async()=>{let data=JSON.parse(Codecs.project.compile());Codecs.project.load(data,{path:"remaining.bbmodel",no_file:true});window.__remaining.created.push(Project.uuid);await new Promise(r=>setTimeout(r,100));return true;})()');assert.equal(await inspect('TextureGroup.all.length'),2);assert.equal(await inspect('Texture.all.length'),3);
  });
}finally{
  const preserved=await inspect('(async()=>{let s=window.__remaining;for(let p of [...ModelProject.all])if(s.created.includes(p.uuid))await p.close(true);let issues=[];for(let o of s.originals){o.p.select();if(Codecs.project.compile()!==o.model||o.p.saved!==o.saved||Undo.index!==o.index||Undo.history.length!==o.history.length||Undo.history.some((h,i)=>h!==o.history[i]))issues.push(o.p.uuid);}for(let [k,v]of Object.entries(s.settings))if(settings[k]?.value!==v)settings[k].set(v);Settings.save();for(let [k,v]of Object.entries(s.toolSettings))Object.assign(BarItems[k].tool_settings,v);Object.assign(Painter.mirror_painting_options,s.mirror);Painter.mirror_painting=s.mirrorEnabled;Painter.lock_alpha=s.lock;Painter.erase_mode=s.erase;for(let [k,v]of Object.entries(s.barValues))if(v!==undefined&&BarItems[k]){if(typeof BarItems[k].set==="function")BarItems[k].set(v);else BarItems[k].value=v;}ColorPanel.set(s.color);ColorPanel.set(s.secondary,true);s.active?.select();s.mode?.select();s.tool?.select();return {issues,projects:ModelProject.all.length};})()');
  record('preserve_existing_projects',{pass:!preserved.issues.length,...preserved});
  writeFileSync('.verification/remaining-experiments-live.json',JSON.stringify({server,runtime,sha256:createHash('sha256').update(readFileSync('dist/mcp.js')).digest('hex'),results},null,2));
  await inspect('delete window.__remaining;true');
}
if(results.some(r=>!r.pass))process.exitCode=1;
