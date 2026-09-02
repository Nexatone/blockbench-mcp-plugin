import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { connect, call, rpc } from './client.mjs';

// Run against the old plugin with EXPECT_BEFORE=1, then the patched local build.
// Preserve every open project; only the projects created here are closed.
const before = process.env.EXPECT_BEFORE === '1';
const report = { before, checks: {} };
mkdirSync('.verification', { recursive: true });
const text = result => result.content.find(item => item.type === 'text')?.text;
async function evaluate(code) {
  const result = await call('risky_eval', { code: (before ? 'Undo.cancelEdit(false); ' : '') + code });
  return JSON.parse(text(result));
}
const fixture = {
  format_version: '1.21.20',
  'minecraft:geometry': [{
    description: { identifier: 'geometry.mcp_roundtrip_fixture', texture_width: 64, texture_height: 32 },
    bones: [{ name: 'base', pivot: [0, 0, 0], cubes: [{ origin: [-4, 0, -4], size: [8, 8, 8], uv: [0, 0] }] }],
    item_display_transforms: {
      gui: { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [0.625, 0.625, 0.625] },
      fixed: { rotation: [0, 0, 25], translation: [2.5, -3.5, 0], scale: [0.5, 0.5, 0.5] },
      thirdperson_righthand: { rotation: [70, 0, -15], translation: [1.5, 4, 3], scale: [0.5, 0.5, 0.5] },
    },
  }],
};
await connect();
report.plugin = await evaluate('({version:Blockbench.version,source:Plugins.all.find(p=>p.id==="mcp").source,path:Plugins.all.find(p=>p.id==="mcp").path})');
if (!before) {
  assert.equal(report.plugin.source, 'file', 'Load the local patched build before running this suite');
  assert.equal(resolve(report.plugin.path), resolve('dist/mcp.js'));
  report.buildSHA256 = createHash('sha256').update(readFileSync('dist/mcp.js')).digest('hex');
}
await evaluate(`window.__mcpRoundtripCheck = {
  project: Project,
  originals: ModelProject.all.map(p => ({p, saved:p.saved, history:p.undo.history.slice(), index:p.undo.index})),
  models: ModelProject.all.map(p => {p.select(); return Codecs.project.compile();})
}; window.__mcpRoundtripCheck.project?.select(); true`);
try {
  // Schedule recovery before entering the start screen: the old tool cannot
  // execute even a project-selection expression once Undo is unavailable.
  await evaluate('setTimeout(()=>window.__mcpRoundtripCheck.project?.select(),1500); setTimeout(()=>Interface.tab_bar.$data.new_tab.select(),50); true');
  await new Promise(resolve => setTimeout(resolve, 120));
  const noProject = await rpc('tools/call', { name: 'risky_eval', arguments: { code: '({answer:6*7,hasProject:!!Project})' } });
  report.checks.noProject = noProject;
  if (before) assert.equal(noProject.isError, true);
  else assert.deepEqual(JSON.parse(text(noProject)), { answer: 42, hasProject: false });
  await new Promise(resolve => setTimeout(resolve, 1500));

  if (!before) {
    const error = await rpc('tools/call', { name: 'risky_eval', arguments: { code: 'throw new Error("roundtrip-test-error")' } });
    assert.equal(error.isError, true);
    assert.match(text(error), /roundtrip-test-error/);
    report.checks.scriptError = true;
  }

  await call('from_geo_json', { geojson: JSON.stringify(fixture) });
  const format = await evaluate('Format.id');
  assert.equal(format, before ? 'bedrock' : 'bedrock_block');
  const exported = JSON.parse(text(await call('export_model', { codec_id: 'bedrock' })));
  const geometry = JSON.parse(exported.content);
  const native = await evaluate('Codecs.bedrock.compile({raw:true})');
  assert.deepEqual(geometry, native);
  assert.equal(geometry.format_version, before ? '1.12.0' : '1.21.110');
  const display = geometry['minecraft:geometry'][0].item_display_transforms;
  assert.deepEqual(display.gui.rotation, [30, -135, 0]);
  assert.deepEqual(display.gui.scale, fixture['minecraft:geometry'][0].item_display_transforms.gui.scale);
  assert.equal(display.gui.fit_to_frame, true);
  for (const slot of ['fixed', 'thirdperson_righthand']) {
    for (const key of ['rotation', 'translation', 'scale']) {
      assert.deepEqual(display[slot][key], fixture['minecraft:geometry'][0].item_display_transforms[slot][key]);
    }
  }
  report.checks.geometry = { format, version: geometry.format_version, nativeMatches: true, display };
  writeFileSync(`.verification/roundtrip-${before ? 'before' : 'after'}.geo.json`, exported.content);
  if (before) {
    const repeat = await rpc('tools/call', { name: 'from_geo_json', arguments: { geojson: exported.content } });
    report.checks.secondGeometryRoundtrip = repeat;
    assert.equal(repeat.isError, true);
    // Allow the native close().then(select) path to settle before cleanup.
    await new Promise(resolve => setTimeout(resolve, 100));
  } else {
    await call('from_geo_json', { geojson: exported.content });
    const again = JSON.parse(text(await call('export_model', { codec_id: 'bedrock' })));
    assert.deepEqual(JSON.parse(again.content), geometry);
    report.checks.secondGeometryRoundtrip = true;

    // Saved projects must retain display state as well as the geometry codec.
    const saved = JSON.parse(text(await call('export_model', { codec_id: 'project' })));
    writeFileSync('.verification/roundtrip-after.bbmodel', saved.content);
    await evaluate(`Codecs.project.load(${saved.content},{path:"mcp-roundtrip.bbmodel",no_file:true}); true`);
    const reopened = JSON.parse(text(await call('export_model', { codec_id: 'bedrock' })));
    report.checks.savedProjectDisplay = JSON.parse(reopened.content)['minecraft:geometry'][0].item_display_transforms;
    assert.deepEqual(report.checks.savedProjectDisplay, display);
  }

  if (!before) {
    // Explicit Undo works and evaluations must not create edits or erase redo.
    await evaluate('Undo.initEdit({display_slots:["gui"]}); Project.display_settings.gui.translation[0]=3; Undo.finishEdit("Test display"); true');
    await evaluate('Undo.undo(); true');
    const undo = await evaluate('({index:Undo.index,length:Undo.history.length,x:Project.display_settings.gui.translation[0]})');
    assert.equal(undo.x, 0);
    await evaluate('42');
    assert.deepEqual(await evaluate('({index:Undo.index,length:Undo.history.length,x:Project.display_settings.gui.translation[0]})'), undo);
    await evaluate('Undo.redo(); true');
    assert.equal(await evaluate('Project.display_settings.gui.translation[0]'), 3);
    report.checks.explicitUndoRedo = true;
  }
} finally {
  const preserved = await evaluate(`(async()=>{
    const state=window.__mcpRoundtripCheck;
    for(const p of ModelProject.all.slice()) if(!state.originals.some(s=>s.p===p)) await p.close(true);
    const matches=state.originals.map((s,i)=>{
      s.p.select();
      return s.p.saved===s.saved && s.p.undo.index===s.index &&
        s.p.undo.history.length===s.history.length && s.history.every((e,n)=>s.p.undo.history[n]===e) &&
        Codecs.project.compile()===state.models[i];
    });
    state.project?.select(); delete window.__mcpRoundtripCheck; return matches;
  })()`);
  report.checks.originalProjectsPreserved = preserved;
  writeFileSync(`.verification/project-roundtrip-${before ? 'before' : 'after'}.json`, JSON.stringify(report, null, 2));
  assert.ok(preserved.every(Boolean), 'Original projects must remain unchanged');
  console.log(JSON.stringify(report, null, 2));
}
