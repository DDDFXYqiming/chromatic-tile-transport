import {clamp} from './math.mjs';
import {asset,image,sampleImage,offscreen,range,button,fileInput,bilinear,coverFit} from './core.mjs';
import {pigmentRegion,hitRegion,pigmentStroke,POINTER_WEIGHT} from './fluid-regions.mjs';
/** Semi-Lagrangian velocity transport + pressure projection, in grid-cell units. */
export class Fluid {
  constructor(w=96,h=60,iterations=20) {
    this.w=w;this.h=h;this.stride=w+2;this.size=(w+2)*(h+2);
    this.iterations=iterations;this.mask=null;this.speed=0;
    for(const k of ['u','v','u0','v0','p','p0','div'])this[k]=new Float32Array(this.size);
  }
  setMask(weight){
    this.weight=weight;
    this.mask=new Float32Array(this.size);
    for(let y=1;y<=this.h;y++)for(let x=1;x<=this.w;x++)this.mask[y*this.stride+x]=weight((x-.5)/this.w,(y-.5)/this.h);
  }
  boundary(a,type=0) {
    const {w,h,stride:s}=this;
    for(let x=1;x<=w;x++){a[x]=type===2?-a[s+x]:a[s+x];a[(h+1)*s+x]=type===2?-a[h*s+x]:a[h*s+x];}
    for(let y=1;y<=h;y++){a[y*s]=type===1?-a[y*s+1]:a[y*s+1];a[y*s+w+1]=type===1?-a[y*s+w]:a[y*s+w];}
    a[0]=(a[1]+a[s])*.5;a[w+1]=(a[w]+a[w+1+s])*.5;
    a[(h+1)*s]=(a[h*s]+a[(h+1)*s+1])*.5;a[(h+1)*s+w+1]=(a[h*s+w+1]+a[(h+1)*s+w])*.5;
  }
  sample(a,x,y){const s=this.stride;x=clamp(x,.5,this.w+.5);y=clamp(y,.5,this.h+.5);const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,k=j*s+i;return (a[k]*(1-u)+a[k+1]*u)*(1-v)+(a[k+s]*(1-u)+a[k+s+1]*u)*v;}
  project(iterations=20) {
    const {w,h,stride:s,u,v,div,mask}=this;this.p.fill(0);this.p0.fill(0);
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x;div[i]=mask&&!mask[i]?0:-.5*(u[i+1]-u[i-1]+v[i+s]-v[i-s]);}
    this.boundary(div);
    for(let k=0;k<iterations;k++){
      const p=this.p,q=this.p0;
      for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){
        const i=y*s+x;
        if(!mask){q[i]=(div[i]+p[i-1]+p[i+1]+p[i-s]+p[i+s])*.25;continue;}
        if(!mask[i]){q[i]=0;continue;}
        const l=mask[i-1]>0,r=mask[i+1]>0,t=mask[i-s]>0,b=mask[i+s]>0;
        q[i]=(div[i]+p[i-1]*l+p[i+1]*r+p[i-s]*t+p[i+s]*b)/(l+r+t+b||1);
      }
      this.boundary(q);this.p=q;this.p0=p;
    }
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){
      const i=y*s+x,p=this.p;
      if(mask&&!mask[i]){u[i]=v[i]=0;continue;}
      const l=mask&&!mask[i-1]?p[i]:p[i-1],r=mask&&!mask[i+1]?p[i]:p[i+1];
      const t=mask&&!mask[i-s]?p[i]:p[i-s],b=mask&&!mask[i+s]?p[i]:p[i+s];
      u[i]-=.5*(r-l);v[i]-=.5*(b-t);
    }
    this.boundary(u,1);this.boundary(v,2);
  }
  step(dt,damping=.6) {
    this.u0.set(this.u);this.v0.set(this.v);const {w,h,stride:s}=this;
    const decay=Math.exp(-damping*dt);
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x,px=x-dt*this.u0[i],py=y-dt*this.v0[i],m=this.mask&&!this.mask[i]?0:1;this.u[i]=this.sample(this.u0,px,py)*decay*m;this.v[i]=this.sample(this.v0,px,py)*decay*m;}
    this.boundary(this.u,1);this.boundary(this.v,2);this.project(this.iterations);
    this.speed=0;
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){
      const i=y*s+x,m=this.mask?this.mask[i]:1;
      this.u[i]*=m;this.v[i]*=m;
      this.speed=Math.max(this.speed,Math.abs(this.u[i])/w,Math.abs(this.v[i])/h);
    }
  }
  splat(x,y,dx,dy,radius=.14) {
    // Reject the origin before the brush radius can reach a nearby pigment.
    if(![x,y,dx,dy,radius].every(Number.isFinite)||x<0||x>1||y<0||y>1||radius<=0||
      (!dx&&!dy)||(this.weight&&this.weight(x,y)<=POINTER_WEIGHT))return false;
    let changed=false;
    const reach=radius*1.52;
    for(let j=Math.max(1,Math.floor((y-reach)*this.h));j<=Math.min(this.h,Math.ceil((y+reach)*this.h));j++)for(let i=Math.max(1,Math.floor((x-reach)*this.w));i<=Math.min(this.w,Math.ceil((x+reach)*this.w));i++) {
      const r2=(((i-.5)/this.w-x)**2+((j-.5)/this.h-y)**2)/(radius*radius),f=Math.exp(-r2*3);
      if(f<.001)continue;const k=j*this.stride+i,m=this.mask?this.mask[k]:1;
      if(!m)continue;changed=true;
      this.u[k]=clamp(this.u[k]+dx*this.w*f*12*m,-170,170);this.v[k]=clamp(this.v[k]+dy*this.h*f*12*m,-170,170);
    }
    return changed;
  }
  divergenceEnergy(){let v=0;const s=this.stride;for(let y=2;y<this.h;y++)for(let x=2;x<this.w;x++){const i=y*s+x;v+=(this.u[i+1]-this.u[i-1]+this.v[i+s]-this.v[i-s])**2;}return v;}
}
/** Advect source coordinates, retaining the original artwork's texture resolution. */
export class PigmentField {
  constructor(w=144,h=96){this.w=w;this.h=h;this.uv=new Float32Array(w*h*2);this.next=new Float32Array(this.uv.length);this.bytes=new Uint8Array(w*h*4);this.mask=new Uint8Array(w*h).fill(255);this.cells=Array.from(this.mask,(_,i)=>i);this.reset();}
  reset(){for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){const k=(y*this.w+x)*2;this.uv[k]=(x+.5)/this.w;this.uv[k+1]=(y+.5)/this.h;}this.next.set(this.uv);}
  setMask(weight){
    this.cells=[];
    for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){const i=y*this.w+x;this.mask[i]=Math.round(weight((x+.5)/this.w,(y+.5)/this.h)*255);if(this.mask[i])this.cells.push(i);}
  }
  step(fluid,dt){
    const {w,h,uv,next}=this;
    for(const cell of this.cells){
      const x=cell%w,y=Math.floor(cell/w);
      const gx=(x+.5)/w*fluid.w+.5,gy=(y+.5)/h*fluid.h+.5;
      const sx=x-fluid.sample(fluid.u,gx,gy)*dt*w/fluid.w,sy=y-fluid.sample(fluid.v,gx,gy)*dt*h/fluid.h,k=(y*w+x)*2;
      const u=Math.fround(bilinear(uv,w,h,sx,sy,0,2)),v=Math.fround(bilinear(uv,w,h,sx,sy,1,2));
      // Do not pull tabletop, blank paper or glass into the pigment layer.
      const sourceCell=Math.min(h-1,Math.floor(v*h))*w+Math.min(w-1,Math.floor(u*w));
      const inside=this.mask[sourceCell]>0;
      next[k]=inside?u:uv[k];next[k+1]=inside?v:uv[k+1];
    }
    this.uv=next;this.next=uv;
  }
  encode(){
    for(let i=0;i<this.uv.length;i+=2){const x=Math.round(clamp(this.uv[i])*65535),y=Math.round(clamp(this.uv[i+1])*65535),k=i*2;this.bytes[k]=x>>8;this.bytes[k+1]=x&255;this.bytes[k+2]=y>>8;this.bytes[k+3]=y&255;}
    return this.bytes;
  }
}

// WebGL only samples the CPU's flow map; there is no second simulation clock.
// The 2D fallback reads that same map, including after a lost WebGL context.
function pigmentRenderer(field){
  const canvas=offscreen(1,1),fallback=offscreen(432,288),frozen=offscreen(1,1),ctx=fallback.getContext('2d');
  let pixels=new ImageData(432,288),gl=canvas.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:true}),program,buffer,textures=[],source,sourceWidth=432,sourceHeight=288,disposed=false,cached=null,uploads=0;
  let rect={x:0,y:0,width:1,height:1};
  function disposeGL(){if(!gl)return;textures.forEach(t=>gl.deleteTexture(t));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);gl=null;}
  try{
    if(gl){
      const shader=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(error);}return s;};
      const vs=shader(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 uv; uniform vec4 bounds; void main(){uv=bounds.xy+vec2(position.x*.5+.5,.5-position.y*.5)*bounds.zw;gl_Position=vec4(position,0.,1.);}');
      const fs=shader(gl.FRAGMENT_SHADER,'precision highp float; varying vec2 uv; uniform sampler2D artwork; uniform sampler2D flow; uniform sampler2D region; void main(){float a=texture2D(region,uv).r;if(a<.004){gl_FragColor=vec4(0.);return;}vec4 p=texture2D(flow,uv);vec2 q=vec2(dot(p.rg,vec2(65280.,255.)),dot(p.ba,vec2(65280.,255.)))/65535.;gl_FragColor=vec4(texture2D(artwork,q).rgb*a,a);}');
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      for(let unit=0;unit<3;unit++){
        const texture=gl.createTexture();textures.push(texture);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
        for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
        for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
      }
      gl.uniform1i(gl.getUniformLocation(program,'artwork'),0);gl.uniform1i(gl.getUniformLocation(program,'flow'),1);gl.uniform1i(gl.getUniformLocation(program,'region'),2);
    }
  }catch{disposeGL();}
  const lost=e=>{e.preventDefault();gl=null;cached=null;};canvas.addEventListener('webglcontextlost',lost);
  return {
    setImage(img){
      cached=null;
      let left=field.w,top=field.h,right=0,bottom=0;
      for(const i of field.cells){const x=i%field.w,y=Math.floor(i/field.w);left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
      // Include the mask's bilinear fringe; only this rectangle is rendered and
      // copied from WebGL to the stage. The rest stays the untouched source.
      left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(field.w,Math.max(left+1,right+2));bottom=Math.min(field.h,Math.max(top+1,bottom+2));
      rect={x:left/field.w,y:top/field.h,width:(right-left)/field.w,height:(bottom-top)/field.h};
      const scale=Math.min(432/img.width,288/img.height);
      sourceWidth=Math.max(1,Math.round(img.width*scale));sourceHeight=Math.max(1,Math.round(img.height*scale));
      fallback.width=Math.max(1,Math.round(sourceWidth*rect.width));fallback.height=Math.max(1,Math.round(sourceHeight*rect.height));
      pixels=new ImageData(fallback.width,fallback.height);source=sampleImage(img,sourceWidth,sourceHeight).data;
      if(gl){
        const limit=Math.min(1536,gl.getParameter(gl.MAX_TEXTURE_SIZE));
        const renderScale=Math.min(1,1280/img.width,960/img.height);
        canvas.width=Math.max(1,Math.round(img.width*renderScale*rect.width));canvas.height=Math.max(1,Math.round(img.height*renderScale*rect.height));
        // Imported portraits can exceed the drawing-buffer height limit.
        if(canvas.height>limit){canvas.width=Math.max(1,Math.round(canvas.width*limit/canvas.height));canvas.height=limit;}
        gl.viewport(0,0,canvas.width,canvas.height);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[0]);
        gl.uniform4f(gl.getUniformLocation(program,'bounds'),rect.x,rect.y,rect.width,rect.height);
        let texture=img;
        if(img.width>limit||img.height>limit){const s=Math.min(limit/img.width,limit/img.height);texture=offscreen(Math.round(img.width*s),Math.round(img.height*s));texture.getContext('2d').drawImage(img,0,0,texture.width,texture.height);}
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[1]);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,field.w,field.h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,textures[2]);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,field.w,field.h,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,field.mask);
      }
    },
    draw(changed){
      if(disposed)return null;
      if(!changed&&cached)return cached;
      uploads++;
      if(gl){
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[1]);
        gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,field.w,field.h,gl.RGBA,gl.UNSIGNED_BYTE,field.encode());
        gl.drawArrays(gl.TRIANGLES,0,6);return cached=canvas;
      }
      const {width:w,height:h}=fallback;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const fx=(rect.x+(x+.5)/w*rect.width)*field.w-.5,fy=(rect.y+(y+.5)/h*rect.height)*field.h-.5;
        const k=(y*w+x)*4,alpha=bilinear(field.mask,field.w,field.h,fx,fy,0,1);pixels.data[k+3]=alpha;
        if(alpha<1)continue;
        const u=bilinear(field.uv,field.w,field.h,fx,fy,0,2),v=bilinear(field.uv,field.w,field.h,fx,fy,1,2);
        for(let c=0;c<3;c++)pixels.data[k+c]=bilinear(source,sourceWidth,sourceHeight,u*sourceWidth-.5,v*sourceHeight-.5,c);
      }
      ctx.putImageData(pixels,0,0);return cached=fallback;
    },
    get mode(){return gl?'texture-flow':'canvas-flow';},
    freeze(){
      if(cached!==canvas)return;
      frozen.width=canvas.width;frozen.height=canvas.height;
      frozen.getContext('2d').drawImage(canvas,0,0);cached=frozen;
    },
    get uploads(){return uploads;},
    get rect(){return rect;},
    get size(){return gl?[canvas.width,canvas.height]:[fallback.width,fallback.height];},
    dispose(){disposed=true;canvas.removeEventListener('webglcontextlost',lost);disposeGL();source=null;cached=null;},
  };
}

export async function create(stage,controls) {
  const chapters=JSON.parse(document.querySelector('#fluid-chapters').textContent);
  const art=await Promise.all(chapters.map(c=>image(asset(c.image))));
  const fluid=new Fluid(72,48,12),field=new PigmentField(120,80),renderer=pigmentRenderer(field);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),theater=document.querySelector('.theater');
  const before=offscreen(1,1),wash=offscreen(1,1),mask=offscreen(1,1),bctx=before.getContext('2d'),wctx=wash.getContext('2d'),mctx=mask.getContext('2d');
  const transitionSeconds=2.2,holdSeconds=18;
  let chapterIndex=0,original=art[0],sourceKind='art',sourceName='',damping=chapters[0].damping;
  let steps=0,acc=0,last=null,disturbed=false,generation=0,disposed=false,transition=1,tour=false,chapterTime=0,lastTick=0;
  let active=false,flowDirty=false,quietTime=0,pending=null,nextFrame=0,simulationTime=stage.t,pointerInside=false;
  let weight=()=>0,overlayBoxes=[];
  let statusKey='';
  const fixedStep=1/60,idleHz=12;

  const edition=document.createElement('div');edition.className='fluid-edition';
  edition.innerHTML='<span>洇 <b>INKFIELD</b></span><small>材料手记 · 第一期 / 颜色的来处</small>';
  const folio=document.createElement('article');folio.className='fluid-folio';
  folio.innerHTML='<div class="fluid-folio-top"><span>MATERIAL NOTES</span><b></b></div><h2></h2><p></p><div class="fluid-swatches" aria-label="本章色卡"></div><div class="fluid-tags"><span></span><span></span></div>';
  const note=document.createElement('aside');note.className='fluid-note';
  note.innerHTML='<span>FROM THE WORKTABLE</span><p></p><small></small>';
  const stamp=document.createElement('div');stamp.className='fluid-stamp';stamp.setAttribute('aria-hidden','true');
  stamp.innerHTML='<span>CHAPTER</span><b></b><small></small>';
  const announcement=document.createElement('p');announcement.className='fluid-announcement';announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');
  theater.append(edition,folio,note,stamp,announcement);
  document.querySelector('.instrument-title strong').textContent='试色台';

  const decay=range(controls,'动量衰减',.1,2,damping,.05,v=>{damping=v;stage.dirty=true;});
  button(controls,'轻推颜料',()=>nudge());
  const tourButton=button(controls,'连读四章',()=>{tour=!tour;chapterTime=0;if(tour)stage.setPlaying(true);stage.dirty=true;});
  tourButton.setAttribute('aria-pressed','false');
  fileInput(controls,'用自己的图试色','image/png,image/jpeg,image/webp',16,async file=>{
    const ticket=++generation,url=URL.createObjectURL(file);
    try{const img=await image(url);if(ticket!==generation||disposed)return;original=img;sourceKind='local';sourceName=file.name;tour=false;transition=1;clearFlow();setRegion();renderer.setImage(img);stage.dirty=true;}
    finally{URL.revokeObjectURL(url);}
  });
  function clearFlow(){stage.artworkView=null;field.reset();for(const k of ['u','v','u0','v0','p','p0','div'])fluid[k].fill(0);steps=0;acc=0;last=null;disturbed=false;active=false;flowDirty=false;quietTime=0;pending=null;pointerInside=false;fluid.speed=0;simulationTime=stage.t;nextFrame=0;}
  function setRegion(){
    const {w,h}=field,id=sourceKind==='local'?'local':chapters[chapterIndex].id;
    // Rasterize the full source, without cover-cropping imported aspect ratios.
    const sample=offscreen(w,h),context=sample.getContext('2d',{willReadFrequently:true});
    context.drawImage(original,0,0,w,h);
    weight=pigmentRegion(id,context.getImageData(0,0,w,h).data,w,h);
    field.setMask(weight);fluid.setMask(weight);
  }
  function wake(){active=true;disturbed=true;quietTime=0;nextFrame=0;simulationTime=stage.t;}
  function transport(){
    fluid.step(fixedStep,damping);field.step(fluid,fixedStep);steps++;flowDirty=true;
    quietTime=fluid.speed<.00035?quietTime+fixedStep:0;
    if(quietTime>=.35){active=false;acc=0;fluid.u.fill(0);fluid.v.fill(0);}
  }
  function nudge(){
    let changed=false;chapters[chapterIndex].flow.forEach(s=>{changed=fluid.splat(...s)||changed;});
    if(!changed)return;tour=false;wake();
    if(!stage.playing)for(let i=0;i<8;i++)transport();stage.dirty=true;
  }
  function writeCopy(){
    const c=chapters[chapterIndex];document.body.style.setProperty('--accent',c.accent);
    document.querySelectorAll('h1 span').forEach((el,i)=>el.textContent=c.headline[i]);
    document.querySelector('.hero-copy > p').textContent=c.body;
    const eyebrow=document.querySelector('.eyebrow');eyebrow.replaceChildren();
    eyebrow.append(document.createTextNode(c.english));const rule=document.createElement('i'),count=document.createElement('span');count.textContent=String(chapterIndex+1).padStart(2,'0')+' / 04';eyebrow.append(rule,count);
    document.querySelector('.stage-tag b').textContent=c.kicker;
    document.querySelector('#interact > span').textContent=c.action;
    document.querySelector('.study-coordinate > span').textContent='INKFIELD / 材料手记';
    document.querySelector('.study-coordinate > b').textContent=c.state;
    folio.querySelector('.fluid-folio-top b').textContent=c.material;
    folio.querySelector('h2').textContent=c.feature;folio.querySelector('p').textContent=c.detail;
    const swatches=folio.querySelector('.fluid-swatches');swatches.replaceChildren();
    c.swatches.forEach((colour,i)=>{const sample=document.createElement('div'),chip=document.createElement('i'),label=document.createElement('span');chip.style.background=colour;label.textContent=c.swatchNames[i];sample.append(chip,label);swatches.append(sample);});
    folio.querySelectorAll('.fluid-tags span').forEach((el,i)=>el.textContent=c.tags[i]);
    note.querySelector('p').textContent=c.note;note.querySelector('small').textContent=c.annotation;
    stamp.querySelector('b').textContent=String(chapterIndex+1).padStart(2,'0');stamp.querySelector('small').textContent=c.title;
    announcement.textContent=`第 ${chapterIndex+1} 章，${c.title}。${c.headline.join('')}`;
    stage.canvas.setAttribute('aria-label',`${c.title}。${c.annotation} 左右方向键翻页。`);
  }
  function choose(index,{animate=true,continueTour=false}={}){
    generation++;
    if(animate&&stage.playing&&!reduced.matches&&stage.frame>0){before.width=stage.canvas.width;before.height=stage.canvas.height;bctx.drawImage(stage.canvas,0,0);transition=0;}else transition=1;
    chapterIndex=(index+chapters.length)%chapters.length;original=art[chapterIndex];sourceKind='art';sourceName='';tour=continueTour;chapterTime=0;lastTick=performance.now();
    damping=chapters[chapterIndex].damping;decay.value=damping;clearFlow();setRegion();renderer.setImage(original);writeCopy();
    theater.style.setProperty('--chapter-enter',String(transition));measureOverlays();stage.dirty=true;
  }
  function fit(){
    const zoom=reduced.matches?1:1.018+Math.sin(stage.t*.16)*.005;
    const f=coverFit(original.width,original.height,stage.width*zoom,stage.height*zoom);
    f.x-=(stage.width*zoom-stage.width)/2;f.y-=(stage.height*zoom-stage.height)/2;return f;
  }
  const overlaySelectors='.hero-copy,.fluid-edition,.fluid-folio,.fluid-note,.fluid-stamp,.telemetry,.stage-tag,.study-coordinate';
  function measureOverlays(){overlayBoxes=[...theater.querySelectorAll(overlaySelectors)].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect());}
  const layoutObserver=new ResizeObserver(measureOverlays);
  layoutObserver.observe(theater);
  const cleanObserver=new MutationObserver(()=>{measureOverlays();last=null;pointerInside=false;stage.dirty=true;});
  cleanObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  function hit(client,rect){
    const view=stage.artworkView;
    if(!client||transition<1||!view||view.width!==stage.canvas.width||view.height!==stage.canvas.height)return null;
    return hitRegion(client,rect,view.fit,weight,overlayBoxes,view);
  }
  function drawTransition(dt){
    transition=(!stage.playing||reduced.matches)?1:Math.min(1,transition+dt/transitionSeconds);
    const p=transition,blend=p*p*(3-2*p),w=stage.width,h=stage.height;
    if(p<1){
      if(wash.width!==stage.canvas.width||wash.height!==stage.canvas.height){wash.width=mask.width=stage.canvas.width;wash.height=mask.height=stage.canvas.height;}
      wctx.setTransform(stage.dpr,0,0,stage.dpr,0,0);wctx.clearRect(0,0,w,h);wctx.globalCompositeOperation='source-over';
      mctx.setTransform(stage.dpr,0,0,stage.dpr,0,0);mctx.clearRect(0,0,w,h);
      const bands=128,pulse=Math.sin(Math.PI*p);
      wctx.drawImage(before,-pulse*w*.008,-pulse*h*.006,w*(1+pulse*.016),h*(1+pulse*.012));
      for(let i=0;i<bands;i++){
        const edge=w*((1-blend)*1.4-.2)+Math.sin(i/bands*9.12-p*4)*w*.07*pulse,feather=w*.09;
        const g=mctx.createLinearGradient(edge-feather,0,edge+feather,0);g.addColorStop(0,`rgba(0,0,0,${1-p**4})`);g.addColorStop(1,'transparent');
        const y=Math.floor(i*mask.height/bands)/stage.dpr,nextY=Math.floor((i+1)*mask.height/bands)/stage.dpr;
        mctx.fillStyle=g;mctx.fillRect(0,y,w,nextY-y);
      }
      wctx.globalCompositeOperation='destination-in';wctx.filter='blur(2px)';wctx.drawImage(mask,0,0,w,h);wctx.filter='none';
      wctx.globalCompositeOperation='source-over';stage.ctx.drawImage(wash,0,0,w,h);
    }
    const copy=clamp((p-.08)/.92);theater.style.setProperty('--chapter-enter',String(copy*copy*(3-2*copy)));
  }
  choose(0,{animate:false});
  const scenes={label:'THE MATERIAL JOURNAL',kind:'CHAPTER',items:chapters.map((c,i)=>({...c,active:()=>chapterIndex===i,apply:()=>choose(i)}))};
  return {
    // Stage still owns requestAnimationFrame and visibility. Skip expensive
    // composition while reading; interaction/turning pages returns to 60 Hz.
    get static(){return stage.t<nextFrame;},
    resize(){
      stage.artworkView=null;last=null;pending=null;pointerInside=false;
      stage.dpr=Math.min(devicePixelRatio||1,1.25);
      stage.canvas.width=Math.round(stage.width*stage.dpr);stage.canvas.height=Math.round(stage.height*stage.dpr);
      stage.ctx.setTransform(stage.dpr,0,0,stage.dpr,0,0);measureOverlays();
    },
    scenes,reset:()=>choose(chapterIndex,{animate:false}),interact:()=>choose(chapterIndex+1),
    key(key){if(key==='ArrowRight')choose(chapterIndex+1);if(key==='ArrowLeft')choose(chapterIndex-1);},
    pointer(p,e){
      if(!p.down){last=null;pointerInside=false;return;}
      // Use Stage's raw viewport sample and the last painted transform, never
      // reconstruct an event from its clamped normalized pointer coordinates.
      const client=p.client,rect=stage.canvas.getBoundingClientRect();
      if(e?.type==='pointerdown')last=null;
      measureOverlays();const q=hit(client,rect);pointerInside=!!q;
      if(!q){last=null;return;}
      // Scroll/layout motion must not become brush velocity. Map both event
      // positions through this same painted view, including the idle zoom.
      const previous=last&&['left','top','width','height'].every(k=>rect[k]===last.rect[k])?hit(last.client,rect):null;
      if(previous&&pigmentStroke(weight,previous,q,field.w,field.h)){
        const dx=q.x-previous.x,dy=q.y-previous.y;
        if(Math.abs(dx)+Math.abs(dy)>1e-5)
          pending={...q,dx:clamp((pending?.dx||0)+dx,-.08,.08),dy:clamp((pending?.dy||0)+dy,-.08,.08)};
      }last={client:{...client},rect};
    },
    release(){last=null;pointerInside=false;stage.dirty=true;},
    visibility(on){lastTick=on?performance.now():0;simulationTime=stage.t;acc=0;last=null;pending=null;pointerInside=false;},
    render(dt){
      // Reading/transition time follows visible playback, independently of the
      // solver's capped fixed steps, so a busy renderer cannot stretch a chapter.
      const now=performance.now();let visualDt=stage.playing&&lastTick?Math.max(0,(now-lastTick)/1000):0;lastTick=now;
      if(tour&&visualDt){chapterTime+=visualDt;if(chapterTime>=holdSeconds){choose(chapterIndex+1,{continueTour:true});visualDt=0;}}
      const simulationDt=Math.min(.05,Math.max(0,stage.t-simulationTime));simulationTime=stage.t;
      if(pending){
        const changed=fluid.splat(pending.x,pending.y,pending.dx,pending.dy,.095);pending=null;
        if(changed){tour=false;if(!active)wake();disturbed=true;quietTime=0;if(!stage.playing)transport();}
      }
      if(active&&stage.playing){acc+=simulationDt;let n=0;while(active&&acc>=fixedStep&&n<3){acc-=fixedStep;transport();n++;}if(n===3)acc=0;}
      const {ctx,width:w,height:h}=stage,f=fit();ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.drawImage(original,f.x,f.y,f.width,f.height);stage.captureArtwork(f);
      if(disturbed){const layer=renderer.draw(flowDirty),r=renderer.rect;if(layer)ctx.drawImage(layer,f.x+r.x*f.width,f.y+r.y*f.height,r.width*f.width,r.height*f.height);flowDirty=false;if(!active)renderer.freeze();}
      if(transition<1){drawTransition(visualDt);if(transition===1)measureOverlays();}
      nextFrame=stage.t+((active||transition<1)?0:1/idleHz);
      if(stage.pointer.down&&pointerInside){ctx.strokeStyle=chapters[chapterIndex].accent+'90';ctx.lineWidth=1;ctx.beginPath();ctx.arc(stage.pointer.x*w,stage.pointer.y*h,19,0,Math.PI*2);ctx.stroke();}
      const c=chapters[chapterIndex];
      const key=[chapterIndex,sourceKind,sourceName,tour,disturbed].join('|');
      if(key!==statusKey){
        statusKey=key;tourButton.setAttribute('aria-pressed',String(tour));
        stage.status(sourceKind==='local'?`我的试色 · ${sourceName}`:`${c.material} · ${tour?'连读中':disturbed?'试色中':'材料手记'}`);
        document.querySelector('.hint').textContent=sourceKind==='local'?'正在用自己的图片试色。重置或选择章节，可回到材料手记。':c.annotation+' 重置可恢复本章原画。';
        document.querySelector('.telemetry-bottom span').textContent='INKFIELD / ISSUE 01';
      }
    },
    inspect:()=>({interactionRevision:'painted-artwork-r3',artworkView:stage.artworkView,chapter:chapters[chapterIndex].id,chapterIndex,art:chapters[chapterIndex].image,source:sourceKind,texturesLoaded:art.length,
      transition,transitionSeconds,holdSeconds,tour,chapterTime,steps,damping,disturbed,renderer:renderer.mode,grid:[fluid.w,fluid.h],flowSize:[field.w,field.h],
      active,speed:fluid.speed,uploads:renderer.uploads,renderSize:renderer.size,activeCells:field.cells.length,projectionIterations:fluid.iterations,idleHz,pointerInside,
      divergence:fluid.divergenceEnergy(),finite:fluid.u.every(Number.isFinite)&&fluid.v.every(Number.isFinite)&&field.uv.every(Number.isFinite)}),
    dispose(){disposed=true;generation++;layoutObserver.disconnect();cleanObserver.disconnect();renderer.dispose();},
  };
}
