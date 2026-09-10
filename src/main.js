/*
 * 跃迁影像档案 / Trailblaze Archive
 * A self-contained, dependency-free image-to-tile-to-image experiment.
 * Original renderer and UI; not source code extracted from andidea.jp.
 * No AI inference, remote service, telemetry, font download or build server at runtime.
 */
(() => {
  'use strict';
  const MEDIA = window.ARCHIVE_MEDIA;
  const $ = id => document.getElementById(id);
  if (!Array.isArray(MEDIA) || MEDIA.length < 2 || MEDIA.length > 24) {
    $('errorBox').hidden = false;
    $('errorBox').textContent = '影像清单缺失。请打开完整的 HTML 文件，或先运行项目中的 build.py。';
    return;
  }
  const N = MEDIA.length;
  const CONFIG = window.ARCHIVE_CONFIG || {};
  const Timing = TransportTiming.create(CONFIG.motion || {});
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const wrap = (v, n = N) => ((v % n) + n) % n;
  const smooth = t => t * t * (3 - 2 * t);
  const smoothBetween = (a, b, x) => smooth(clamp((x - a) / (b - a)));
  const lerp = (a, b, t) => a + (b - a) * t;
  const color = hex => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const options = { density: 152, duration: 5.8, holdTime: 3.2, reduced: motionQuery.matches,
    mapping: 'color', spatial: .022, holdColor: false, trails: true, ...(CONFIG.options || {}) };
  if (motionQuery.matches) options.reduced = true;
  const state = {
    ready: false, position: 0, manualTarget: 0, seeking: false,
    autoplay: CONFIG.autoplay !== false && !options.reduced, motion: null, hold: 0,
    width: 1, height: 1, dpr: 1, pointer: [.5, .5], pointerTarget: [.5, .5], pointerInside: 0,
    dominant: -1, sliderActive: false, sliderBase: 0,
    lastTime: 0, fps: 60, frames: 0, fpsTime: 0, dirty: true, pausedForVisibility: false
  };
  let renderer = null;
  let transport = null;
  let currentPlan = null;
  let images = [];
  let hintTimer = 0;
  let titleAnimation = null;
  let lastPhase = '';
  let lastUIPosition = Infinity;
  let lastDrawPosition = Infinity;
  let drawTime = 0;
  let contextLost = false;

  // Readable original GLSL. Images remain full textures, not single-color sprites.
  const QUAD_VERTEX = `#version 300 es
    precision highp float;
    layout(location=0) in vec2 aCorner;
    out vec2 vUV;
    void main(){
      vUV=aCorner+0.5;
      gl_Position=vec4(aCorner.x*2.0,-aCorner.y*2.0,0.0,1.0);
    }`;
  const COVER = `
    vec2 coverUV(vec2 uv, vec2 imageSize, vec2 focal, vec2 viewport){
      float ia=imageSize.x/imageSize.y;
      float va=viewport.x/viewport.y;
      vec2 scale=vec2(min(1.0,va/ia),min(1.0,ia/va));
      vec2 offset=clamp(focal-scale*0.5,vec2(0.0),vec2(1.0)-scale);
      return clamp(uv*scale+offset,vec2(0.0001),vec2(0.9999));
    }`;
  const BACKGROUND_FRAGMENT = `#version 300 es
    precision highp float;
    uniform sampler2D uA;
    uniform sampler2D uB;
    uniform vec2 uSizeA,uSizeB,uFocalA,uFocalB,uViewport;
    uniform float uProgress,uDim;
    in vec2 vUV;
    out vec4 outColor;
    ${COVER}
    void main(){
      vec3 a=texture(uA,coverUV(vUV,uSizeA,uFocalA,uViewport)).rgb;
      vec3 b=texture(uB,coverUV(vUV,uSizeB,uFocalB,uViewport)).rgb;
      float front=smoothstep(0.23+vUV.x*0.24,0.53+vUV.x*0.22,uProgress);
      vec3 c=mix(a,b,front);
      outColor=vec4(mix(vec3(0.025,0.034,0.060),c,uDim),1.0);
    }`;
  const TILE_VERTEX = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec2 aTarget;
layout(location=2) in vec4 aControls;
layout(location=3) in vec4 aMotion;
uniform sampler2D uA,uB;
uniform vec2 uSizeA,uSizeB,uFocalA,uFocalB,uViewport,uGrid,uPointer;
uniform float uProgress,uGhost,uPointerInside;
out vec2 vLocal;
flat out vec2 vHomeA,vHomeB;
flat out vec3 vSampleA,vSampleB;
flat out float vMix,vMosaic,vFlight,vRandom,vOpacity;
${COVER}
vec2 bezier(vec2 a,vec2 c1,vec2 c2,vec2 b,float t){float s=1.0-t;return s*s*s*a+3.0*s*s*t*c1+3.0*s*t*t*c2+t*t*t*b;}
${Timing.glsl}
void main(){
  float id=float(gl_InstanceID);
  vec2 cell=vec2(mod(id,uGrid.x),floor(id/uGrid.x));
  vec2 homeA=(cell+0.5)/uGrid,homeB=aTarget;
  vec3 sampleA=texture(uA,coverUV(homeA,uSizeA,uFocalA,uViewport)).rgb;
  vec3 sampleB=texture(uB,coverUV(homeB,uSizeB,uFocalB,uViewport)).rgb;
  float p=uProgress;
  vec2 schedule=transportSchedule(aMotion.x,aMotion.y);
  float t0=clamp((p-schedule.x)/(schedule.y-schedule.x),0.0,1.0);
  // Each tile splits and closes its own gaps while it is already travelling.
  float mosaic=transportMosaic(t0);
  float t=transportTravel(t0-uGhost*0.018);
  float flight=sin(t*3.14159265359);
  float lum=dot(sampleA,vec3(0.2126,0.7152,0.0722));
  float blend=smoothstep(.52,.96,t);
  vec2 pos=bezier(homeA,aControls.xy,aControls.zw,homeB,t);
  float aspect=uViewport.x/uViewport.y;
  vec2 d=(homeB-homeA)*vec2(aspect,1.0);
  float lengthD=length(d);
  vec2 normal=lengthD>0.00001?vec2(-d.y,d.x)/lengthD:vec2(0.0);
  // The bend sign/magnitude comes from the colours carried by this actual match.
  float pigment=(sampleA.r-sampleA.b+sampleB.r-sampleB.b)*0.5;
  float arc=clamp(lengthD*.055,0.0,.035)*pigment;
  pos+=normal/vec2(aspect,1.0)*arc*flight*flight;
  // Small pointer displacement, never changing the true endpoints or assignment.
  vec2 pd=(pos-uPointer)*vec2(aspect,1.0);
  float hover=exp(-dot(pd,pd)*40.0)*uPointerInside;
  pos+=pd/vec2(aspect,1.0)*hover*flight*.035;
  float midLum=dot(mix(sampleA,sampleB,blend),vec3(.2126,.7152,.0722));
  float size=mix(1.0,.70+.21*sqrt(max(0.0,midLum)),mosaic);
  size*=1.0+flight*(lum-.4)*.25;
  float roll=flight*clamp((homeB.x-homeA.x)*1.2,-.5,.5);
  // Shallow banking, not a full flip that would make the tile disappear.
  vec2 corner=aCorner/uGrid*vec2(size*(1.0-flight*.16),size);
  mat2 rot=mat2(cos(roll),sin(roll),-sin(roll),cos(roll));
  corner=(rot*(corner*vec2(aspect,1.0)))/vec2(aspect,1.0);
  pos+=corner;
  gl_Position=vec4(pos.x*2.0-1.0,1.0-pos.y*2.0,0.0,1.0);
  vLocal=aCorner+0.5;vHomeA=homeA;vHomeB=homeB;vSampleA=sampleA;vSampleB=sampleB;
  vMix=blend;vMosaic=mosaic;vFlight=flight;
  vRandom=aMotion.z;
  vOpacity=uGhost>0.5?(.15/uGhost)*flight*flight*smoothstep(.09,.5,lum)*smoothstep(.015,.18,aMotion.w):1.0;
}`;
  const TILE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uA,uB;
uniform vec2 uSizeA,uSizeB,uFocalA,uFocalB,uViewport,uGrid;
uniform vec3 uAccent;
uniform float uHoldColor,uProgress,uGhost;
in vec2 vLocal;
flat in vec2 vHomeA,vHomeB;
flat in vec3 vSampleA,vSampleB;
flat in float vMix,vMosaic,vFlight,vRandom,vOpacity;
out vec4 outColor;
${COVER}
vec3 linearize(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 encode(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),c));}
void main(){
  vec2 delta=(vLocal-.5)/uGrid;
  vec3 detailA=texture(uA,coverUV(vHomeA+delta,uSizeA,uFocalA,uViewport)).rgb;
  vec3 detailB=texture(uB,coverUV(vHomeB+delta,uSizeB,uFocalB,uViewport)).rgb;
  float blend=mix(vMix,smoothstep(.86,.998,uProgress),uHoldColor);
  vec3 detail=encode(mix(linearize(detailA),linearize(detailB),blend));
  vec3 center=encode(mix(linearize(vSampleA),linearize(vSampleB),blend));
  vec3 c=mix(detail,center,vMosaic*.48);
  float top=(1.0-smoothstep(.0,.13,vLocal.y))*.09;
  float bottom=smoothstep(.85,1.0,vLocal.y)*.10;
  c=c*(1.0-bottom*vMosaic)+top*vMosaic*(center*.65+.06);
  c+=center*vFlight*.06;
  float radius=.12*vMosaic;
  vec2 q=abs(vLocal-.5)-vec2(.5-radius);
  float sdf=length(max(q,0.0))+min(max(q.x,q.y),0.0)-radius;
  float alpha=mix(1.0,1.0-smoothstep(-.014,.014,sdf),vMosaic)*vOpacity;
  if(alpha<.004)discard;
  outColor=vec4(clamp(c,0.0,1.0),alpha);
}`;

  class GLRenderer {
    constructor(canvas, loadedImages) {
      this.canvas = canvas;
      this.kind = 'WEBGL 2';
      this.gl = canvas.getContext('webgl2', {
        alpha: false, antialias: false, depth: false, stencil: false,
        powerPreference: 'high-performance', preserveDrawingBuffer: false
      });
      if (!this.gl) throw new Error('WebGL 2 is unavailable');
      const gl = this.gl;
      this.bg = this.program(QUAD_VERTEX, BACKGROUND_FRAGMENT);
      this.tiles = this.program(TILE_VERTEX, TILE_FRAGMENT);
      this.locations = new Map();
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -.5,-.5, .5,-.5, -.5,.5, -.5,.5, .5,-.5, .5,.5
      ]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      this.textures = loadedImages.map(img => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        return texture;
      });
      gl.clearColor(.025,.034,.060,1);
      gl.disable(gl.DEPTH_TEST);
      this.cols=152;this.rows=88;
      this.lastPair='';
      this.planBuffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,this.planBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,40,gl.DYNAMIC_DRAW);
      [[1,2,0],[2,4,8],[3,4,24]].forEach(([loc,size,offset])=>{
        gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);gl.vertexAttribDivisor(loc,1);
      });
      this.loadedPlan=null;
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        contextLost=true;
        $('loadStatus').classList.remove('done');
        $('loadText').textContent='图形上下文已丢失，正在等待浏览器恢复…';
      });
      canvas.addEventListener('webglcontextrestored', () => {
        try {
          renderer=new GLRenderer(canvas,images);
          contextLost=false;
          resize();
          state.dirty=true;
          $('loadStatus').classList.add('done');
        } catch (error) { showError(error); }
      }, { once: true });
    }
    shader(type, source) {
      const gl=this.gl, shader=gl.createShader(type);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);
        throw new Error('Shader compile error: '+message);
      }
      return shader;
    }
    program(vertexSource,fragmentSource) {
      const gl=this.gl;
      const vs=this.shader(gl.VERTEX_SHADER,vertexSource), fs=this.shader(gl.FRAGMENT_SHADER,fragmentSource);
      const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Shader link error: '+gl.getProgramInfoLog(program));
      return program;
    }
    loc(program,name) {
      let table=this.locations.get(program);
      if(!table){table=new Map();this.locations.set(program,table);}
      if(!table.has(name)) table.set(name,this.gl.getUniformLocation(program,name));
      return table.get(name);
    }
    f(program,name,value){this.gl.uniform1f(this.loc(program,name),value);}
    v2(program,name,x,y){this.gl.uniform2f(this.loc(program,name),x,y);}
    resize(width,height,dpr){
      this.width=width;this.height=height;this.dpr=dpr;
      this.canvas.width=Math.max(1,Math.round(width*dpr));this.canvas.height=Math.max(1,Math.round(height*dpr));
      this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
      this.cols=Math.max(32,Math.min(options.density,Math.floor(width/4.5/8)*8));
      this.rows=Math.max(16,Math.ceil(this.cols*height/width/8)*8);
      this.count=this.cols*this.rows;
      transport.configure(this.cols,this.rows,width,height,options.spatial);
      this.loadedPlan=null;
    }
    bindCommon(program,a,b,p){
      const gl=this.gl;
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[a]);gl.uniform1i(this.loc(program,'uA'),0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.textures[b]);gl.uniform1i(this.loc(program,'uB'),1);
      this.v2(program,'uViewport',this.width,this.height);
      this.v2(program,'uSizeA',MEDIA[a].width,MEDIA[a].height);this.v2(program,'uSizeB',MEDIA[b].width,MEDIA[b].height);
      this.v2(program,'uFocalA',...MEDIA[a].position);this.v2(program,'uFocalB',...MEDIA[b].position);
      this.f(program,'uProgress',p);
    }
    render(a,b,p,time){
      const gl=this.gl;
      gl.bindVertexArray(this.vao);gl.disable(gl.BLEND);
      const sharp=options.reduced||p<0.001||p>0.999;
      if(sharp){
        const which=p<.5?a:b;
        this.bindCommon(this.bg,which,which,0);this.f(this.bg,'uDim',1);
        gl.drawArrays(gl.TRIANGLES,0,6);return;
      }
      const plan=options.mapping==='color'?transport.get(a,b):transport.baseline(options.mapping,a,b);
      if(!plan){
        transport.request(a,b);mappingStatus();
        this.bindCommon(this.bg,a,a,0);this.f(this.bg,'uDim',1);gl.drawArrays(gl.TRIANGLES,0,6);return;
      }
      currentPlan=plan;
      if(this.loadedPlan!==plan){
        gl.bindBuffer(gl.ARRAY_BUFFER,this.planBuffer);gl.bufferData(gl.ARRAY_BUFFER,plan.attrs,gl.STATIC_DRAW);this.loadedPlan=plan;
      }
      this.bindCommon(this.bg,a,b,p);
      const amount=Timing.envelope(p);
      this.f(this.bg,'uDim',lerp(1,.045,amount));gl.drawArrays(gl.TRIANGLES,0,6);
      this.bindCommon(this.tiles,a,b,p);
      this.v2(this.tiles,'uGrid',this.cols,this.rows);this.v2(this.tiles,'uPointer',...state.pointer);
      this.f(this.tiles,'uPointerInside',state.pointerInside);this.f(this.tiles,'uHoldColor',options.holdColor?1:0);
      gl.uniform3fv(this.loc(this.tiles,'uAccent'),color(MEDIA[p<.5?a:b].accent));
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      if(options.trails){
        this.f(this.tiles,'uGhost',2);gl.drawArraysInstanced(gl.TRIANGLES,0,6,this.count);
        this.f(this.tiles,'uGhost',1);gl.drawArraysInstanced(gl.TRIANGLES,0,6,this.count);
      }
      this.f(this.tiles,'uGhost',0);gl.drawArraysInstanced(gl.TRIANGLES,0,6,this.count);gl.disable(gl.BLEND);
    }
    diagnostics(){
      return {engine:this.kind,columns:this.cols,rows:this.rows,cells:this.count,width:this.canvas.width,height:this.canvas.height,glError:this.gl.getError()};
    }
  }

  // Compatibility path: fewer tiles, no GPU dependency; endpoints remain full images.
  class CanvasRenderer {
    constructor(canvas,loadedImages){
      this.canvas=canvas;this.images=loadedImages;this.kind='CANVAS 2D';
      this.ctx=canvas.getContext('2d',{alpha:false});
      if(!this.ctx)throw new Error('Canvas 2D is unavailable');
      this.buffers=[];
    }
    resize(width,height,dpr){
      this.width=width;this.height=height;this.dpr=Math.min(dpr,1.25);
      this.canvas.width=Math.round(width*this.dpr);this.canvas.height=Math.round(height*this.dpr);
      this.cols=Math.min(80,Math.max(32,Math.floor(width/9/8)*8));
      this.rows=Math.ceil(this.cols*height/width/8)*8;this.count=this.cols*this.rows;
      transport.configure(this.cols,this.rows,width,height,options.spatial);
      this.buffers=this.images.map((image,i)=>{
        const c=document.createElement('canvas');c.width=this.canvas.width;c.height=this.canvas.height;
        const ctx=c.getContext('2d'),iw=image.naturalWidth,ih=image.naturalHeight,scale=Math.max(c.width/iw,c.height/ih);
        const sw=c.width/scale,sh=c.height/scale;
        const sx=clamp(MEDIA[i].position[0]*iw-sw*.5,0,iw-sw),sy=clamp(MEDIA[i].position[1]*ih-sh*.5,0,ih-sh);
        ctx.drawImage(image,sx,sy,sw,sh,0,0,c.width,c.height);return c;
      });
    }
    render(a,b,p){
      const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
      ctx.globalAlpha=1;ctx.setTransform(1,0,0,1,0,0);
      if(options.reduced||p<.001||p>.999){ctx.drawImage(this.buffers[p<.5?a:b],0,0);return;}
      const plan=options.mapping==='color'?transport.get(a,b):transport.baseline(options.mapping,a,b);
      if(!plan){transport.request(a,b);ctx.drawImage(this.buffers[a],0,0);return;}
      currentPlan=plan;
      ctx.fillStyle='#090d18';ctx.fillRect(0,0,w,h);
      const cw=w/this.cols,ch=h/this.rows,m=Timing.envelope(p);
      ctx.globalAlpha=lerp(1,.045,m);ctx.drawImage(this.buffers[p<.5?a:b],0,0);ctx.globalAlpha=1;
      const f=plan.attrs,desc=transport.current.descriptors[a];
      for(let i=0;i<this.count;i++){
        const x=i%this.cols,y=Math.floor(i/this.cols),k=i*10,tx=f[k],ty=f[k+1],sx=(x+.5)/this.cols,sy=(y+.5)/this.rows;
        const frame=Timing.sample(p,f[k+6],f[k+7]),t=frame.t,z=1-t;
        const xx=(z*z*z*sx+3*z*z*t*f[k+2]+3*z*t*t*f[k+4]+t*t*t*tx)*w;
        const yy=(z*z*z*sy+3*z*z*t*f[k+3]+3*z*t*t*f[k+5]+t*t*t*ty)*h;
        const blend=options.holdColor?smoothBetween(.86,.998,p):smoothBetween(.52,.96,t),size=lerp(1,.73+.16*desc[i*4],frame.mosaic);
        const dw=cw*size,dh=ch*size,dx=xx-dw/2,dy=yy-dh/2;
        ctx.globalAlpha=1;ctx.drawImage(this.buffers[a],x*cw,y*ch,cw,ch,dx,dy,dw,dh);
        if(blend>0){ctx.globalAlpha=blend;ctx.drawImage(this.buffers[b],(tx-.5/this.cols)*w,(ty-.5/this.rows)*h,cw,ch,dx,dy,dw,dh);}
      }
      ctx.globalAlpha=1;
    }
    diagnostics(){return{engine:this.kind,columns:this.cols,rows:this.rows,cells:this.count,width:this.canvas.width,height:this.canvas.height};}
  }

  function buildGallery(){
    MEDIA.forEach((scene,i)=>{
      const number=String(i+1).padStart(2,'0');
      const card=document.createElement('button');card.type='button';card.className='film-card';
      card.setAttribute('aria-label',`切换至第 ${i+1} 幕：${scene.name}`);
      card.innerHTML=`<span class="film-thumb"><img alt="" draggable="false"></span><span class="film-title"><small>${number} / MEMORY</small><strong></strong></span>`;
      card.querySelector('img').src=scene.src;card.querySelector('strong').textContent=scene.name;
      card.addEventListener('click',()=>goToScene(i));$('filmstrip').append(card);
      const dot=document.createElement('button');dot.type='button';dot.className='rail-dot';dot.innerHTML='<span></span>';
      dot.setAttribute('aria-label',`第 ${i+1} 幕：${scene.name}`);dot.addEventListener('click',()=>goToScene(i));$('sceneRail').append(dot);
      const large=document.createElement('button');large.type='button';large.className='gallery-item';
      large.innerHTML=`<img alt="" draggable="false"><div><span>${number}</span><strong></strong></div><small></small>`;
      large.querySelector('img').src=scene.src;large.querySelector('strong').textContent=scene.name;large.querySelector('small').textContent=scene.en;
      large.addEventListener('click',()=>{$('galleryDialog').close();goToScene(i);});$('galleryGrid').append(large);
    });
  }
  function hint(){
    $('manualIndicator').classList.add('visible');clearTimeout(hintTimer);
    hintTimer=setTimeout(()=>$('manualIndicator').classList.remove('visible'),2400);
  }
  function updateAutoButton(){
    $('autoButton').disabled=options.reduced;
    $('autoButton').title=options.reduced?'低动态模式下不自动播放；可在跃迁设置中关闭该模式':'自动巡航 · 空格键暂停';
    $('autoButton').setAttribute('aria-pressed',String(state.autoplay));
    $('autoButton').setAttribute('aria-label',state.autoplay?'暂停自动巡航':'开始自动巡航');
    $('autoText').textContent=state.autoplay?'暂停巡航':'自动巡航';
    $('autoButton').querySelector('path').setAttribute('d',state.autoplay?'M4 3h2.5v10H4zm5.5 0H12v10H9.5z':'M5 2.5 13 8 5 13.5z');
  }
  function setAuto(value,showHint=true){
    if(value&&options.reduced){value=false;}
    state.autoplay=value;
    if(!value){state.motion=null;state.seeking=false;state.manualTarget=state.position;state.hold=0;if(showHint)hint();}
    else{
      $('manualIndicator').classList.remove('visible');state.seeking=false;state.hold=0;
      const fraction=wrap(state.position,1);
      if(!state.motion&&fraction>.001&&fraction<.999)beginMotion(Math.ceil(state.position),options.duration*Math.max(.35,1-fraction));
    }
    updateAutoButton();state.dirty=true;
  }
  function beginMotion(destination,duration=options.duration){
    state.seeking=false;state.manualTarget=destination;
    if(options.reduced||Math.abs(destination-state.position)<.0001){state.position=destination;state.motion=null;state.dirty=true;return;}
    state.motion={from:state.position,to:destination,elapsed:0,duration:Math.max(.25,duration)};
  }
  function goToScene(index){
    if(!state.ready)return;
    setAuto(false,false);
    let destination=Math.floor(state.position/N)*N+index;
    while(destination-state.position>N/2)destination-=N;
    while(destination-state.position<-N/2)destination+=N;
    const distance=Math.abs(destination-state.position);
    beginMotion(destination,options.duration*Math.max(.65,Math.min(1.5,distance)));
    hint();$('stage').focus({preventScroll:true});
  }
  function step(direction){
    if(!state.ready)return;
    setAuto(false,false);
    const destination=direction>0?Math.floor(state.position+1e-5)+1:Math.ceil(state.position-1e-5)-1;
    beginMotion(destination,options.duration*Math.max(.55,Math.abs(destination-state.position)));
    hint();$('stage').focus({preventScroll:true});
  }
  function showScene(index){
    if(index===state.dominant)return;
    const previous=state.dominant;state.dominant=index;
    const scene=MEDIA[index],number=String(index+1).padStart(2,'0');
    document.documentElement.style.setProperty('--accent',scene.accent);
    $('sceneEnglish').textContent=scene.en;$('sceneOrdinal').textContent=number+' / '+String(N).padStart(2,'0');
    const lines=$('heroTitle').children;lines[0].textContent=scene.line1;lines[1].textContent=scene.line2;
    $('heroCaption').textContent=scene.caption;$('sceneTag').textContent=scene.tag;$('currentNumber').textContent=number;
    [...$('filmstrip').children].forEach((el,i)=>{el.classList.toggle('active',i===index);el.setAttribute('aria-current',i===index?'true':'false');});
    [...$('sceneRail').children].forEach((el,i)=>{el.classList.toggle('active',i===index);el.setAttribute('aria-current',i===index?'true':'false');});
    if(previous!==-1&&!options.reduced){
      if(titleAnimation)titleAnimation.cancel();
      titleAnimation=$('heroTitle').animate([{transform:'translateY(9px)',filter:'blur(3px)'},{transform:'translateY(0)',filter:'blur(0px)'}],{duration:600,easing:'cubic-bezier(.2,.7,.2,1)'});
    }
  }
  function phaseText(p){
    if(options.reduced||p<.018||p>.989)return'影像已就绪';
    if(p<.12)return'分出格片 · 同步启程';
    if(p<.88)return options.mapping==='color'?'同色格片 · 正在迁移':'几何对照 · 非内容匹配';
    return'抵达新坐标 · 同步填缝';
  }
  function updateUI(force=false){
    if(!force&&Math.abs(lastUIPosition-state.position)<.00005)return;
    lastUIPosition=state.position;
    const q=wrap(state.position),a=Math.floor(q),p=q-a,b=(a+1)%N;
    showScene(p<.53?a:b);
    const phase=phaseText(p);
    if(lastPhase!==phase){$('phaseText').textContent=phase;lastPhase=phase;}
    $('heroCopy').style.opacity=String(options.reduced?1:1-.80*Math.pow(Math.sin(p*Math.PI),4));
    $('heroCopy').style.transform=`translateY(${-Math.sin(p*Math.PI)*3}px)`;
    $('timelineFill').style.transform=`scaleX(${q/N})`;
    if(!state.sliderActive)$('timeline').value=String(Math.round(q*1000));
    updateTransportUI();
    $('timeline').setAttribute('aria-valuetext',`${MEDIA[a].name} → ${MEDIA[b].name}，跃迁 ${Math.round(p*100)}%`);
  }
  function renderNow(time=drawTime){
    if(!renderer||!state.ready||contextLost)return;
    const q=wrap(state.position),a=Math.floor(q),p=q-a,b=(a+1)%N;
    renderer.render(a,b,p,time);state.dirty=false;lastDrawPosition=state.position;
  }
  function resize(){
    if(!renderer)return;
    const r=$('stage').getBoundingClientRect(),style=getComputedStyle($('stage'));
    state.width=Math.max(1,r.width-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth));
    state.height=Math.max(1,r.height-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth));
    state.dpr=Math.min(window.devicePixelRatio||1,state.width<600?1.5:1.7);
    renderer.resize(state.width,state.height,state.dpr);
    $('engineText').textContent=renderer.kind;
    $('cellText').textContent=renderer.count.toLocaleString('en-US')+' CELLS';
    state.dirty=true;renderNow();
  }
  function tick(ms){
    requestAnimationFrame(tick);
    if(document.hidden||!state.ready||contextLost){state.lastTime=ms;return;}
    const dt=Math.min(.065,Math.max(0,(ms-state.lastTime)/1000));state.lastTime=ms;drawTime=ms/1000;
    const pairIndex=Math.floor(wrap(state.position));
    if(options.mapping==='color'&&(state.motion||state.seeking)&&!transport.get(pairIndex,(pairIndex+1)%N)){
      transport.request(pairIndex,(pairIndex+1)%N);mappingStatus();return;
    }
    if(state.motion){
      state.motion.elapsed+=dt;
      const t=clamp(state.motion.elapsed/state.motion.duration);
      state.position=lerp(state.motion.from,state.motion.to,t);
      if(t>=1){state.position=state.motion.to;state.motion=null;state.hold=0;}
    }else if(state.seeking){
      state.position+=(state.manualTarget-state.position)*(1-Math.exp(-dt*17));
      if(Math.abs(state.position-state.manualTarget)<.00006){state.position=state.manualTarget;state.seeking=false;}
    }else if(state.autoplay&&!options.reduced){
      state.hold+=dt;
      if(state.hold>=options.holdTime){state.hold=0;beginMotion(Math.round(state.position)+1);}
    }
    let pointerChanged=false;
    for(let i=0;i<2;i++){
      const delta=state.pointerTarget[i]-state.pointer[i];
      if(Math.abs(delta)>.0002){state.pointer[i]+=delta*(1-Math.exp(-dt*10));pointerChanged=true;}
    }
    updateUI();
    const fraction=wrap(state.position,1);
    const duringTransition=fraction>.003&&fraction<.997;
    if(state.dirty||Math.abs(lastDrawPosition-state.position)>.000002||(duringTransition&&pointerChanged))renderNow(drawTime);
    state.frames++;state.fpsTime+=dt;
    if(state.fpsTime>=.7){
      state.fps=state.frames/state.fpsTime;state.frames=0;state.fpsTime=0;
      if($('settingsDialog').open)$('engineStats').textContent=`${renderer.kind} · ${renderer.cols} × ${renderer.rows} = ${renderer.count.toLocaleString('en-US')} 格片 · ${renderer.canvas.width} × ${renderer.canvas.height} px · 动画循环 ${Math.round(state.fps)} fps`;
    }
  }

  function bindInteractions(){
    $('autoButton').addEventListener('click',()=>setAuto(!state.autoplay));
    $('prevButton').addEventListener('click',()=>step(-1));$('nextButton').addEventListener('click',()=>step(1));$('nextHero').addEventListener('click',()=>step(1));
    const immersive=value=>{document.body.classList.toggle('immersive',value);$('immerseButton').setAttribute('aria-label',value?'退出沉浸模式':'进入沉浸模式，快捷键 F');requestAnimationFrame(resize);};
    $('immerseButton').addEventListener('click',()=>immersive(!document.body.classList.contains('immersive')));
    $('exitImmersive').addEventListener('click',()=>immersive(false));
    document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>{setAuto(false,false);$(button.dataset.open).showModal();}));
    document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
    document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
    const modalOpen=()=>!!document.querySelector('dialog[open]');
    window.addEventListener('keydown',event=>{
      const tag=event.target.tagName;
      if(['INPUT','SELECT','TEXTAREA'].includes(tag)||event.ctrlKey||event.metaKey||event.altKey)return;
      if(modalOpen())return;
      if(event.code==='Space'){
        if(tag==='BUTTON'||tag==='SUMMARY'||tag==='A')return;
        event.preventDefault();if(!event.repeat)setAuto(!state.autoplay);
      }else if(event.code==='ArrowRight'||event.code==='ArrowDown'){event.preventDefault();if(!event.repeat)step(1);}
      else if(event.code==='ArrowLeft'||event.code==='ArrowUp'){event.preventDefault();if(!event.repeat)step(-1);}
      else if(event.code==='KeyF'){event.preventDefault();if(!event.repeat)immersive(!document.body.classList.contains('immersive'));}
      else if(event.code==='Escape'){immersive(false);}
    });
    $('stage').addEventListener('wheel',event=>{
      if(!state.ready||modalOpen())return;
      event.preventDefault();
      if(options.reduced){
        if(!state.wheelLock){step(event.deltaY>=0?1:-1);state.wheelLock=true;setTimeout(()=>state.wheelLock=false,300);}return;
      }
      if(state.autoplay||state.motion)setAuto(false,false);
      const unit=event.deltaMode===1?16:event.deltaMode===2?state.height:1;
      const axis=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
      state.manualTarget+=clamp(axis*unit*.00125,-.18,.18);state.seeking=true;hint();
    },{passive:false});
    let drag=null;
    $('stage').addEventListener('pointerdown',event=>{
      if(!state.ready||event.button>0||event.target.closest('button,a,input,select'))return;
      if(state.autoplay||state.motion)setAuto(false,false);
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,position:state.position};
      $('stage').setPointerCapture(event.pointerId);$('stage').style.cursor='grabbing';
    });
    $('stage').addEventListener('pointermove',event=>{
      const r=$('stage').getBoundingClientRect();
      state.pointerTarget=[clamp((event.clientX-r.left)/r.width),clamp((event.clientY-r.top)/r.height)];state.pointerInside=1;
      if(drag&&drag.id===event.pointerId){
        const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
        const distance=Math.abs(dx)>Math.abs(dy)?-dx:-dy;
        state.manualTarget=drag.position+distance/(Math.min(state.width,state.height)*.78);
        state.seeking=true;hint();
      }
    });
    const endDrag=()=>{drag=null;$('stage').style.cursor='';};
    $('stage').addEventListener('pointerup',endDrag);$('stage').addEventListener('pointercancel',endDrag);$('stage').addEventListener('lostpointercapture',endDrag);
    $('stage').addEventListener('pointerleave',()=>{state.pointerInside=0;state.pointerTarget=[.5,.5];state.dirty=true;});
    const slider=$('timeline');
    slider.addEventListener('pointerdown',()=>{setAuto(false,false);state.sliderActive=true;state.sliderBase=Math.floor(state.position/N)*N;});
    slider.addEventListener('input',()=>{
      if(!state.sliderActive){setAuto(false,false);state.sliderBase=Math.floor(state.position/N)*N;}
      state.position=state.sliderBase+Number(slider.value)/1000;state.manualTarget=state.position;state.seeking=false;state.motion=null;
      state.dirty=true;updateUI(true);renderNow();
    });
    slider.addEventListener('change',()=>{state.sliderActive=false;hint();});
    window.addEventListener('pointerup',()=>{state.sliderActive=false;});
    $('density').addEventListener('change',event=>{options.density=Number(event.target.value);resize();});
    $('duration').addEventListener('change',event=>{options.duration=Number(event.target.value);});
    $('mappingMode').addEventListener('change',event=>{
      options.mapping=event.target.value;state.dirty=true;mappingStatus();updateTransportUI();renderNow();
    });
    $('spatialWeight').addEventListener('change',event=>{options.spatial=Number(event.target.value);resize();});
    $('holdColor').addEventListener('change',event=>{options.holdColor=event.target.checked;state.dirty=true;renderNow();});
    $('trails').addEventListener('change',event=>{options.trails=event.target.checked;state.dirty=true;renderNow();});
    $('inspectTransport').addEventListener('click',()=>{
      setAuto(false,false);$('settingsDialog').close();
      options.holdColor=true;$('holdColor').checked=true;
      state.position=Math.floor(state.position)+.76;state.manualTarget=state.position;state.seeking=false;
      document.body.classList.add('clean');$('cleanView').checked=true;state.dirty=true;updateUI(true);renderNow();
    });
    $('resetView').addEventListener('click',()=>{
      options.holdColor=false;$('holdColor').checked=false;document.body.classList.remove('clean');$('cleanView').checked=false;
      state.position=Math.round(state.position);state.manualTarget=state.position;state.dirty=true;updateUI(true);renderNow();
    });
    $('holdTime').addEventListener('change',event=>{options.holdTime=Number(event.target.value);});
    $('cleanView').addEventListener('change',event=>document.body.classList.toggle('clean',event.target.checked));
    $('reducedMotion').checked=options.reduced;
    $('reducedMotion').addEventListener('change',event=>{
      options.reduced=event.target.checked;updateAutoButton();
      if(options.reduced){setAuto(false,false);state.position=Math.round(state.position);state.manualTarget=state.position;}
      state.dirty=true;updateUI(true);renderNow();
    });
    motionQuery.addEventListener?.('change',event=>{
      options.reduced=event.matches;$('reducedMotion').checked=event.matches;updateAutoButton();
      if(event.matches){setAuto(false,false);state.position=Math.round(state.position);state.manualTarget=state.position;}
      state.dirty=true;updateUI(true);
    });
    new ResizeObserver(resize).observe($('stage'));
    document.addEventListener('visibilitychange',()=>{state.lastTime=performance.now();if(!document.hidden)state.dirty=true;});
  }
  function mappingStatus(){
    if(!transport||!renderer)return;
    const a=Math.floor(wrap(state.position)),plan=transport.get(a,(a+1)%N);
    const wait=options.mapping==='color'&&!plan;
    $('loadStatus').classList.toggle('done',!wait);
    if(wait)$('loadText').textContent=`正在为 ${renderer.count.toLocaleString('en-US')} 枚格片寻找目的地…`;
    $('mappingBadge').textContent=options.mapping==='color'?'OKLAB · CONTENT TRANSPORT':options.mapping==='geometry'?'GEOMETRY · CONTROL':'SAME POSITION · CONTROL';
  }
  function updateTransportUI(){
    if(!transport||!transport.current)return;
    const a=Math.floor(wrap(state.position)),b=(a+1)%N,plan=transport.get(a,b),entry=transport.current;
    $('pairLabel').textContent=MEDIA[a].name+' → '+MEDIA[b].name;
    if(!plan){$('matchSummary').textContent='颜色匹配计算中…';return;}
    const m=plan.metrics,delta=Math.round(m.colorReductionVsSame*100);
    $('matchSummary').textContent='一对一目的地 · '+m.uniqueTargets.toLocaleString('en-US')+' / '+m.count.toLocaleString('en-US');
    $('colorMetric').textContent=(m.meanColorError*100).toFixed(1);
    $('baselineMetric').textContent=(m.samePositionError*100).toFixed(1);
    $('gainMetric').textContent=(delta>=0?'−':'+')+Math.abs(delta)+'%';
    $('travelMetric').textContent=(m.meanTravel*100).toFixed(1)+'%';
    $('matchingTiming').textContent=`${transport.workerMode} · 当前画面配置 ${entry.plans.size}/${N} 组映射就绪 · 此组计算 ${Math.round(m.computeMs)} ms`;
    mappingStatus();
  }
  function showError(error){
    console.error(error);
    $('errorBox').hidden=false;
    $('errorBox').textContent='影像引擎未能启动：'+(error instanceof Error?error.message:String(error))+'。请使用新版 Edge / Chrome / Firefox 打开完整 HTML 文件。';
    $('loadStatus').classList.add('done');
  }
  async function init(){
    buildGallery();showScene(0);updateAutoButton();bindInteractions();
    const controls={mapping:'mappingMode',spatial:'spatialWeight',holdColor:'holdColor',trails:'trails',density:'density',duration:'duration',holdTime:'holdTime'};
    for(const [key,id] of Object.entries(controls)){
      const e=$(id);if(e.type==='checkbox'){e.checked=options[key];continue;}
      if(![...e.options].some(o=>o.value===String(options[key])))e.add(new Option(String(options[key]),String(options[key])));
      e.value=String(options[key]);
    }
    document.body.classList.toggle('clean',CONFIG.cleanView===true);
    $('cleanView').checked=CONFIG.cleanView===true;
    let loaded=0;
    images=await Promise.all(MEDIA.map(scene=>new Promise((resolve,reject)=>{
      const image=new Image();
      const timer=setTimeout(()=>reject(new Error('图像装载超时：'+scene.name)),30000);
      image.onload=()=>{clearTimeout(timer);loaded++;$('loadText').textContent=`正在装载影像 ${loaded} / ${N}`;resolve(image);};
      image.onerror=()=>{clearTimeout(timer);reject(new Error('无法读取图像：'+scene.name));};
      image.decoding='async';image.src=scene.src;
    })));
    transport=new TileTransportManager(images,MEDIA,()=>{
      state.dirty=true;mappingStatus();updateTransportUI();
    },showError);
    try{renderer=new GLRenderer($('visual'),images);}
    catch(error){
      console.warn('WebGL renderer unavailable; using Canvas 2D compatibility mode.',error);
      const replacement=document.createElement('canvas');replacement.id='visual';replacement.setAttribute('aria-label','兼容模式的图像格阵转场');$('visual').replaceWith(replacement);
      renderer=new CanvasRenderer(replacement,images);
    }
    state.ready=true;resize();updateUI(true);renderNow(0);
    $('loadStatus').classList.add('done');
    state.lastTime=performance.now();requestAnimationFrame(tick);
    // Small deterministic interface for reproducible browser testing and frame capture.
    window.WarpArchive={
      pause(){setAuto(false,false);},
      play(){setAuto(true,false);},
      seek(position){
        if(!Number.isFinite(position))throw new TypeError('position must be finite');
        setAuto(false,false);state.position=position;state.manualTarget=position;state.seeking=false;state.dirty=true;updateUI(true);renderNow();
      },
      next(){step(1);},previous(){step(-1);},
      getState(){const a=Math.floor(wrap(state.position));return{ready:state.ready,position:state.position,autoplay:state.autoplay,scene:state.dominant,sceneCount:N,version:"3.1.0",timing:{...Timing.config},fps:Math.round(state.fps),reducedMotion:options.reduced,options:{...options},...renderer.diagnostics(),...transport.diagnostics(),metrics:transport.get(a,(a+1)%N)?.metrics||null};},
      getMetrics(){return Array.from(transport.current.plans.entries()).map(([pair,plan])=>({pair,...plan.metrics}));},
      getPlan(a,b){const p=transport.get(a,b);if(!p)return null;return {map:Array.from(p.map),attrs:Array.from(p.attrs),metrics:p.metrics};},
      sampleTiming(p,start,end){return Timing.sample(p,start,end);},
      getDescriptors(){return {config:transport.current.config,data:transport.current.descriptors.map(d=>Array.from(d))};},
      configure(settings){
        for(const [key,value] of Object.entries(settings)){
          if(!Object.prototype.hasOwnProperty.call(options,key))throw new Error('Unknown option: '+key);
          if(['density','duration','holdTime','spatial'].includes(key)&&(!Number.isFinite(value)||value<0))throw new TypeError('Invalid numeric option');
          if(key==='density'&&(!Number.isInteger(value)||value<32||value>256))throw new RangeError('density must be an integer in [32,256]');
          if(key==='duration'&&(value<.25||value>30))throw new RangeError('duration must be in [.25,30]');
          if(key==='holdTime'&&value>60)throw new RangeError('holdTime must be in [0,60]');
          if(key==='spatial'&&value>1)throw new RangeError('spatial must be in [0,1]');
          if(['holdColor','trails','reduced'].includes(key)&&typeof value!=='boolean')throw new TypeError('Invalid boolean option');
          if(key==='mapping'&&!['color','geometry','position'].includes(value))throw new TypeError('Invalid mapping mode');
        }
        Object.assign(options,settings);
        const controls={mapping:'mappingMode',spatial:'spatialWeight',holdColor:'holdColor',trails:'trails',density:'density',duration:'duration',holdTime:'holdTime'};
        for(const [key,id] of Object.entries(controls)){const e=$(id);if(e.type==='checkbox')e.checked=options[key];else {if(![...e.options].some(o=>o.value===String(options[key])))e.add(new Option(String(options[key]),String(options[key])));e.value=String(options[key]);}}
        if(options.reduced)setAuto(false,false);$('reducedMotion').checked=options.reduced;updateAutoButton();
        resize();state.dirty=true;updateUI(true);renderNow();
      }
    };
  }
  init().catch(showError);
})();
