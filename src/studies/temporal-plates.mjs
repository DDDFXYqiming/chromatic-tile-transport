import {clamp,mix} from './math.mjs';
import {coverFit} from './core.mjs';

export const RAIN_HORIZON=.57;
export function rainDelay(x,y,pointer={x:.5,y:.5}){
  const water=clamp((y-RAIN_HORIZON)/(1-RAIN_HORIZON));
  return water*clamp(.35+Math.abs(x-pointer.x)*.65+(1-pointer.y)*.25);
}
export function rainOffset(y,t,pointer,depth){
  const water=clamp((y-RAIN_HORIZON)/(1-RAIN_HORIZON));
  const delayed=t-depth*rainDelay(.65,y,pointer);
  return Math.sin(water*55-delayed*2.4+pointer.x*4)*water*.008*depth/2.6+
    Math.sin(water*117+delayed*1.3)*water*.003*depth/2.6;
}
export function rainFit(img,w,h){
  const fit=coverFit(img.width,img.height,w,h);
  fit.x=clamp(w*.63-fit.width*.66,w-fit.width,0);
  return fit;
}
export function drawRainEcho(ctx,w,h,img,t,pointer,depth,{reduced=false}={}){
  const fit=rainFit(img,w,h),time=reduced?0:t;
  ctx.drawImage(img,fit.x,fit.y,fit.width,fit.height);
  if(depth===0)return;
  ctx.save();ctx.translate(fit.x,fit.y);ctx.scale(fit.width,fit.height);
  // The shoreline is authored in plate coordinates, so it survives cover cropping.
  ctx.beginPath();ctx.moveTo(0,.67);ctx.lineTo(.37,.60);ctx.lineTo(.64,RAIN_HORIZON);
  ctx.lineTo(1,.61);ctx.lineTo(1,1);ctx.lineTo(0,1);ctx.closePath();ctx.clip();
  const rows=150,top=RAIN_HORIZON;
  for(let row=0;row<rows;row++){
    const y=top+(1-top)*row/rows,dy=(1-top)/rows;
    const shift=rainOffset(y,time,pointer,depth),inset=.018;
    ctx.drawImage(img,inset*img.width,y*img.height,(1-inset*2)*img.width,dy*img.height,
      shift-inset,y,1+inset*2,dy+.0008);
  }
  // Broken caustics follow the three lamp reflections already in the painting.
  ctx.globalCompositeOperation='screen';ctx.lineCap='round';
  for(let lamp=0;lamp<3;lamp++)for(let i=0;i<22;i++){
    const y=.61+i*.017,x=[.535,.648,.935][lamp]+rainOffset(y,time,pointer,depth)*1.5;
    const pulse=(Math.sin(time*1.3-i*.83+lamp)+1)*.5;
    ctx.globalAlpha=(.06+pulse*.12)*depth/2.6;
    ctx.strokeStyle=lamp===1?'#ffdda7':'#df966c';ctx.lineWidth=.0008+(y-.6)*.002;
    ctx.beginPath();ctx.moveTo(x-.002-pulse*.006,y);ctx.lineTo(x+.004+pulse*.009,y);ctx.stroke();
  }
  ctx.restore();
  return {fit,waterline:RAIN_HORIZON};
}

export function foldOpening(t,pointer={x:.5,y:.5},reduced=false){
  // A complete open/hold/close breath. Pointer offsets the sampled baked pose.
  const cycle=(Math.sin(t*.48-.6)+1)*.5;
  return clamp((reduced?.83:.23+.73*cycle)+(pointer.x-.5)*.24,.08,1);
}
export function sampleFold(mesh,opening){
  const position=clamp(opening)*(mesh.frames.length-1),a=Math.floor(position),b=Math.min(a+1,mesh.frames.length-1);
  return mesh.frames[a].map((vertex,i)=>vertex.map((value,k)=>mix(value,mesh.frames[b][i][k],position-a)));
}
export function projectFold(mesh,w,h,t,pointer,reduced=false){
  const opening=foldOpening(t,pointer,reduced),vertices=sampleFold(mesh,opening);
  const portrait=w/h<.9,scale=portrait?w*.124:Math.min(w*.087,h*.13);
  const cx=w*(portrait?.52:.65),cy=portrait?Math.min(h*.4,150+w*.28):h*.405;
  const yaw=-.18+(pointer.x-.5)*.24,pitch=-.15+(pointer.y-.5)*.12;
  const roll=portrait?-.10:-.075;
  const points=vertices.map(([x,y,z])=>{
    const xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
    const yy=y*Math.cos(pitch)-zz*Math.sin(pitch),zz2=y*Math.sin(pitch)+zz*Math.cos(pitch);
    const perspective=12/(12-zz2);
    return [cx+(xx*Math.cos(roll)-yy*Math.sin(roll))*scale*perspective,
      cy-(xx*Math.sin(roll)+yy*Math.cos(roll))*scale*perspective,zz2];
  });
  return {points,opening,scale,cx,cy};
}
function trianglePath(ctx,p){ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);ctx.lineTo(p[1][0],p[1][1]);ctx.lineTo(p[2][0],p[2][1]);ctx.closePath();}
export function textureTriangle(ctx,img,points,uv){
  const s=uv.map(([u,v])=>[u*img.width,(1-v)*img.height]);
  const [[x0,y0],[x1,y1],[x2,y2]]=s,[[u0,v0],[u1,v1],[u2,v2]]=points;
  const determinant=x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1);
  if(Math.abs(determinant)<1e-9)return;
  const coefficient=(a,b,c)=>[(a*(y1-y2)+b*(y2-y0)+c*(y0-y1))/determinant,
    (a*(x2-x1)+b*(x0-x2)+c*(x1-x0))/determinant,
    (a*(x1*y2-x2*y1)+b*(x2*y0-x0*y2)+c*(x0*y1-x1*y0))/determinant];
  const [a,c,e]=coefficient(u0,u1,u2),[b,d,f]=coefficient(v0,v1,v2);
  // A small overlap prevents antialias cracks between UV triangles.
  const center=[points.reduce((s,p)=>s+p[0],0)/3,points.reduce((s,p)=>s+p[1],0)/3];
  const clip=points.map(p=>{const dx=p[0]-center[0],dy=p[1]-center[1],length=Math.hypot(dx,dy)||1;return [p[0]+dx/length*1.2,p[1]+dy/length*1.2];});
  const sx=Math.max(0,Math.min(x0,x1,x2)-1),sy=Math.max(0,Math.min(y0,y1,y2)-1);
  const sw=Math.min(img.width,Math.max(x0,x1,x2)+1)-sx,sh=Math.min(img.height,Math.max(y0,y1,y2)+1)-sy;
  ctx.save();trianglePath(ctx,clip);ctx.clip();ctx.transform(a,b,c,d,e,f);
  ctx.drawImage(img,sx,sy,sw,sh,sx,sy,sw,sh);ctx.restore();
}
export function drawDawnLetter(ctx,w,h,img,mesh,t,pointer,{reduced=false}={}){
  const atmosphere=ctx.createLinearGradient(0,h,w,0);
  atmosphere.addColorStop(0,'#0a171e');atmosphere.addColorStop(.55,'#1a3038');atmosphere.addColorStop(1,'#6c5549');
  ctx.fillStyle=atmosphere;ctx.fillRect(0,0,w,h);
  const fit=coverFit(img.width,img.height,w,h);
  ctx.save();ctx.globalAlpha=.13;ctx.drawImage(img,fit.x,fit.y,fit.width,fit.height);ctx.restore();
  const pose=projectFold(mesh,w,h,t,pointer,reduced),{points,scale,cx,cy}=pose;
  // The letter casts one broad studio shadow; the image itself remains on the paper.
  ctx.save();ctx.translate(cx,cy+scale*2.45);ctx.scale(1,.13);
  const shadow=ctx.createRadialGradient(0,0,scale*.1,0,0,scale*3.4);
  shadow.addColorStop(0,'#00000075');shadow.addColorStop(1,'#00000000');
  ctx.fillStyle=shadow;ctx.fillRect(-scale*4,-scale*4,scale*8,scale*8);ctx.restore();
  const columns=(mesh.uv.filter(v=>v[1]===0)).length,rows=mesh.uv.length/columns;
  const leaves=Array.from({length:mesh.panels},(_,side)=>{
    const left=side*(columns-1)/mesh.panels,right=(side+1)*(columns-1)/mesh.panels;
    const corners=[left,right,(rows-1)*columns+right,(rows-1)*columns+left].map(i=>points[i]);
    return {side,corners,faces:[],z:corners.reduce((sum,p)=>sum+p[2],0)/4};
  });
  for(const face of mesh.faces){
    const side=Math.min(mesh.panels-1,Math.floor(face.reduce((s,i)=>s+mesh.uv[i][0],0)/3*mesh.panels));
    leaves[side].faces.push(face);
  }
  for(const {side,corners,faces} of leaves.sort((a,b)=>a.z-b.z)){
    for(const face of faces)textureTriangle(ctx,img,face.map(i=>points[i]),face.map(i=>mesh.uv[i]));
    const [a,b,c]=corners,back=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0;
    const shade=(1-pose.opening)*(side%2?.42:.07);
    ctx.beginPath();ctx.moveTo(...corners[0].slice(0,2));
    for(const p of corners.slice(1))ctx.lineTo(...p.slice(0,2));ctx.closePath();
    ctx.fillStyle=back?'#dbd6c5':`rgba(8,24,35,${shade})`;ctx.fill();
  }
  // Thin ivory edge and actual hinge lines make the cotton paper legible at rest.
  ctx.save();ctx.lineWidth=.8;ctx.strokeStyle='#ffebcb80';
  for(let i=0;i<=mesh.panels;i++){
    const col=i*(columns-1)/mesh.panels,a=points[col],b=points[(rows-1)*columns+col];
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  }
  for(const row of [0,rows-1]){
    ctx.beginPath();for(let col=0;col<columns;col++){const p=points[row*columns+col];if(col===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);}ctx.stroke();
  }
  ctx.restore();return pose;
}
