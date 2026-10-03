import {projectShadow,fieldLights,fieldLayout,sculptureMesh,faceNormal} from './shadow-geometry.mjs';
export {projectShadow,fieldLights,fieldLayout} from './shadow-geometry.mjs';

const LIGHT_COLORS=['#69cfc5','#d68d91','#e9c47a'];
const SHADOW_COLORS=['#123638','#432c3c','#4a3f27'];
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function quad([x,y,w,h,angle],z,aspect) {
  const c=Math.cos(angle),s=Math.sin(angle),u=[w*c,w*s*aspect],v=[-h*s/aspect,h*c];
  return [[x,y,z],[x+u[0],y+u[1],z],[x+u[0]+v[0],y+u[1]+v[1],z],[x+v[0],y+v[1],z]];
}
function screen(points,w,h,view=0){return points.map(([x,y,z])=>[(x+z*(.09+view*.08))*w,(y-z*.16)*h]);}
function path(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();}
function mapped(ctx,texture,p){ctx.save();ctx.transform((p[1][0]-p[0][0])/texture.width,(p[1][1]-p[0][1])/texture.width,(p[3][0]-p[0][0])/texture.height,(p[3][1]-p[0][1])/texture.height,...p[0]);ctx.drawImage(texture,0,0);ctx.restore();}
function glyphTexture(char,color){
  const c=canvas(512,512),ctx=c.getContext('2d');
  ctx.font='430px "Noto Serif CJK SC", "SimSun", serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#fff';ctx.fillText(char,256,268);ctx.globalCompositeOperation='source-in';
  if(color){ctx.fillStyle=color;ctx.fillRect(0,0,512,512);return c;}
  const g=ctx.createLinearGradient(0,0,480,448);
  [[0,'#fae2ab'],[.3,'#b78757'],[.49,'#eee0ae'],[.52,'#83623e'],[.8,'#c7ad78'],[1,'#72938c']].forEach(([p,c])=>g.addColorStop(p,c));
  ctx.fillStyle=g;ctx.fillRect(0,0,512,512);return c;
}
export function exhibitionRenderer(chapters) {
  const glyphs=chapters.map(c=>Array.from(c.display).map(char=>({face:glyphTexture(char),side:glyphTexture(char,'#473622'),shadows:SHADOW_COLORS.map(color=>glyphTexture(char,color))})));
  const shadow=canvas(1,1),sc=shadow.getContext('2d'),grain=canvas(180,180),g=grain.getContext('2d');let seed=17,last={};
  for(let i=0;i<5000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;g.fillStyle=i%2?'#ffffff08':'#0000000b';g.fillRect(seed%180,(seed>>>9)%180,1,1);}
  function draw(ctx,w,h,{chapter,angle,view,time,strength}){
    const layout=fieldLayout(w,h),lights=fieldLights(angle),mesh=sculptureMesh(chapter,w,h,{view,time});
    const objects=layout.glyphs.map((box,i)=>({texture:glyphs[chapter][i],q:quad(box,.115,w/h)}));
    const atmosphere=ctx.createLinearGradient(0,0,w,h);
    atmosphere.addColorStop(0,'#122c2b');atmosphere.addColorStop(.56,chapter===1?'#77705a':'#6c7966');atmosphere.addColorStop(1,'#203b36');
    ctx.fillStyle=atmosphere;ctx.fillRect(0,0,w,h);
    // Light pools and their silhouettes follow the same moving sources.
    for(let i=0;i<3;i++){
      const x=(.5+(lights[i][0]-.5)*.44)*w,y=(.5+(lights[i][1]-.5)*.5)*h,r=Math.max(w,h)*.75;
      const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,LIGHT_COLORS[i]+'55');glow.addColorStop(1,LIGHT_COLORS[i]+'00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    }
    ctx.strokeStyle='#efe0b914';ctx.lineWidth=1;
    for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(w*i/5,0);ctx.lineTo(w*i/5-w*.13,h);ctx.stroke();}
    ctx.save();ctx.translate(w*.035,h*(layout.portrait?.36:.25));ctx.rotate(-.025);
    ctx.font=`${w*(layout.portrait?.145:.118)}px Georgia,serif`;ctx.fillStyle='#e4d6b71a';ctx.fillText('PENUMBRA',0,0);ctx.restore();
    // Union opaque mesh faces before compositing each light once, avoiding dark seams.
    const sw=Math.max(1,Math.round(w*.75)),sh=Math.max(1,Math.round(h*.75));
    if(shadow.width!==sw||shadow.height!==sh){shadow.width=sw;shadow.height=sh;}
    let projectedFaces=0;
    for(let li=0;li<lights.length;li++){
      sc.clearRect(0,0,sw,sh);sc.fillStyle=SHADOW_COLORS[li];sc.strokeStyle=SHADOW_COLORS[li];sc.lineWidth=.65;
      for(const face of mesh){path(sc,screen(face.map(p=>projectShadow(p,lights[li])),sw,sh));sc.fill();sc.stroke();projectedFaces++;}
      ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=strength*(li===0?.72:.56);ctx.drawImage(shadow,0,0,w,h);
      for(const object of objects)mapped(ctx,object.texture.shadows[li],screen(object.q.map(p=>projectShadow(p,lights[li])),w,h));
      ctx.restore();
    }
    ctx.save();ctx.translate(w*(layout.portrait?.07:.35),h*.79);ctx.rotate(-.02);
    ctx.font=`italic ${Math.min(w*.033,h*.044)}px Georgia,serif`;ctx.fillStyle='#ead9b96b';ctx.fillText(chapters[chapter].english,0,0);ctx.restore();
    for(const o of objects){
      for(let k=0;k<5;k++)mapped(ctx,o.texture.side,screen(o.q.map(([x,y,z])=>[x,y,z-.02+k*.004]),w,h,view));
      mapped(ctx,o.texture.face,screen(o.q,w,h,view));
    }
    // Surface normals, light directions and the shadow rays share one geometry.
    const faces=mesh.map(face=>({face,normal:faceNormal(face,w,h),center:face[0].map((_,i)=>face.reduce((s,p)=>s+p[i],0)/face.length)}))
      .filter(o=>o.normal[2]+o.normal[1]*.16-o.normal[0]*(.09+view*.08)*w/h>0)
      .sort((a,b)=>a.center[2]-b.center[2]);
    for(const {face,normal,center} of faces){
      const rgb=[58,44,29];
      lights.forEach((light,i)=>{
        const delta=light.map((v,j)=>(v-center[j])*(j===0?w:h)),length=Math.hypot(...delta);
        const diffuse=Math.max(0,normal.reduce((sum,n,j)=>sum+n*delta[j]/length,0));
        const specular=Math.pow(Math.max(0,normal[2]*.85+diffuse*.3),16);
        const tint=[[95,115,92],[127,75,52],[137,114,67]][i];
        for(let j=0;j<3;j++)rgb[j]+=tint[j]*diffuse*.82+specular*20;
      });
      const color=`rgb(${rgb.map(v=>Math.round(Math.min(255,v))).join(',')})`;
      path(ctx,screen(face,w,h,view));ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=.6;ctx.fill();ctx.stroke();
    }
    ctx.save();ctx.globalAlpha=.15;ctx.strokeStyle='#fff1c5';ctx.lineWidth=.6;
    for(const {face,normal} of faces)if(normal[2]>.65){path(ctx,screen(face,w,h,view));ctx.stroke();}
    ctx.restore();ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.fillRect(0,0,w,h);
    const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#091c1bea');shade.addColorStop(.18,'#091c1b00');shade.addColorStop(.72,'#091c1b00');shade.addColorStop(1,'#091c1bf2');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    if(!layout.portrait){const veil=ctx.createLinearGradient(0,0,w*.4,0);veil.addColorStop(0,'#0a2224c0');veil.addColorStop(1,'#0a222400');ctx.fillStyle=veil;ctx.fillRect(0,0,w,h);}
    last={lights,shadowDirections:lights.length,receiver:'full-viewport',contentPlanes:objects.length,sculptureFaces:mesh.length,projectedFaces,
      sculpture:['crescent','curved-sheets','seven-plates','diamond'][chapter],portrait:layout.portrait,renderedChapter:chapters[chapter].id};
  }
  return {draw,inspect:()=>last};
}
