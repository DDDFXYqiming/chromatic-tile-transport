/** Geometry in a shared receiver space: x/y span the page, z rises off its wall. */
export function projectShadow(point, light) {
  const t=light[2]/(light[2]-point[2]);
  return [light[0]+(point[0]-light[0])*t,light[1]+(point[1]-light[1])*t,0];
}
export function fieldLights(angle=0) {
  return [[-.28+Math.sin(angle)*.42,-.46+Math.cos(angle)*.22,1.15],
    [1.26+Math.cos(angle*.8)*.3,.31+Math.sin(angle+.7)*.32,1.35],
    [.44+Math.cos(angle*.7)*.4,1.48+Math.sin(angle)*.2,1.25]];
}
export function fieldLayout(width,height) {
  const portrait=width/height<.85;
  return portrait
    ? {portrait,center:[.54,.56],size:Math.min(width*.69,height*.27),glyphs:[[.025,.45,.34,.18,-.09],[.69,.55,.28,.16,.08]]}
    : {portrait,center:[.64,.52],size:Math.min(width*.33,height*.50),glyphs:[[.32,.32,.19,.32,-.09],[.78,.52,.18,.30,.08]]};
}
function slab(points,depth=.07) {
  const front=points.map(([x,y,z=0])=>[x,y,z+depth/2]),back=points.map(([x,y,z=0])=>[x,y,z-depth/2]);
  return [front,[...back].reverse(),...front.map((p,i)=>{
    const j=(i+1)%front.length;return [p,back[i],back[j],front[j]];
  })];
}
function sculpture(chapter) {
  const faces=[];
  if(chapter===0){
    const outer=Math.acos(.241/.5),inner=Math.acos((.241-.2)/.44),count=44;
    const point=(i,inside)=>{const t=i/count,a=(inside?inner:outer)+t*(Math.PI*2-2*(inside?inner:outer));
      return [(inside?.2:0)+Math.cos(a)*(inside?.44:.5),Math.sin(a)*(inside?.44:.5)];};
    for(let i=0;i<count;i++)faces.push(...slab([point(i,false),point(i+1,false),point(i+1,true),point(i,true)],.14));
  }else if(chapter===1){
    // Three bent sheets. Depth is geometry, so moving the light changes their silhouettes.
    for(let sheet=0;sheet<3;sheet++)for(let i=0;i<12;i++){
      const point=(j,y)=>{const u=j/12;return [-.42+u*.66+sheet*.1,y+sheet*.045,.18*Math.cos(u*Math.PI)-sheet*.085];};
      faces.push(...slab([point(i,-.45),point(i+1,-.45),point(i+1,.37),point(i,.37)],.025));
    }
  }else if(chapter===2){
    for(let i=0;i<7;i++){
      const x=(i-3)*.135,y=Math.sin(i*.85)*.085,z=(i-3)*.055;
      faces.push(...slab([[x-.043,y-.43,z],[x+.043,y-.43,z],[x+.043,y+.43,z],[x-.043,y+.43,z]],.065));
    }
  }else{
    const rim=[[0,-.56,0],[.43,0,0],[0,.56,0],[-.43,0,0]];
    rim.forEach((p,i)=>{const q=rim[(i+1)%4];faces.push([p,q,[0,0,.25]],[q,p,[0,0,-.2]]);});
  }
  return faces;
}
const MODELS=Array.from({length:4},(_,i)=>sculpture(i));
export function sculptureMesh(chapter,width,height,{view=0,time=0}={}) {
  const {center,size}=fieldLayout(width,height),yaw=.32+view*.65+Math.sin(time*.23)*.09;
  const roll=-.16+Math.sin(time*.17)*.045,cy=Math.cos(yaw),sy=Math.sin(yaw),cr=Math.cos(roll),sr=Math.sin(roll);
  return MODELS[chapter].map(face=>face.map(([x,y,z])=>{
    const a=x*cy+z*sy,b=z*cy-x*sy;
    return [center[0]+(a*cr-y*sr)*size/width,center[1]+(a*sr+y*cr)*size/height,
      .31+b*size/height+Math.sin(time*.4)*.008];
  }));
}
export function faceNormal(face,width,height) {
  const p=face[0],u=face[1].map((v,i)=>(v-p[i])*(i===0?width:height)),v=face[2].map((v,i)=>(v-p[i])*(i===0?width:height));
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)||1;
  return n.map(v=>v/length);
}
