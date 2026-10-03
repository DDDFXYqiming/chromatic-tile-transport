import assert from 'node:assert/strict';
import {createTravel} from '../src/studies/portal-travel.mjs';
import {STOPS,DOORS,APERTURE,routeX,roomAt} from '../src/studies/portal-scene.mjs';

const results=[];
function journey(from,to,hz){
  const travel=createTravel(from),crossed=[];
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
console.log(JSON.stringify({passed:true,checks:results},null,2));
