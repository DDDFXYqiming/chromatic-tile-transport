import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOOR_OPEN,DOOR_WAIT,doorBatches,doorPose,posedVertices} from '../src/studies/portal-door.mjs';
import {createTravel} from '../src/studies/portal-travel.mjs';
import {STOPS,DOORS,EYE_HEIGHT,routeX,buildPortalGeometry} from '../src/studies/portal-scene.mjs';
import {sub,add,ry,cross,dot,unit} from '../src/studies/math.mjs';

const asset=JSON.parse(readFileSync(new URL('../assets/studies/portal-door/door.mesh.json',import.meta.url),'utf8'));
assert.equal(asset.revision,'bronze-leaves-r10');
assert.equal(asset.leafThickness,.14);
assert.equal(asset.openingRadians,DOOR_OPEN);
assert.deepEqual(asset.groups.map(g=>g.side),[-1,0,1]);
const groups=asset.groups.map(group=>({...group,triangles:[]}));
for(const group of groups){
  assert.equal(group.vertices.length%36,0);
  assert.ok(group.vertices.length>3600);
  assert.ok(group.vertices.every(Number.isFinite));
  for(let i=0;i<group.vertices.length;i+=36){
    const a=group.vertices.slice(i,i+3),b=group.vertices.slice(i+12,i+15),c=group.vertices.slice(i+24,i+27);
    const ab=sub(b,a),ac=sub(c,a);
    assert.ok(Math.hypot(...cross(ab,ac))>1e-10,'exported triangle has area');
    group.triangles.push({a,ab,ac});
  }
}
const glb=readFileSync(new URL('../assets/studies/portal-door/bronze-door.glb',import.meta.url));
assert.equal(glb.subarray(0,4).toString(),'glTF');
assert.equal(glb.readUInt32LE(4),2);
assert.equal(glb.readUInt32LE(8),glb.length);
const gltf=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
for(const name of ['Left_hinge','Right_hinge','Raised_threshold'])assert.ok(gltf.nodes.some(n=>n.name===name));
assert.ok(gltf.materials.every(m=>!m.alphaMode||m.alphaMode==='OPAQUE'));

function hit(origin,direction,angle,sign=1,max=Infinity){
  let nearest=null;
  for(const group of groups){
    const pivot=[group.side*asset.hingeX,0,0],rotation=-group.side*sign*angle;
    const o=add(ry(sub(origin,pivot),-rotation),pivot),d=unit(ry(direction,-rotation));
    for(const {a,ab,ac} of group.triangles){
      const h=cross(d,ac),det=dot(ab,h);
      if(Math.abs(det)<1e-9)continue;
      const s=sub(o,a),u=dot(s,h)/det;
      if(u<0||u>1)continue;
      const q=cross(s,ab),v=dot(d,q)/det;
      if(v<0||u+v>1)continue;
      const distance=dot(ac,q)/det;
      if(distance>1e-6&&distance<max){max=distance;nearest={side:group.side,distance};}
    }
  }
  return nearest;
}

const reveal=[];
for(const sign of [-1,1]){
  const counts=[];
  for(const angle of [0,30,60,88].map(a=>a*Math.PI/180)){
    let occluded=0,total=0;
    // Rays cover the actual clear opening, leaving out the narrow centre seam.
    for(const x of [-.9,-.7,-.5,-.3,-.1,.1,.3,.5,.7,.9])for(const y of [.4,.8,1.2,1.6,2,2.4,2.8,3]){
      const origin=[0,EYE_HEIGHT,sign*DOOR_WAIT],toward=sub([x,y,0],origin);
      const surface=hit(origin,toward,angle,sign);
      if(surface&&surface.side!==0)occluded++;
      total++;
    }
    counts.push(occluded/total);
  }
  assert.equal(counts[0],1,'closed solid leaves hide the next room across the opening');
  assert.ok(counts[1]<counts[0]&&counts[2]<counts[1]&&counts[3]<counts[2],'the opening widens as the hinges rotate');
  assert.ok(counts[3]<.35,`fully opened leaves leave most of the perspective aperture clear: ${counts}`);
  reveal.push({direction:sign,occluded:counts});
}

let checkedSegments=0;
for(const [from,to] of [[STOPS[0],STOPS[3]],[STOPS[3],STOPS[0]]]){
  const travel=createTravel(from,DOORS);travel.go(to);
  let waited=0,crossed=0;
  for(let frame=0;travel.moving&&frame<2400;frame++){
    const before=travel.z,old=travel.doors;travel.step(1/60);
    if(travel.waiting)waited++;
    for(const [i,door] of DOORS.entries()){
      const state=travel.doors[i];
      if((before-door)*(travel.z-door)<0){assert.equal(state.angle,DOOR_OPEN);crossed++;}
      if(Math.abs(travel.z-door)<DOOR_WAIT-.01)assert.equal(state.angle,DOOR_OPEN,'camera enters only through fully open doors');
      if(frame%8||Math.min(Math.abs(before-door),Math.abs(travel.z-door))>3)continue;
      for(const offset of [-.33,.33]){
        const origin=[routeX(before)-routeX(door)+offset,EYE_HEIGHT,before-door];
        const next=[routeX(travel.z)-routeX(door)+offset,EYE_HEIGHT,travel.z-door];
        const segment=sub(next,origin),length=Math.hypot(...segment);
        if(length<1e-9)continue;
        assert.equal(hit(origin,segment,state.angle,state.direction,length),null,'swept camera capsule clears the moving solid mesh');
        assert.equal(hit(origin,segment,old[i].angle,old[i].direction,length),null);
        checkedSegments++;
      }
    }
  }
  assert.equal(travel.z,to);assert.equal(crossed,3);assert.ok(waited>20,'opening includes a visible wait before walking');
}

// Retarget while a leaf is in motion, then pause and reverse inside the passage.
const interrupted=createTravel(STOPS[0],DOORS);interrupted.go(STOPS[1]);interrupted.step(1.6);
assert.ok(interrupted.doors[0].angle>0&&interrupted.doors[0].angle<DOOR_OPEN);
const frozen={z:interrupted.z,doors:interrupted.doors};interrupted.go(STOPS[0]);interrupted.step(0);
assert.equal(interrupted.z,frozen.z);assert.deepEqual(interrupted.doors,frozen.doors);
for(let f=0;f<600;f++)interrupted.step(1/60);
assert.equal(interrupted.z,STOPS[0]);assert.equal(interrupted.doors[0].angle,0);
interrupted.seek(.6);assert.equal(interrupted.doors[0].angle,DOOR_OPEN);
interrupted.go(STOPS[0]);for(let f=0;f<600;f++)interrupted.step(1/60);
assert.equal(interrupted.z,STOPS[0]);

// Production batches preserve identity/pivots and use the Blender data directly.
const batches=doorBatches(asset,'patina',DOORS,routeX);
assert.equal(batches.length,9);
for(const batch of batches){
  assert.equal(batch.vertices,asset.groups.find(g=>g.side===batch.side).vertices);
  const pose=doorPose(batch,DOORS.map(z=>({z,angle:DOOR_OPEN,direction:1})));
  const vertices=posedVertices(batch,DOORS.map(z=>({z,angle:DOOR_OPEN,direction:1})));
  assert.ok(vertices.every(Number.isFinite));
  assert.equal(pose.angle,batch.side?-batch.side*DOOR_OPEN:0);
}
const base=buildPortalGeometry(['tide','forest','night','journey'],'patina');
const triangles=[...base,...batches].reduce((n,b)=>n+b.vertices.length/36,0);
console.log(JSON.stringify({passed:true,triangles,cameraSegments:checkedSegments,doorReveal:reveal,
  checks:['Blender mesh and opaque GLB','bidirectional widening aperture','wait for full opening',
    'six physical threshold crossings','camera capsule clears animated leaves','pause, interrupted selection and inside-door reversal','production hinge transforms']},null,2));
