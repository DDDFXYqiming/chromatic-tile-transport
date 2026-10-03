import assert from 'node:assert/strict';
import {projectShadow,fieldLights,fieldLayout} from '../src/studies/shadow-apparatus.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
let passed=0;
function test(name,run){run();passed++;console.log('PASS',name);}
test('each point-light ray intersects the common receiver plane',()=>{
  for(let angle=-Math.PI;angle<=Math.PI;angle+=.1)for(const light of fieldLights(angle))for(const point of [[.2,.3,.17],[.9,.8,.105],[.4,.6,0]]){
    const shadow=projectShadow(point,light),t=(0-light[2])/(point[2]-light[2]);
    close(shadow[2],0);close(shadow[0],light[0]+t*(point[0]-light[0]));close(shadow[1],light[1]+t*(point[1]-light[1]));
    assert.ok(shadow.every(Number.isFinite));
  }
});
test('three lights cast shadows into distinct directions',()=>{
  const point=[.5,.5,.17],s=fieldLights(0).map(l=>projectShadow(point,l));
  assert.ok(s[0][0]>.5&&s[0][1]>.5);assert.ok(s[1][0]<.5);assert.ok(s[2][1]<.5);
  assert.equal(new Set(s.map(p=>p.join(','))).size,3);
});
test('shadow moves continuously and does not mutate the letter plane',()=>{
  const point=[.3,.4,.17],before=[...point];
  for(let a=-3;a<3;a+=.07){const x=projectShadow(point,fieldLights(a)[0]),y=projectShadow(point,fieldLights(a+.0001)[0]);assert.ok(Math.hypot(x[0]-y[0],x[1]-y[1])<.00001);}
  assert.deepEqual(point,before);
});
test('the receiver contact has zero shadow displacement',()=>{
  for(const light of fieldLights(.4)){const p=[.33,.44,0],q=projectShadow(p,light);p.forEach((v,i)=>close(v,q[i]));}
});
test('landscape and portrait distribute content across the exhibition',()=>{
  for(const [w,h] of [[1440,900],[1920,1080],[1024,768],[768,1024],[390,844],[320,568]]){
    const l=fieldLayout(w,h);assert.equal(l.glyphs.length,2);assert.equal(l.plates.length,2);
    assert.ok(l.plates[0][0]<.1&&l.plates[1][0]>.6);
    for(const p of [...l.glyphs,...l.plates])assert.ok(p.every(Number.isFinite)&&p[2]>.15&&p[3]>.15);
  }
});
console.log(`${passed} shadow geometry tests passed.`);
