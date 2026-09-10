'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
globalThis.MatrixTimeline=require('../src/matrix/timeline.js');
const L=require('../src/matrix/layers.js');
const config=JSON.parse(fs.readFileSync('examples/matrix-motion/config.json','utf8'));
const scenes=JSON.parse(fs.readFileSync('examples/matrix-motion/scenes.json','utf8'));
const TOTAL=scenes.length*config.options.shotSeconds;
const tests=[];function check(name,fn){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.message});}}
check('Every authored shot joins the next camera pose, including the loop',()=>{
 scenes.forEach((s,i)=>assert.deepEqual(L.cameraAt(s.cameraKeys,1),L.cameraAt(scenes[(i+1)%scenes.length].cameraKeys,0)));
});
check('Independent layer motion changes relative positions rather than translating one poster',()=>{
 const a=L.layout(config.composition,scenes[0],.2,1,TOTAL,config.options,1440,900);
 const b=L.layout(config.composition,scenes[0],.2,3,TOTAL,config.options,1440,900);
 const fish=a.findIndex(x=>x.id==='fish'),person=a.findIndex(x=>x.id==='character');
 assert.ok(Math.abs((b[fish].screenX-a[fish].screenX)-(b[person].screenX-a[person].screenX))>30);
 const off={...config.options,layerMotion:false};
 assert.deepEqual(L.layout(config.composition,scenes[0],.2,1,TOTAL,off,1440,900),L.layout(config.composition,scenes[0],.2,3,TOTAL,off,1440,900));
});
check('Layer animation is reversible and periodic at the composition loop',()=>{
 const sample=t=>L.layout(config.composition,scenes[0],0,t,TOTAL,config.options,1440,900);
 assert.deepEqual(sample(2),sample(2));const a=sample(0),b=sample(TOTAL);
 a.forEach((layer,i)=>{assert.ok(Math.abs(layer.screenX-b[i].screenX)<1e-8);assert.ok(Math.abs(layer.screenY-b[i].screenY)<1e-8);});
});
console.log(JSON.stringify({suite:'matrix-layers',passed:tests.every(x=>x.passed),tests},null,2));
if(tests.some(x=>!x.passed))process.exitCode=1;
