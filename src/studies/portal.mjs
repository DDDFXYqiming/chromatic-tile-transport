import {camera,face,box,sphere,renderFaces,imageQuad,clamp} from './math.mjs';
import {asset,image,range,button,sky,caption} from './core.mjs';
export async function create(stage,controls) {
  const painting=await image(asset('studies/quiet-orbit.svg'));
  let progress=0,target=0,yaw=0,auto=false;
  const slider=range(controls,'穿越进度',0,100,0,1,v=>{target=v/100;auto=false;stage.dirty=true;});
  button(controls,'穿过画框',()=>{target=target>.5?0:1;auto=false;stage.dirty=true;});
  button(controls,'回头看',()=>{yaw=yaw?0:Math.PI;stage.dirty=true;});
  button(controls,'自动漫游',()=>{auto=!auto;stage.setPlaying(true);});
  const faces=[];
  for(let z=-8;z<8;z+=1)for(let x=-4;x<4;x++) {
    const color=z<0?((x+z)%2?'#6d736c':'#747a72'):((x+z)%2?'#233d47':'#27444d');
    faces.push(face([[x,0,z],[x+1,0,z],[x+1,0,z+1],[x,0,z+1]],color,{stroke:'#35464a'}));
  }
  for(let z=-8;z<8;z+=1)for(const x of [-4,4]) {
    faces.push(face([[x,0,z],[x,4,z],[x,4,z+1],[x,0,z+1]],z<0?'#495b5d':'#1b3542'));
    faces.push(face([[-4,4,z],[4,4,z],[4,4,z+1],[-4,4,z+1]],'#132933'));
  }
  faces.push(...box([0,2,8],[8,4,.1],'#17313c'),...box([0,2,-8],[8,4,.1],'#4a605f'));
  // Four wall pieces leave a real opening. No cross-fade or duplicate screen is used.
  faces.push(...box([-2.65,2,0],[2.7,4,.16],'#264856'),...box([2.65,2,0],[2.7,4,.16],'#264856'),...box([0,3.8,0],[2.6,.4,.16],'#264856'));
  for(const z of [0,-2.5,-5]) {
    const c=z===0?'#c4e2df':'#d0b58b';
    faces.push(...box([-1.32,1.8,z],[.07,3.6,.13],c),...box([1.32,1.8,z],[.07,3.6,.13],c),...box([0,3.6,z],[2.7,.07,.13],c));
  }
  faces.push(...imageQuad([[-2.5,3.55,-7.91],[2.5,3.55,-7.91],[2.5,.42,-7.91],[-2.5,.42,-7.91]],painting));
  faces.push(...box([0,.15,-6.1],[1.15,.3,1.15],'#546763'),...sphere([0,1.0,-6.1],.64,'#ddc8a0'));
  faces.push(...box([-2.55,.55,1.6],[.8,1.1,.8],'#28454f'),...sphere([-2.55,1.48,1.6],.43,'#adc9c6'));
  function reset(){progress=target=0;yaw=0;auto=false;slider.value=0;stage.dirty=true;}
  return {reset,key(key){if(key==='ArrowUp')target=clamp(target+.08);if(key==='ArrowDown')target=clamp(target-.08);if(key==='ArrowLeft')yaw-=.12;if(key==='ArrowRight')yaw+=.12;},
    render(dt){
      if(auto&&dt)target=(1-Math.cos(stage.t*.32))*.5;
      progress=dt?progress+(target-progress)*(1-Math.exp(-dt*4)):target;
      slider.value=String(Math.round(progress*100));
      const {ctx,width:w,height:h,pointer:p}=stage;sky(ctx,w,h);
      const eye=[(p.x-.5)*.68,1.68+(p.y-.5)*-.3,5.7-progress*10.1];
      const cam=camera(eye,[eye[0]+Math.sin(yaw),eye[1]-.015,eye[2]-Math.cos(yaw)],w,h,.92);
      renderFaces(ctx,faces,cam);
      const v=ctx.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,Math.max(w,h)*.68);v.addColorStop(0,'#07131800');v.addColorStop(1,'#050d17bd');ctx.fillStyle=v;ctx.fillRect(0,0,w,h);
      caption(ctx,eye[2]>0?'ROOM A  /  ARCHIVE':'ROOM B  /  OBSERVATORY',24,h-28);
      caption(ctx,'↑ ↓ 行走   ·   ← → 转身',24,h-10,'#76999e',10);
      stage.status(`三维透视 · 镜头 Z ${eye[2].toFixed(2)} · 门洞与前后室在同一个场景中`);
    },inspect:()=>({progress,z:5.7-progress*10.1,faces:faces.length,yaw})};
}
