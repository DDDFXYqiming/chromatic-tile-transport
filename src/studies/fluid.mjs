import {clamp} from './math.mjs';
import {asset,image,sampleImage,offscreen,range,button,fileInput,bilinear,coverFit} from './core.mjs';
/** Semi-Lagrangian velocity transport + pressure projection, in grid-cell units. */
export class Fluid {
  constructor(w=96,h=60) {
    this.w=w;this.h=h;this.stride=w+2;this.size=(w+2)*(h+2);
    for(const k of ['u','v','u0','v0','p','p0','div'])this[k]=new Float32Array(this.size);
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
    const {w,h,stride:s,u,v,div}=this;this.p.fill(0);this.p0.fill(0);
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x;div[i]=-.5*(u[i+1]-u[i-1]+v[i+s]-v[i-s]);}
    this.boundary(div);
    for(let k=0;k<iterations;k++){
      const p=this.p,q=this.p0;
      for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x;q[i]=(div[i]+p[i-1]+p[i+1]+p[i-s]+p[i+s])*.25;}
      this.boundary(q);this.p=q;this.p0=p;
    }
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x;u[i]-=.5*(this.p[i+1]-this.p[i-1]);v[i]-=.5*(this.p[i+s]-this.p[i-s]);}
    this.boundary(u,1);this.boundary(v,2);
  }
  step(dt,damping=.6) {
    this.u0.set(this.u);this.v0.set(this.v);const {w,h,stride:s}=this;
    const decay=Math.exp(-damping*dt);
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x,px=x-dt*this.u0[i],py=y-dt*this.v0[i];this.u[i]=this.sample(this.u0,px,py)*decay;this.v[i]=this.sample(this.v0,px,py)*decay;}
    this.boundary(this.u,1);this.boundary(this.v,2);this.project();
  }
  splat(x,y,dx,dy,radius=.14) {
    for(let j=1;j<=this.h;j++)for(let i=1;i<=this.w;i++) {
      const r2=((i/this.w-x)**2+(j/this.h-y)**2)/(radius*radius),f=Math.exp(-r2*3);
      if(f<.001)continue;const k=j*this.stride+i;
      this.u[k]=clamp(this.u[k]+dx*this.w*f*12,-170,170);this.v[k]=clamp(this.v[k]+dy*this.h*f*12,-170,170);
    }
  }
  divergenceEnergy(){let v=0;const s=this.stride;for(let y=2;y<this.h;y++)for(let x=2;x<this.w;x++){const i=y*s+x;v+=(this.u[i+1]-this.u[i-1]+this.v[i+s]-this.v[i-s])**2;}return v;}
}
/** Advect source coordinates, retaining the original artwork's texture resolution. */
export class PigmentField {
  constructor(w=144,h=96){this.w=w;this.h=h;this.uv=new Float32Array(w*h*2);this.next=new Float32Array(this.uv.length);this.bytes=new Uint8Array(w*h*4);this.reset();}
  reset(){for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){const k=(y*this.w+x)*2;this.uv[k]=(x+.5)/this.w;this.uv[k+1]=(y+.5)/this.h;}}
  step(fluid,dt){
    const {w,h,uv,next}=this;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const gx=(x+.5)/w*fluid.w+.5,gy=(y+.5)/h*fluid.h+.5;
      const sx=x-fluid.sample(fluid.u,gx,gy)*dt*w/fluid.w,sy=y-fluid.sample(fluid.v,gx,gy)*dt*h/fluid.h,k=(y*w+x)*2;
      next[k]=bilinear(uv,w,h,sx,sy,0,2);next[k+1]=bilinear(uv,w,h,sx,sy,1,2);
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
  const canvas=offscreen(1,1),fallback=offscreen(432,288),ctx=fallback.getContext('2d');
  let pixels=new ImageData(432,288),gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true}),program,buffer,textures=[],original,source,disposed=false;
  function disposeGL(){if(!gl)return;textures.forEach(t=>gl.deleteTexture(t));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);gl=null;}
  try{
    if(gl){
      const shader=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(error);}return s;};
      const vs=shader(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 uv; void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}');
      const fs=shader(gl.FRAGMENT_SHADER,'precision highp float; varying vec2 uv; uniform sampler2D artwork; uniform sampler2D flow; void main(){vec4 p=texture2D(flow,uv);vec2 q=vec2(dot(p.rg,vec2(65280.,255.)),dot(p.ba,vec2(65280.,255.)))/65535.;gl_FragColor=texture2D(artwork,q);}');
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      for(let unit=0;unit<2;unit++){
        const texture=gl.createTexture();textures.push(texture);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
        for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
        for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
      }
      gl.uniform1i(gl.getUniformLocation(program,'artwork'),0);gl.uniform1i(gl.getUniformLocation(program,'flow'),1);
    }
  }catch{disposeGL();}
  const lost=e=>{e.preventDefault();gl=null;};canvas.addEventListener('webglcontextlost',lost);
  return {
    setImage(img){
      original=img;
      const scale=Math.min(432/img.width,288/img.height);
      fallback.width=Math.max(1,Math.round(img.width*scale));fallback.height=Math.max(1,Math.round(img.height*scale));
      pixels=new ImageData(fallback.width,fallback.height);source=sampleImage(img,fallback.width,fallback.height).data;
      if(gl){
        const limit=Math.min(1536,gl.getParameter(gl.MAX_TEXTURE_SIZE));
        canvas.width=Math.min(limit,img.width);canvas.height=Math.max(1,Math.round(canvas.width*img.height/img.width));
        // Imported portraits can exceed the drawing-buffer height limit.
        if(canvas.height>limit){canvas.width=Math.max(1,Math.round(canvas.width*limit/canvas.height));canvas.height=limit;}
        gl.viewport(0,0,canvas.width,canvas.height);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[0]);
        let texture=img;
        if(img.width>limit||img.height>limit){texture=offscreen(canvas.width,canvas.height);texture.getContext('2d').drawImage(img,0,0,texture.width,texture.height);}
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);
      }
    },
    draw(changed){
      if(disposed||!changed)return original;
      if(gl){
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[1]);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,field.w,field.h,0,gl.RGBA,gl.UNSIGNED_BYTE,field.encode());
        gl.drawArrays(gl.TRIANGLES,0,6);return canvas;
      }
      const {width:w,height:h}=fallback;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const fx=(x+.5)/w*field.w-.5,fy=(y+.5)/h*field.h-.5;
        const u=bilinear(field.uv,field.w,field.h,fx,fy,0,2),v=bilinear(field.uv,field.w,field.h,fx,fy,1,2),k=(y*w+x)*4;
        for(let c=0;c<3;c++)pixels.data[k+c]=bilinear(source,w,h,u*w-.5,v*h-.5,c);
        pixels.data[k+3]=255;
      }
      ctx.putImageData(pixels,0,0);return fallback;
    },
    get mode(){return gl?'texture-flow':'canvas-flow';},
    dispose(){disposed=true;canvas.removeEventListener('webglcontextlost',lost);disposeGL();source=null;original=null;},
  };
}

export async function create(stage,controls) {
  const chapters=JSON.parse(document.querySelector('#fluid-chapters').textContent);
  const art=await Promise.all(chapters.map(c=>image(asset(c.image))));
  const fluid=new Fluid(96,64),field=new PigmentField(),renderer=pigmentRenderer(field);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),theater=document.querySelector('.theater');
  const before=offscreen(1,1),wash=offscreen(1,1),mask=offscreen(1,1),bctx=before.getContext('2d'),wctx=wash.getContext('2d'),mctx=mask.getContext('2d');
  const transitionSeconds=2.2,holdSeconds=18;
  let chapterIndex=0,original=art[0],sourceKind='art',sourceName='',damping=chapters[0].damping;
  let steps=0,acc=0,last=null,disturbed=false,generation=0,disposed=false,transition=1,tour=false,chapterTime=0,lastTick=0;

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
    try{const img=await image(url);if(ticket!==generation||disposed)return;original=img;sourceKind='local';sourceName=file.name;tour=false;transition=1;clearFlow();renderer.setImage(img);stage.dirty=true;}
    finally{URL.revokeObjectURL(url);}
  });
  function clearFlow(){field.reset();for(const k of ['u','v','u0','v0','p','p0','div'])fluid[k].fill(0);steps=0;acc=0;last=null;disturbed=false;}
  function transport(){fluid.step(1/60,damping);field.step(fluid,1/60);steps++;}
  function nudge(){
    tour=false;disturbed=true;chapters[chapterIndex].flow.forEach(s=>fluid.splat(...s));
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
    damping=chapters[chapterIndex].damping;decay.value=damping;clearFlow();renderer.setImage(original);writeCopy();
    theater.style.setProperty('--chapter-enter',String(transition));stage.dirty=true;
  }
  function fit(){
    const zoom=reduced.matches?1:1.018+Math.sin(stage.t*.16)*.005;
    const f=coverFit(original.width,original.height,stage.width*zoom,stage.height*zoom);
    f.x-=(stage.width*zoom-stage.width)/2;f.y-=(stage.height*zoom-stage.height)/2;return f;
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
    scenes,reset:()=>choose(chapterIndex,{animate:false}),interact:()=>choose(chapterIndex+1),
    key(key){if(key==='ArrowRight')choose(chapterIndex+1);if(key==='ArrowLeft')choose(chapterIndex-1);},
    pointer(p){
      if(!p.down){last=null;return;}const f=fit(),q={x:clamp((p.x*stage.width-f.x)/f.width),y:clamp((p.y*stage.height-f.y)/f.height)};
      if(last){tour=false;disturbed=true;fluid.splat(q.x,q.y,q.x-last.x,q.y-last.y);if(!stage.playing)transport();}last=q;
    },
    release(){last=null;},
    visibility(on){lastTick=on?performance.now():0;},
    render(dt){
      // Reading/transition time follows visible playback, independently of the
      // solver's capped fixed steps, so a busy renderer cannot stretch a chapter.
      const now=performance.now();let visualDt=stage.playing&&lastTick?Math.max(0,(now-lastTick)/1000):0;lastTick=now;
      if(tour&&visualDt){chapterTime+=visualDt;if(chapterTime>=holdSeconds){choose(chapterIndex+1,{continueTour:true});visualDt=0;}}
      if(disturbed){acc+=dt;let n=0;while(acc>=1/60&&n<3){transport();acc-=1/60;n++;}if(n===3)acc=0;}
      const {ctx,width:w,height:h}=stage,f=fit();ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.drawImage(renderer.draw(disturbed),f.x,f.y,f.width,f.height);drawTransition(visualDt);
      if(stage.pointer.down){ctx.strokeStyle=chapters[chapterIndex].accent+'90';ctx.lineWidth=1;ctx.beginPath();ctx.arc(stage.pointer.x*w,stage.pointer.y*h,19,0,Math.PI*2);ctx.stroke();}
      const c=chapters[chapterIndex];tourButton.setAttribute('aria-pressed',String(tour));
      stage.status(sourceKind==='local'?`我的试色 · ${sourceName}`:`${c.material} · ${tour?'连读中':disturbed?'试色中':'材料手记'}`);
      document.querySelector('.hint').textContent=sourceKind==='local'?'正在用自己的图片试色。重置或选择章节，可回到材料手记。':c.annotation+' 重置可恢复本章原画。';
      document.querySelector('.telemetry-bottom span').textContent='INKFIELD / ISSUE 01';
    },
    inspect:()=>({chapter:chapters[chapterIndex].id,chapterIndex,art:chapters[chapterIndex].image,source:sourceKind,texturesLoaded:art.length,
      transition,transitionSeconds,holdSeconds,tour,chapterTime,steps,damping,disturbed,renderer:renderer.mode,grid:[fluid.w,fluid.h],flowSize:[field.w,field.h],
      divergence:fluid.divergenceEnergy(),finite:fluid.u.every(Number.isFinite)&&fluid.v.every(Number.isFinite)&&field.uv.every(Number.isFinite)}),
    dispose(){disposed=true;generation++;renderer.dispose();},
  };
}
