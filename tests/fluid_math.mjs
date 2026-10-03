import assert from 'node:assert/strict';
import {Fluid,PigmentField} from '../src/studies/fluid.mjs';
import {regionWeight,pigmentWeight} from '../src/studies/fluid-regions.mjs';

const fluid=new Fluid(32,24),field=new PigmentField(48,32),original=field.uv.slice();
field.step(fluid,1/60);
assert.deepEqual(field.uv,original,'still flow must retain the source coordinates');
fluid.splat(.6,.5,.1,-.04);
for(let i=0;i<180;i++){fluid.step(1/60);field.step(fluid,1/60);}
assert.ok(field.uv.some((v,i)=>Math.abs(v-original[i])>.01),'momentum must transport the source coordinates');
assert.ok(field.uv.every(v=>Number.isFinite(v)&&v>=0&&v<=1),'sampling coordinates must stay finite and in the image');
const encoded=field.encode();
for(let i=0;i<field.uv.length;i+=2){
  assert.ok(Math.abs((encoded[i*2]*256+encoded[i*2+1])/65535-field.uv[i])<=1/65535);
  assert.ok(Math.abs((encoded[i*2+2]*256+encoded[i*2+3])/65535-field.uv[i+1])<=1/65535);
}
field.reset();assert.deepEqual(field.uv,original,'chapter reset must restore every source coordinate');
console.log('PASS still map, persistent advection, finite bounds, 16-bit texture encoding and reset');

for(const chapter of ['mineral','ink','paper','light']){
  assert.equal(regionWeight(chapter,.08,.3),0,'empty left side stays outside every artwork region');
  const flow=new Fluid(72,48,12),pigment=new PigmentField(120,80),initial=pigment.uv.slice();
  const weight=(x,y)=>regionWeight(chapter,x,y);
  flow.setMask(weight);pigment.setMask(weight);
  flow.splat(.65,.68,.08,-.035,.18);
  for(let i=0;i<900;i++){flow.step(1/60);pigment.step(flow,1/60);}
  assert.ok(pigment.uv.some((v,i)=>Math.abs(v-initial[i])>.002),chapter+' keeps visible flow');
  for(let i=0;i<pigment.mask.length;i++)if(!pigment.mask[i]){
    assert.equal(pigment.uv[i*2],initial[i*2]);assert.equal(pigment.uv[i*2+1],initial[i*2+1]);
  }
  assert.ok(pigment.uv.every(Number.isFinite));
  assert.ok(flow.speed<.00035,chapter+' motion eventually settles');
}
assert.equal(pigmentWeight('mineral',.60,.72,90,60,30),0,'copper is not pigment');
assert.equal(pigmentWeight('paper',.65,.6,235,215,190),0,'blank paper is not pigment');
console.log('PASS four region masks keep exterior coordinates fixed, preserve flow and settle');
