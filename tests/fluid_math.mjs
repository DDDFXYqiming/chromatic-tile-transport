import assert from 'node:assert/strict';
import {Fluid,PigmentField} from '../src/studies/fluid.mjs';

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
