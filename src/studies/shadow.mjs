import {shadowSolid,camera,box,renderFaces,clamp} from './math.mjs';
import {range,button,sky,caption} from './core.mjs';
export async function create(stage,controls) {
  const solid=shadowSolid(27);let angle=0,orbit=.64;
  const input=range(controls,'光源方位',0,90,0,1,v=>{angle=v*Math.PI/180;stage.dirty=true;});
  button(controls,'对齐月影 · 0°',()=>{angle=0;input.value=0;stage.dirty=true;});
  button(controls,'对齐菱影 · 90°',()=>{angle=Math.PI/2;input.value=90;stage.dirty=true;});
  const orbitInput=range(controls,'观察雕塑',-170,170,37,1,v=>{orbit=v*Math.PI/180;stage.dirty=true;});
  const pedestal=box([0,-1.2,0],[2.5,.35,2.5],'#3e545a');
  return {static:true,reset(){angle=0;orbit=.64;input.value=0;orbitInput.value=37;},
    render(){const {ctx,width:w,height:h}=stage;sky(ctx,w,h);
      const mobile=w<640,leftW=mobile?w:w*.51,leftH=mobile?h*.53:h;
      ctx.save();ctx.beginPath();ctx.rect(0,0,leftW,leftH);ctx.clip();
      const cam=camera([Math.sin(orbit)*5,2.3,Math.cos(orbit)*5],[0,-.1,0],leftW,leftH,.96);
      renderFaces(ctx,[...pedestal,...solid.faces],cam,{light:[Math.sin(angle),.3,Math.cos(angle)]});
      caption(ctx,'ONE SOLID / 同一个三维实体',20,30);
      caption(ctx,`${solid.voxels.length} VOXELS · 固定形体，不换模型`,20,leftH-24,'#93aaa9',10);ctx.restore();
      const wallX=mobile?0:leftW,wallY=mobile?leftH:0,wallW=mobile?w:w-leftW,wallH=mobile?h-leftH:h;
      ctx.save();ctx.beginPath();ctx.rect(wallX,wallY,wallW,wallH);ctx.clip();
      const g=ctx.createRadialGradient(wallX+wallW*.5,wallY+wallH*.47,10,wallX+wallW*.5,wallY+wallH*.47,wallW*.8);g.addColorStop(0,'#ede4ca');g.addColorStop(1,'#a6ac9f');ctx.fillStyle=g;ctx.fillRect(wallX,wallY,wallW,wallH);
      const scale=Math.min(wallW,wallH)*.30,cx=wallX+wallW/2,cy=wallY+wallH*.5;
      // Orthographic directional-light projection of the SAME mesh used on the left.
      // At 0° it projects X/Y; at 90° it projects Z/Y. No target silhouette is painted.
      ctx.fillStyle='#1b2e30';
      ctx.beginPath();
      for(const f of solid.faces){let p=f.points.map(p=>[cx+(p[0]*Math.cos(angle)+p[2]*Math.sin(angle))*scale,cy-p[1]*scale]);
        const area=p.reduce((sum,v,i)=>{const q=p[(i+1)%p.length];return sum+v[0]*q[1]-q[0]*v[1];},0);
        if(Math.abs(area)<1e-8)continue;if(area<0)p.reverse();
        p.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();}
      ctx.fill('nonzero');
      caption(ctx,'PROJECTED LIGHT / 平行光投影',wallX+20,wallY+30,'#304945');
      caption(ctx,`${Math.round(angle/Math.PI*180)}°  ·  ${angle<.035?'月牙':angle>1.535?'菱形':'过渡投影'}`,wallX+20,wallY+wallH-24,'#304945');ctx.restore();
      stage.status('形体 = 月牙轮廓挤出体 ∩ 菱形轮廓挤出体 · 只移动光源，不替换影子');
    },inspect:()=>({angle,voxels:solid.voxels.length,faces:solid.faces.length,model:'fixed-intersection-solid'})};
}
