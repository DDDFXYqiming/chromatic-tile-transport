import assert from 'node:assert/strict';
import {projectShadow,fieldLights,fieldLayout} from '../src/studies/shadow-apparatus.mjs';
import {sculptureMesh,faceNormal} from '../src/studies/shadow-geometry.mjs';
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
  for(let a=-3;a<3;a+=.07){const x=projectShadow(point,fieldLights(a)[0]),y=projectShadow(point,fieldLights(a+.0001)[0]);assert.ok(Math.hypot(x[0]-y[0],x[1]-y[1])<.00002);}
  assert.deepEqual(point,before);
});
test('the receiver contact has zero shadow displacement',()=>{
  for(const light of fieldLights(.4)){const p=[.33,.44,0],q=projectShadow(p,light);p.forEach((v,i)=>close(v,q[i]));}
});
test('landscape and portrait distribute content across the exhibition',()=>{
  for(const [w,h] of [[1440,900],[1920,1080],[1024,768],[768,1024],[390,844],[320,568]]){
    const l=fieldLayout(w,h);assert.equal(l.glyphs.length,2);
    assert.ok(l.size>=Math.min(w,h)*.3);
    for(const p of l.glyphs)assert.ok(p.every(Number.isFinite)&&p[2]>.15&&p[3]>=.15);
  }
});
test('all four sculptures remain in the first viewport and above the receiver',()=>{
  for(const [w,h] of [[1536,695],[1440,900],[1920,1080],[1024,768],[768,1024],[390,844],[320,568]])
    for(let chapter=0;chapter<4;chapter++)for(const view of [-1,0,1])for(const time of [0,7,22,70]){
      const faces=sculptureMesh(chapter,w,h,{view,time});
      for(const face of faces){
        assert.ok(faceNormal(face,w,h).every(Number.isFinite));
        for(const p of face){
          assert.ok(p[2]>0&&p[2]<.6,`chapter ${chapter} intersects the receiver`);
          const x=p[0]+p[2]*(.09+view*.08),y=p[1]-p[2]*.16;
          const top=fieldLayout(w,h).portrait?.34:.16;
          assert.ok(x>.04&&x<.97&&y>top&&y<.77,`out of exhibition: ${w}x${h} ${x},${y}`);
          for(const light of fieldLights(time*.18)){
            const q=projectShadow(p,light);assert.ok(q.every(Number.isFinite));
            close(q[2],0);
          }
        }
      }
    }
});
test('chapter solids are distinct, deterministic and retain depth',()=>{
  const counts=[];
  for(let chapter=0;chapter<4;chapter++){
    const a=sculptureMesh(chapter,1536,695),points=a.flat(),z=points.map(p=>p[2]);counts.push(a.length);
    assert.ok(Math.max(...z)-Math.min(...z)>.07);
    assert.deepEqual(a,sculptureMesh(chapter,1536,695));
    assert.notDeepEqual(a,sculptureMesh(chapter,1536,695,{view:.8,time:3}));
    assert.deepEqual(a,sculptureMesh(chapter,1536,695));
  }
  assert.equal(new Set(counts).size,4);
});
test('shadow silhouettes change under all three lights without changing the solid',()=>{
  for(let chapter=0;chapter<4;chapter++){
    const solid=sculptureMesh(chapter,1536,695),before=structuredClone(solid);
    for(let i=0;i<3;i++){
      const a=solid.flat().map(p=>projectShadow(p,fieldLights(0)[i]));
      const b=solid.flat().map(p=>projectShadow(p,fieldLights(1.2)[i]));
      assert.ok(a.some((p,j)=>Math.hypot(p[0]-b[j][0],p[1]-b[j][1])>.015));
    }
    assert.deepEqual(solid,before);
  }
});
console.log(`${passed} shadow geometry tests passed.`);
