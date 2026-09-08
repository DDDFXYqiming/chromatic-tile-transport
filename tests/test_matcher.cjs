/* Run: node test_matcher.cjs. No third-party dependencies. */
'use strict';
const assert=require('node:assert/strict');
const {solve}=require('../src/matcher.js');
const tests=[];
function check(name,fn){try{const detail=fn();tests.push({test:name,passed:true,detail});}catch(e){tests.push({test:name,passed:false,error:e.stack});}}
const cfg={cols:16,rows:12,aspect:4/3,spatial:.022},n=cfg.cols*cfg.rows;
function data(seed){let s=seed;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)|0;return(s>>>0)/4294967296};const d=new Float32Array(n*4);for(let i=0;i<n;i++){d[i*4]=.1+rnd()*.8;d[i*4+1]=(rnd()-.5)*.28;d[i*4+2]=(rnd()-.5)*.28;d[i*4+3]=rnd()*.2;}return d;}
const a=data(21),b=data(48);
check('Identical image has identity map and zero motion',()=>{const p=solve(a,a,cfg);assert(p.metrics.identity);assert.equal(p.metrics.meanTravel,0);assert.equal(p.metrics.meanColorError,0);for(let i=0;i<n;i++)assert.equal(p.map[i],i);return p.metrics;});
check('Every target is assigned once, including non-8-multiple dimensions',()=>{const p=solve(a,b,cfg);assert.equal(new Set(p.map).size,n);for(const x of p.map)assert(x>=0&&x<n);for(const x of p.attrs)assert(Number.isFinite(x));return p.metrics;});
check('Same inputs reproduce the exact permutation',()=>{const p=solve(a,b,cfg),q=solve(a,b,cfg);assert.deepEqual(p.map,q.map);assert.deepEqual(p.attrs,q.attrs);return {hash:p.metrics.hash};});
check('Refinement never raises its stated total objective',()=>{const p=solve(a,b,cfg);assert(p.metrics.finalObjective<=p.metrics.initialObjective+1e-10);return {initial:p.metrics.initialObjective,final:p.metrics.finalObjective};});
check('Changing image colours changes the map',()=>{const p=solve(a,b,cfg),q=solve(a,data(99),cfg);let changed=0;for(let i=0;i<n;i++)if(p.map[i]!==q.map[i])changed++;assert(changed>n*.8);return {changed,total:n};});
check('Uniform palettes cannot preserve colour but remain bijective',()=>{const aa=new Float32Array(n*4),bb=new Float32Array(n*4);for(let i=0;i<n;i++){aa[i*4]=.2;bb[i*4]=.8;}const p=solve(aa,bb,cfg);assert.equal(new Set(p.map).size,n);assert(p.metrics.meanColorError>.59);assert(p.metrics.meanColorError<.61);return p.metrics;});
check('Permutation of separated colours matches the same colours',()=>{
 const aa=new Float32Array(n*4),bb=new Float32Array(n*4);
 const pal=[[.12,0,0],[.85,0,0],[.55,.23,0],[.55,-.23,0],[.55,0,.23],[.55,0,-.23]];
 for(let i=0;i<n;i++){const c=pal[i%pal.length];aa.set(c,i*4);const j=(i*73+17)%n;bb.set(c,j*4);}
 const p=solve(aa,bb,{...cfg,spatial:.002});assert.equal(new Set(p.map).size,n);assert(p.metrics.meanColorError<.015);assert(!p.metrics.identity);assert(p.metrics.samePositionError>.1);return p.metrics;
});
check('Malformed descriptors fail explicitly',()=>{assert.throws(()=>solve(new Float32Array(7),b,cfg));const bad=a.slice();bad[0]=NaN;assert.throws(()=>solve(bad,b,cfg));return 'dimension and NaN checks';});
console.log(JSON.stringify({environment:process.version,tests,passed:tests.every(t=>t.passed)},null,2));
process.exitCode=tests.every(t=>t.passed)?0:1;
