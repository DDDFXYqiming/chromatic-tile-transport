'use strict';
const assert=require('node:assert/strict'),D=require('../src/matrix/deformation.js');
const tests=[];function check(name,fn){try{tests.push({name,passed:true,detail:fn()});}catch(e){tests.push({name,passed:false,error:e.message});}}
const distance=(a,b)=>Math.hypot((a[0]-b[0])*1024,(a[1]-b[1])*1536);
check('Face landmarks preserve distances while hair and chest move differently',()=>{
  const landmarks=[[.36,.215],[.54,.215],[.43,.272]],base=distance(landmarks[0],landmarks[1]);let strain=0,localMotion=0;
  for(let n=0;n<120;n++){
    const clock=n/120*Math.PI*2,p=landmarks.map(([u,v])=>D.point('character',u,v,clock,1.5,2/3));
    strain=Math.max(strain,Math.abs(distance(p[0],p[1])/base-1));
    const a=D.point('character',.15,.3,clock,1,2/3),b=D.point('character',.5,.58,clock,1,2/3);
    localMotion=Math.max(localMotion,Math.hypot((a[0]-.15)-(b[0]-.5),(a[1]-.3)-(b[1]-.58)));
  }
  assert.ok(strain<.003,'Face stretch '+strain);assert.ok(localMotion>.01);
  return {maximumFaceDistanceChange:strain,nonRigidDisplacement:localMotion};
});
check('Plane deformations do not invert triangles at maximum supported strength',()=>{
  let minAreaRatio=Infinity;
  for(const kind of ['character','plant'])for(const phase of kind==='character'?[0,.84]:[0,.56,1.4])for(let n=0;n<80;n++){
    const nx=kind==='character'?37:29,ny=kind==='character'?49:29,clock=n/80*Math.PI*2;
    const points=Array.from({length:nx*ny},(_,i)=>D.point(kind,(i%nx)/(nx-1),Math.floor(i/nx)/(ny-1),clock,1.5,kind==='character'?2/3:1.5,phase));
    const area=(a,b,c)=>((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*(nx-1)*(ny-1);
    for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
      const i=y*nx+x;minAreaRatio=Math.min(minAreaRatio,area(points[i],points[i+1],points[i+nx]),area(points[i+1],points[i+nx+1],points[i+nx]));
    }
  }
  assert.ok(minAreaRatio>.4,'Fold or extreme compression: '+minAreaRatio);return {minAreaRatio};
});
check('Vertex buffers return exactly to base at zero strength, reverse deterministically and loop',()=>{
  for(const kind of ['character','plant']){
    const base=new Float32Array([0,0,200,400,700,700,1024,1536]),rig=D.compile(kind,base,1024,1536),out=new Float32Array(base.length);
    D.update(rig,out,1.3,0);assert.deepEqual(out,base);
    D.update(rig,out,1.3);const a=out.slice();D.update(rig,out,4);D.update(rig,out,1.3);assert.deepEqual(out,a);
    D.update(rig,out,0);const start=out.slice();D.update(rig,out,Math.PI*2);out.forEach((v,i)=>assert.ok(Math.abs(v-start[i])<.0001));
  }
});
console.log(JSON.stringify({suite:'matrix-deformation',passed:tests.every(x=>x.passed),tests},null,2));
if(tests.some(x=>!x.passed))process.exitCode=1;
