/** Export production triangles and sampled travel poses for Blender review. */
import {readFileSync,writeFileSync} from 'node:fs';
import {buildPortalGeometry,DOORS,STOPS,routeX,EYE_HEIGHT,lensForAspect} from '../src/studies/portal-scene.mjs';
import {doorBatches,doorPose} from '../src/studies/portal-door.mjs';
import {createTravel} from '../src/studies/portal-travel.mjs';

const catalog=JSON.parse(readFileSync(new URL('../src/studies/catalog.json',import.meta.url),'utf8'));
const chapters=catalog.find(c=>c.id==='portal').chapters;
const asset=JSON.parse(readFileSync(new URL('../assets/studies/portal-door/door.mesh.json',import.meta.url),'utf8'));
const textures=chapters.map(c=>'assets/'+c.image),patina='assets/studies/portal-patina.png';
const batches=[...buildPortalGeometry(textures,patina),...doorBatches(asset,patina,DOORS,routeX)];
const travel=createTravel(STOPS[0],DOORS);travel.go(STOPS[1]);
const frames=[],targets=[0,1.7,2.35,3.85,4.55,5.4,7.6];
let elapsed=0;
for(const target of targets){
  while(elapsed<target-1e-6){travel.step(1/60);elapsed+=1/60;}
  frames.push({label:`walk-${target.toFixed(2)}s`,time:target,z:travel.z,eye:[routeX(travel.z),EYE_HEIGHT,travel.z],yaw:0,
    doors:travel.doors,poses:batches.map(b=>doorPose(b,travel.doors))});
}
writeFileSync(process.argv[2],JSON.stringify({aspect:2.4,lens:lensForAspect(2.4),batches,frames}));
console.log('Production mesh review: '+frames.length+' camera/door poses exported.');
