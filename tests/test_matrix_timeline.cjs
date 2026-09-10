'use strict';
const assert=require('node:assert/strict');
const T=require('../src/matrix/timeline.js');
const tests=[];
function check(name,fn){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.message});}}
check('Card preview holds both fully developed originals and slows both bridge crossings',()=>{
 for(const [shotSeconds,bridgeSeconds] of [[4,.3],[6.8,.48],[14,.85]]){
  const config=T.validate({shotSeconds,bridgeSeconds});
  for(const scene of [0,4]){
   const cycle=T.previewPosition(0,scene,5,config).cycleSeconds;
   const held={'hold-source':0,'hold-target':0},bridges={forward:0,reverse:0};
   let previous=T.previewPosition(0,scene,5,config).position;
   for(let t=.005;t<cycle;t+=.005){
    const preview=T.previewPosition(t,scene,5,config),f=T.frame(preview.position,5,config);
    const delta=T.wrap(preview.position-previous+f.total/2,f.total)-f.total/2;
    assert.ok(Math.abs(delta)<=.00501,'preview must not jump back across images');previous=preview.position;
    if(preview.phase.startsWith('hold')){
     held[preview.phase]+=.005;assert.equal(f.from,0);assert.equal(f.to,0);assert.equal(f.bridge,0);
     assert.equal(f.scene,preview.phase==='hold-source'?scene:(scene+1)%5);
    }else if(f.bridge>0)bridges[preview.phase]+=.005;
   }
   for(const value of Object.values(held))assert.ok(value>=1.49,'complete originals need a readable dwell');
   for(const value of Object.values(bridges))assert.ok(value>=.95,'both bridge directions need time to resolve');
   assert.ok(Math.abs(T.previewPosition(cycle,scene,5,config).position-T.previewPosition(0,scene,5,config).position)<1e-8);
  }
 }
});
check('Configuration rejects unknown keys, NaN, infinities and numeric booleans',()=>{
 for(const p of [{unknown:1},{density:NaN},{shotSeconds:Infinity},{density:143.5},{autoplay:1},{zoom:0},{bridgeSeconds:2},{mode:'transport'},{palette:'bad'}])assert.throws(()=>T.validate(p));
});
check('Every supported setting validates at both ends of its documented range',()=>{
 T.validate({shotSeconds:4,bridgeSeconds:.3,density:48,zoom:1,parallax:0});
 T.validate({shotSeconds:14,bridgeSeconds:.85,density:224,zoom:2.1,parallax:1});
});
check('All five exact chapter boundaries identify the intended image',()=>{
 for(let i=0;i<5;i++){const f=T.frame(i*6.8,5);assert.equal(f.scene,i);assert.ok(f.local<1e-10);assert.equal(f.from,3);assert.equal(f.reveal,0);}
});
check('Last-to-first wrap and negative seek are deterministic',()=>{
 assert.deepEqual(T.frame(34,5),T.frame(0,5));assert.deepEqual(T.frame(-.25,5),T.frame(33.75,5));
});
check('Bridge duration stays 0.48 seconds when the shot duration changes',()=>{
 for(const shotSeconds of [4,6.8,14]){const c=T.validate({shotSeconds});const f=T.frame(shotSeconds-.24,5,c);assert.ok(Math.abs(f.bridge-.5)<1e-10);}
});
check('Every choreography edit joins with the same full image style',()=>{
 for(let i=1;i<T.EDITS.length;i++)assert.equal(T.EDITS[i-1][3],T.EDITS[i][2]);
});
check('Camera stays finite and covers the image across every scene and frame',()=>{
 for(let i=0;i<3400;i++){const f=T.frame(i*.01,5);assert.ok(Number.isFinite(f.zoom));assert.ok(f.zoom>=1&&f.zoom<=1.66);assert.ok(f.focus>=0&&f.focus<=1);}
});
check('Pinned styles are independent of transition progress',()=>{
 for(const mode of T.MODES.filter(m=>m!=='auto')){const c=T.validate({mode});for(const s of [0,2,6.58,17,33.9]){const f=T.frame(s,5,c);assert.equal(f.bridge,0);assert.equal(f.from,f.to);assert.equal(f.forceMatrix,mode==='matrix');}}
});
check('Reduced motion suppresses camera, bridge and matrix in every mode',()=>{
 for(const mode of T.MODES){const f=T.frame(6.58,5,T.validate({mode}),true);assert.equal(f.zoom,1);assert.equal(f.bridge,0);assert.equal(f.forceMatrix,false);assert.equal(f.from,0);assert.equal(f.drift,0);}
});
check('Cell formation and recovery overlap the flip without a global waiting stage',()=>{
 for(let i=0;i<=100;i++){
  const wave=i/100,start=.18+wave*.22,end=.52+wave*.24;
  assert.equal(T.gridEnvelope(0,wave),0);assert.ok(T.gridEnvelope(1,wave)<1e-12);
  assert.ok(T.gridEnvelope(start+.02,wave)>T.gridEnvelope(start-.02,wave));
  assert.ok(T.gridEnvelope(end+.02,wave)<T.gridEnvelope(end-.02,wave));
  assert.ok(T.gridEnvelope((start+end)/2,wave)>.9,'The flip should still resolve into a visible grid');
 }
});
check('The page shade blends through grid entry and exit instead of switching at thresholds',()=>{
 for(const progress of [.05,.87]){
  const before=T.frame(6.32+(progress-.0001)*.48,5).shade,after=T.frame(6.32+(progress+.0001)*.48,5).shade;
  assert.ok(before>0 && after<1);assert.ok(Math.abs(after-before)<.002);
 }
 assert.equal(T.frame(6.32,5).shade,0);assert.equal(T.frame(6.8,5).shade,0);
});
check('Fixed cell centres do not depend on colour, image or time',()=>{
 const g=T.grid(1382,713,144);assert.deepEqual(g,{cols:144,rows:74});
 for(const t of [0,.1,.5,.9,1]){T.frame(6.32+.479*t,5);assert.deepEqual(T.cellCenter(17,25,g.cols,g.rows),[17.5/144,25.5/74]);}
});
check('Reverse timeline sampling returns bit-identical numeric uniforms',()=>{
 const a=T.frame(6.55,5);T.frame(17.7,5);assert.deepEqual(T.frame(6.55,5),a);
});
check('New timeline does not import a matcher or use randomness',()=>{
 const fs=require('node:fs');const src=fs.readFileSync(require.resolve('../src/matrix/timeline.js'),'utf8');assert.ok(!src.includes('Math.random'));assert.ok(!src.includes('matcher.js'));
});
console.log(JSON.stringify({suite:'matrix-timeline',passed:tests.every(t=>t.passed),tests},null,2));
if(tests.some(t=>!t.passed))process.exitCode=1;
