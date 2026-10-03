/** A shared receiver plane, elevated type, and three independent point lights. */
export function projectShadow(point, light) {
  const t=light[2]/(light[2]-point[2]);
  return [light[0]+(point[0]-light[0])*t,light[1]+(point[1]-light[1])*t,0];
}
export function fieldLights(angle=0) {
  return [[-.38+Math.sin(angle)*.28,-.65,1.3],[1.45,.18+Math.sin(angle+.7)*.35,1.55],[.35+Math.cos(angle)*.4,1.65,1.45]];
}
export function fieldLayout(width,height) {
  const portrait=width/height<.85;
  return portrait ? {portrait,glyphs:[[.10,.29,.47,.24,-.10],[.45,.40,.47,.24,.10]],plates:[[.06,.60,.29,.17,-.09],[.66,.18,.27,.18,.10]]}
    : {portrait,glyphs:[[.25,.25,.29,.40,-.10],[.51,.34,.29,.40,.09]],plates:[[.045,.42,.19,.30,-.10],[.795,.19,.17,.30,.10]]};
}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function quad([x,y,w,h,angle],z,aspect) {
  const c=Math.cos(angle),s=Math.sin(angle),u=[w*c,w*s*aspect],v=[-h*s/aspect,h*c];
  return [[x,y,z],[x+u[0],y+u[1],z],[x+u[0]+v[0],y+u[1]+v[1],z],[x+v[0],y+v[1],z]];
}
function screen(points,w,h,view=0){return points.map(([x,y,z])=>[(x+z*(.09+view*.08))*w,(y-z*.22)*h]);}
function path(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();}
function mapped(ctx,texture,p){ctx.save();ctx.transform((p[1][0]-p[0][0])/texture.width,(p[1][1]-p[0][1])/texture.width,(p[3][0]-p[0][0])/texture.height,(p[3][1]-p[0][1])/texture.height,...p[0]);ctx.drawImage(texture,0,0);ctx.restore();}
function glyphTexture(char,color){
  const c=canvas(640,640),ctx=c.getContext('2d');
  ctx.font='540px "Noto Serif CJK SC", "SimSun", serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#fff';ctx.fillText(char,320,335);
  ctx.globalCompositeOperation='source-in';
  if(color){ctx.fillStyle=color;ctx.fillRect(0,0,640,640);return c;}
  const g=ctx.createLinearGradient(0,0,600,560);[[0,'#fff0cb'],[.19,'#b67c47'],[.36,'#fce8bd'],[.49,'#916034'],[.55,'#d4b98e'],[.75,'#73928b'],[1,'#e2cba0']].forEach(([p,c])=>g.addColorStop(p,c));ctx.fillStyle=g;ctx.fillRect(0,0,640,640);
  ctx.globalAlpha=.1;ctx.fillStyle='#fff0ce';for(let y=0;y<640;y+=3)ctx.fillRect(0,y,640,1);
  return c;
}
function cropTexture(img){const c=canvas(460,580),ctx=c.getContext('2d'),s=Math.max(460/img.width,580/img.height);ctx.drawImage(img,(460-img.width*s)/2,(580-img.height*s)/2,img.width*s,img.height*s);return c;}
export function exhibitionRenderer(images,chapters) {
  const glyphs=chapters.map(c=>Array.from(c.display).map(char=>({face:glyphTexture(char),side:glyphTexture(char,'#453824'),edge:glyphTexture(char,'#f4dba7'),shadows:['#082c30','#382337','#392d1d'].map(color=>glyphTexture(char,color))})));
  const plates=images.map(cropTexture),grain=canvas(180,180),g=grain.getContext('2d');let seed=17;
  for(let i=0;i<6000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;g.fillStyle=i%2?'#ffffff08':'#00000012';g.fillRect(seed%180,(seed>>>9)%180,1,1);}
  let last={};
  function draw(ctx,w,h,{chapter,angle,view,time,strength}){
    const layout=fieldLayout(w,h),lights=fieldLights(angle),aspect=w/h,colors=['#54b9b5','#cb8675','#d6b46b'];
    ctx.fillStyle='#102321';ctx.fillRect(0,0,w,h);
    const atmosphere=ctx.createLinearGradient(0,0,w,h);atmosphere.addColorStop(0,'#182d2c');atmosphere.addColorStop(.48,'#5c6451');atmosphere.addColorStop(1,'#102724');ctx.fillStyle=atmosphere;ctx.fillRect(0,0,w,h);
    for(let i=0;i<3;i++){
      const x=[.1,.93,.53][i]*w,y=[.29,.47,.98][i]*h,r=Math.max(w,h)*.7;
      const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,colors[i]+'50');glow.addColorStop(1,colors[i]+'00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    }
    // Architectural lines run across the same plane as every cast shadow.
    ctx.strokeStyle='#ecdab315';ctx.lineWidth=1;
    for(let i=-4;i<14;i++){ctx.beginPath();ctx.moveTo(i*w/9,0);ctx.lineTo(i*w/9-w*.32,h);ctx.stroke();}
    for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(0,h*i/8);ctx.lineTo(w,h*i/8-w*.05);ctx.stroke();}
    ctx.save();ctx.translate(w*.035,h*(layout.portrait?.24:.225));ctx.rotate(-.035);ctx.font=`${w*(layout.portrait?.15:.122)}px Georgia,serif`;ctx.fillStyle='#e4d6b723';ctx.fillText('PENUMBRA',0,0);ctx.restore();
    const objects=layout.glyphs.map((box,i)=>({type:'glyph',texture:glyphs[chapter][i],q:quad(box,.17,aspect)}));
    layout.plates.forEach((box,i)=>objects.push({type:'plate',texture:plates[(chapter+i)%plates.length],q:quad(box,.105,aspect)}));
    // The exact same elevated planes supply the front faces and all shadow directions.
    for(let li=0;li<lights.length;li++)for(const object of objects){
      const points=screen(object.q.map(p=>projectShadow(p,lights[li])),w,h,view);
      ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=strength*(li===0?.68:.50);
      if(object.type==='glyph')mapped(ctx,object.texture.shadows[li],points);
      else{path(ctx,points);ctx.fillStyle=['#0b3335','#472238','#403922'][li];ctx.fill();}
      ctx.restore();
    }
    // Fine reflected lines and a broad ground inscription remain behind the raised type.
    ctx.save();ctx.translate(w*.04,h*.805);ctx.rotate(-.025);ctx.font=`italic ${w*(layout.portrait?.065:.05)}px Georgia,serif`;ctx.fillStyle='#e8d9b955';ctx.fillText(chapters[chapter].english,0,0);ctx.restore();
    for(const o of objects){
      if(o.type==='glyph'){
        for(let k=0;k<10;k++){const p=screen(o.q.map(([x,y,z])=>[x,y,z-.028+k*.0028]),w,h,view);mapped(ctx,o.texture.side,p);}
        mapped(ctx,o.texture.edge,screen(o.q.map(([x,y,z])=>[x-.0008,y-.001,z]),w,h,view));
        mapped(ctx,o.texture.face,screen(o.q,w,h,view));
      }else{
        const points=screen(o.q,w,h,view);ctx.save();ctx.shadowColor='#071612a0';ctx.shadowBlur=15;ctx.shadowOffsetY=8;path(ctx,points);ctx.fillStyle='#c9b488';ctx.fill();ctx.restore();
        mapped(ctx,o.texture,points);path(ctx,points);ctx.strokeStyle='#e3cda080';ctx.lineWidth=1;ctx.stroke();
      }
    }
    // Moving light threads span the exhibition, not a separate instrument diagram.
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<3;i++){const y=h*(.2+i*.25+Math.sin(angle+i)*.06),beam=ctx.createLinearGradient(0,y,w,h-y);beam.addColorStop(0,colors[i]+'00');beam.addColorStop(.45,colors[i]+'5a');beam.addColorStop(1,colors[i]+'00');ctx.strokeStyle=beam;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,h-y);ctx.stroke();}
    for(let i=0;i<32;i++){const x=((i*.61803+time*.002)%1)*w,y=((i*.3819)%1)*h;ctx.fillStyle=i%3?'#f5e0b74a':'#c6f7ef65';ctx.fillRect(x,y,i%5?1:2,1);}
    ctx.restore();ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.fillRect(0,0,w,h);
    const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#081814d9');shade.addColorStop(.16,'#08181400');shade.addColorStop(.72,'#08181400');shade.addColorStop(1,'#081814f2');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    last={lights,shadowDirections:lights.length,receiver:'full-viewport',contentPlanes:objects.length,portrait:layout.portrait,renderedChapter:chapters[chapter].id};
  }
  return {draw,inspect:()=>last};
}
