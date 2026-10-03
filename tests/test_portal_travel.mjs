import assert from 'node:assert/strict';
import {createTravel} from '../src/studies/portal-travel.mjs';
import {STOPS,DOORS,APERTURE,EYE_HEIGHT,ROOM,routeX,roomAt,lensForAspect,buildPortalGeometry} from '../src/studies/portal-scene.mjs';
import {cross,dot,sub,unit} from '../src/studies/math.mjs';

const results=[];
function journey(from,to,hz){
  const travel=createTravel(from,DOORS),crossed=[];
  travel.go(to);
  for(let frame=0;travel.moving&&frame<hz*45;frame++){
    const before=travel.z;travel.step(1/hz);
    assert.ok(Math.abs(travel.z-before)<=2.601/hz,'camera displacement respects walking speed');
    assert.ok(travel.z>=Math.min(from,to)-1e-6&&travel.z<=Math.max(from,to)+1e-6,'camera stays in connected corridor');
    for(const door of DOORS)if((before-door)*(travel.z-door)<=0&&!crossed.includes(door)){
      crossed.push(door);
      assert.ok(Math.abs(routeX(travel.z)-routeX(door))+.09<APERTURE.halfWidth,'eye and pointer margin fit the clear aperture');
    }
  }
  assert.equal(travel.z,to,'arrives exactly');assert.equal(travel.velocity,0,'stops at destination');
  return crossed;
}
for(const hz of [20,60,144]){
  assert.deepEqual(journey(STOPS[0],STOPS[3],hz),DOORS);
  assert.deepEqual(journey(STOPS[3],STOPS[0],hz),[...DOORS].reverse());
  results.push(`forward and return: ${hz} Hz, three apertures crossed`);
  for(const from of STOPS)for(const to of STOPS){
    const expected=DOORS.filter(z=>z<Math.max(from,to)&&z>Math.min(from,to));
    assert.deepEqual(journey(from,to,hz),to>from?expected.reverse():expected);
  }
}
const paused=createTravel(STOPS[0]);paused.go(STOPS[1]);paused.step(1);
const frozen={z:paused.z,velocity:paused.velocity};
paused.go(STOPS[3]);for(let i=0;i<100;i++)paused.step(0);
assert.equal(paused.z,frozen.z);assert.equal(paused.velocity,frozen.velocity);
paused.go(STOPS[0]);assert.equal(paused.z,frozen.z,'retarget does not relocate camera');
for(let i=0;i<1200;i++)paused.step(1/60);
assert.equal(paused.z,STOPS[0]);
results.push('pause, interrupted selection and reverse travel preserve position');
for(const [i,door] of DOORS.entries()){
  assert.equal(roomAt(door+.001),i);assert.equal(roomAt(door-.001),i+1);
}
results.push('chapter changes at the physical door planes');

const turning=createTravel(STOPS[0],DOORS);turning.go(STOPS[3]);turning.step(1);
const turnZ=turning.z;turning.go(STOPS[0]);
for(let frame=0;frame<240;frame++)turning.brake(1/60);
assert.equal(turning.z,turnZ,'turning stays in place');assert.equal(turning.velocity,0,'old forward velocity is removed during return turn');
turning.step(1/60);assert.ok(turning.z>turnZ,'return starts toward the selected room');
results.push('return turn brakes before walking back');

const walk=createTravel(STOPS[0],DOORS);walk.go(STOPS[1]);
let insideSeconds=0,elapsed=0;
while(walk.moving&&elapsed<20){walk.step(1/60);elapsed+=1/60;if(Math.abs(walk.z-DOORS[0])<APERTURE.depth/2)insideSeconds+=1/60;}
assert.ok(insideSeconds>.8&&insideSeconds<1.4,'deep reveal stays around the moving eye for a readable interval');
assert.ok(elapsed>4&&elapsed<8,'adjacent chapter is a walk of several seconds');
results.push(`adjacent walk ${elapsed.toFixed(2)} s, inside the doorway ${insideSeconds.toFixed(2)} s`);

// Intersect the production mesh, not a second approximation of the room boxes.
const art=['tide','forest','night','fjord'],batches=buildPortalGeometry(art,'copper'),triangles=[];
for(const {vertices,texture} of batches){
  assert.equal(vertices.length%36,0);
  assert.ok(vertices.every(Number.isFinite));
  for(let i=0;i<vertices.length;i+=36){
    const a=vertices.slice(i,i+3),b=vertices.slice(i+12,i+15),c=vertices.slice(i+24,i+27);
    const edge1=sub(b,a),edge2=sub(c,a);
    assert.ok(Math.hypot(...cross(edge1,edge2))>1e-8,'nondegenerate triangle');
    triangles.push({a,edge1,edge2,texture,material:vertices[i+11]});
  }
}
function hit(origin,direction,max=Infinity){
  const ray=unit(direction);let nearest=null;
  for(const triangle of triangles){
    const h=cross(ray,triangle.edge2),det=dot(triangle.edge1,h);
    if(Math.abs(det)<1e-9)continue;
    const s=sub(origin,triangle.a),u=dot(s,h)/det;
    if(u<0||u>1)continue;
    const q=cross(s,triangle.edge1),v=dot(ray,q)/det;
    if(v<0||u+v>1)continue;
    const distance=dot(triangle.edge2,q)/det;
    if(distance>1e-5&&distance<max){max=distance;nearest={...triangle,distance};}
  }
  return nearest;
}
for(const [index,door] of DOORS.entries()){
  const x=routeX(door);
  for(const direction of [-1,1]){
    const origin=[x,EYE_HEIGHT,door-direction*3.4];
    const wallZ=door-direction*APERTURE.depth/2;
    const currentArt=art[index+(direction===1?1:0)];
    const view=hit(origin,[0,0,direction]);
    assert.ok(view&&view.distance>3.4+APERTURE.depth/2,'opening exposes a connected volume beyond the exit');
    for(const side of [-1,1]){
      for(const across of [APERTURE.halfWidth+.8,3.3,4.6]){
        const surface=hit(origin,sub([x+side*across,EYE_HEIGHT,wallZ],origin));
        assert.equal(surface?.texture,currentArt,'each wall wing occludes later chapters in both directions');
        assert.equal(surface.material,0);
      }
      const reveal=hit([x,EYE_HEIGHT,door+.21],[side,0,0]);
      assert.equal(reveal?.texture,'copper','inside the doorway sees the solid jamb');
      assert.ok(Math.abs(reveal.distance-APERTURE.halfWidth)<.01);
    }
    const above=hit(origin,sub([x,ROOM.height-.18,wallZ],origin));
    assert.equal(above?.texture,currentArt,'wall above lintel hides later rooms');
  }
  const lintel=hit([x,EYE_HEIGHT,door],[0,1,0]);
  assert.equal(lintel?.texture,'copper');
  assert.ok(Math.abs(lintel.distance-(APERTURE.height-EYE_HEIGHT))<.01);
  const sill=hit([x,EYE_HEIGHT,door],[0,-1,0]);
  assert.equal(sill?.texture,'copper','modeled threshold joins the floor under the eye');
  for(const side of [-1,1]){
    const origin=[x+side*(APERTURE.halfWidth+.18),EYE_HEIGHT,door+2];
    const entrance=hit(origin,[0,0,-1]),exit=hit([origin[0],origin[1],door-2],[0,0,1]);
    assert.equal(entrance?.texture,'copper');assert.equal(exit?.texture,'copper');
    assert.ok(Math.abs((4-entrance.distance-exit.distance)-APERTURE.depth)<.06,'front and rear jamb faces enclose real depth');
  }
}
results.push(`${triangles.length} production triangles: all three apertures, wall occlusion, deep jambs, lintels and sills verified in both directions`);

for(let z=STOPS[0];z>STOPS[3]+.16;z-=.16){
  for(const pointerX of [-.09,.09]){
    const origin=[routeX(z)+pointerX,EYE_HEIGHT,z],next=[routeX(z-.16)+pointerX,EYE_HEIGHT,z-.16];
    const segment=sub(next,origin),length=Math.hypot(...segment);
    assert.equal(hit(origin,segment,length),null,'forward camera segment clears every surface');
    assert.equal(hit(next,segment.map(v=>-v),length),null,'return camera segment clears every surface');
  }
}
results.push('continuous forward and reverse camera segments clear the mesh at both pointer extremes');

for(const aspect of [.55,.78,1.3,2.4,3.2])for(const [index,door] of DOORS.entries())for(const direction of [-1,1]){
  const z=STOPS[index+(direction===1?1:0)],distance=Math.abs(door-z)-APERTURE.depth/2;
  const eyeX=routeX(z),lens=lensForAspect(aspect),offset=aspect>1.2?.12:0;
  const project=(x,y,d)=>[.5+offset/2+(x-eyeX)*(-direction)*lens/(2*aspect*d),.5-(y-EYE_HEIGHT)*lens/(2*d)];
  const corners=[-1,1].flatMap(side=>[0,APERTURE.height].map(y=>project(routeX(door)+side*APERTURE.halfWidth,y,distance)));
  assert.ok(corners.every(p=>p.every(v=>v>.025&&v<.975)),'complete doorway is on screen at the departure stop');
  const height=APERTURE.height*lens/(2*distance);
  assert.ok(height>.30&&height<.9,'door has a readable scale at rest');
  const far=project(routeX(door)+APERTURE.halfWidth,EYE_HEIGHT,distance)[0];
  const close=project(routeX(door)+APERTURE.halfWidth,EYE_HEIGHT,distance/2)[0];
  assert.ok(Math.abs(close-(.5+offset/2))>Math.abs(far-(.5+offset/2))*1.9,'jamb moves across the view as the eye approaches');
}
results.push('doorway framing and approach parallax cover portrait through wide landscape');
console.log(JSON.stringify({passed:true,checks:results},null,2));
