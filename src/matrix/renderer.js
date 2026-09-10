/* Two renderers; no particle assignment. The screen-space cell centres never move. */
(function (root) {
  'use strict';
  const T = root.MatrixTimeline;
  const VERTEX = `#version 300 es
  in vec2 aPosition; out vec2 vUV;
  void main(){vUV=aPosition*.5+.5; gl_Position=vec4(aPosition.x,-aPosition.y,0.,1.);}`;
  const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uA,uB;
uniform vec2 uRes,uSizeA,uSizeB,uGrid;
uniform vec4 uCamA,uCamB,uStyle;
uniform vec3 uInk,uBlue,uPaper;
uniform float uBridge,uDirection,uClock;
in vec2 vUV;
out vec4 outColor;
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec2 imageUV(vec2 uv,vec2 size,vec4 cam){
  float ia=size.x/size.y, va=uRes.x/uRes.y;
  vec2 scale=vec2(min(1.,va/ia),min(1.,ia/va))/cam.z;
  vec2 offset=clamp(cam.xy-scale*.5,vec2(0.),vec2(1.)-scale);
  vec2 p=uv*scale+offset;
  // Smooth focal-region warp approximates depth; not a segmentation/depth map.
  vec2 delta=(p-cam.xy)*vec2(ia,1.);
  float foreground=exp(-dot(delta,delta)*18.);
  p+=vec2(.0045,-.0025)*cam.w*(foreground-.4);
  return clamp(p,vec2(.0001),vec2(.9999));
}
vec3 duo(vec3 c){
  float l=lum(c);
  vec3 d=mix(uInk,uBlue,smoothstep(.025,.34,l));
  return mix(d,uPaper,smoothstep(.35,.88,l));
}
vec3 painted(sampler2D image,vec2 uv,vec2 size,float style){
  vec3 c=texture(image,uv).rgb;
  if(style<.5)return c;
  if(style<1.5)return duo(c);
  if(style<2.5){
    vec3 posterColor=floor(c*4.5+.35)/4.5;
    return mix(posterColor,duo(posterColor),.72);
  }
  vec2 d=1.65/size;
  vec3 left=texture(image,uv-vec2(d.x,0.)).rgb, right=texture(image,uv+vec2(d.x,0.)).rgb;
  vec3 top=texture(image,uv-vec2(0.,d.y)).rgb,bottom=texture(image,uv+vec2(0.,d.y)).rgb;
  float e=length(vec2(lum(right)-lum(left),lum(bottom)-lum(top)));
  float line=smoothstep(.075,.255,e);
  vec3 paper=mix(uPaper,uBlue,(1.-lum(c))*.055);
  return mix(paper,uInk,line*.91);
}
float wipe(vec2 uv,float progress){
  float x=uDirection>0.?uv.x:1.-uv.x;
  float field=clamp(x*.64+uv.y*.36+.035*sin(uv.y*9.+uv.x*3.),0.,1.);
  return smoothstep(field-.12,field+.12,progress*1.24-.12);
}
vec3 imageA(vec2 screen){
  vec2 uv=imageUV(screen,uSizeA,uCamA);
  vec3 a=painted(uA,uv,uSizeA,uStyle.x);
  if(uStyle.x==uStyle.y || uStyle.z<=0.)return a;
  return mix(a,painted(uA,uv,uSizeA,uStyle.y),wipe(screen,uStyle.z));
}
vec3 imageB(vec2 screen){return painted(uB,imageUV(screen,uSizeB,uCamB),uSizeB,3.);}
float roundedBox(vec2 p,vec2 halfSize,float radius){
  vec2 q=abs(p)-halfSize+radius;
  return length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
}
void main(){
  vec2 uv=vUV;
  float bridge=uBridge;
  vec3 original=imageA(uv);
  bool forced=uStyle.w>.5;
  if(bridge<=0. && !forced){outColor=vec4(original,1.);return;}
  vec2 cell=floor(uv*uGrid), center=(cell+.5)/uGrid, local=fract(uv*uGrid)-.5;
  float x=uDirection>0.?center.x:1.-center.x;
  float wave=clamp(x*.68+center.y*.28+.04*sin(center.y*9.),0.,1.);
  float enter=${T.GRID_HANDOFF.enterDelay.toFixed(3)}*wave;
  float leave=${T.GRID_HANDOFF.exitStart.toFixed(3)}+${T.GRID_HANDOFF.exitDelay.toFixed(3)}*wave;
  float amount=forced?1.:smoothstep(enter,enter+${T.GRID_HANDOFF.enterDuration.toFixed(3)},bridge)
    *(1.-smoothstep(leave,leave+${T.GRID_HANDOFF.exitDuration.toFixed(3)},bridge));
  float turn=forced?0.:smoothstep(.18+wave*.22,.52+wave*.24,bridge);
  float swap=smoothstep(.44,.56,turn);
  // Gradually quantize sampling within each fixed cell; no instantaneous texture snap.
  vec2 samplePoint=mix(uv,center,amount);
  vec3 a=texture(uA,imageUV(samplePoint,uSizeA,uCamA)).rgb;
  vec3 b=texture(uB,imageUV(samplePoint,uSizeB,uCamB)).rgb;
  vec3 sampleColor=mix(a,b,swap);
  float l=lum(sampleColor);
  float bank=.14+.86*abs(cos(turn*3.14159265));
  vec2 halfSize=mix(vec2(.5),vec2((.29+.14*sqrt(max(0.,l)))*bank,.31+.125*sqrt(max(0.,l))),amount);
  float radius=min(.075,halfSize.x*.65)*amount;
  float sdf=roundedBox(local,halfSize,radius);
  float aa=max(fwidth(sdf),.012);
  float coverage=mix(1.,1.-smoothstep(-aa,aa,sdf),amount);
  vec3 pigment=duo(sampleColor);
  // Light comes from the tile, rather than an opaque white flash over the page.
  float topShade=(1.-smoothstep(-.38,.30,local.y))*.13;
  pigment*=.84+.16*smoothstep(-.4,.3,local.y);
  pigment+=uBlue*topShade;
  float scan=forced?exp(-pow((center.x-fract(uClock*.13))/.06,2.)):
    exp(-pow((bridge-(.31+wave*.26))/.046,2.));
  pigment+=uBlue*scan*.20;
  vec3 plate=uInk*.52+uBlue*.012;
  vec3 continuous=forced?original:mix(original,imageB(uv),swap);
  // Each cell returns its texture detail and closes its gaps as it finishes flipping.
  vec3 fill=mix(continuous,pigment,amount);
  outColor=vec4(clamp(mix(plate,fill,coverage),0.,1.),1.);
}`;
  const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
  const rgb = c => `rgb(${c.map(v=>Math.round(T.clip(v)*255)).join(',')})`;
  function palette(config, scene) {
    if(config.palette==='mono')return [[.03,.04,.05],[.49,.57,.6],[.96,.97,.95]];
    if(config.palette==='scene')return [[.026,.045,.085],[1,3,5].map(k=>parseInt(scene.accent.slice(k,k+2),16)/255*.85),[.965,.97,.95]];
    return [[.013,.065,.092],[.27,.64,.82],[.955,.977,.962]];
  }
  function cameras(frame, scenes, focusMap) {
    const scene=scenes[frame.scene], next=scenes[frame.next];
    const focus=focusMap[scene.slug]||scene.position;
    const at=mix(scene.position,focus,frame.focus);
    return {a:[...at,frame.zoom,frame.drift],b:[...next.position,1.015,0]};
  }
  function sizeCanvas(canvas,width,height,dpr) {
    const scale=Math.min(dpr||1,1.5,Math.sqrt(2800000/(width*height)));
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  }
  class WebGLRenderer {
    constructor(canvas,images) {
      this.canvas=canvas;this.images=images;this.kind='WEBGL 2';this.drawCount=0;
      const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
      if(!gl)throw new Error('WebGL 2 unavailable');this.gl=gl;
      const compile=(type,source)=>{
        const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;
      };
      const vs=compile(gl.VERTEX_SHADER,VERTEX),fs=compile(gl.FRAGMENT_SHADER,FRAGMENT);
      this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
      this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const loc=gl.getAttribLocation(this.program,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      this.locations={};for(const name of ['uA','uB','uRes','uSizeA','uSizeB','uGrid','uCamA','uCamB','uStyle','uInk','uBlue','uPaper','uBridge','uDirection','uClock'])this.locations[name]=gl.getUniformLocation(this.program,name);
      this.textures=images.map(image=>{
        const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);return texture;
      });
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
    }
    setComposition(compositor){this.compositor=compositor;this.dynamicSizes=new Map();}
    resize(width,height,dpr){this.width=width;this.height=height;sizeCanvas(this.canvas,width,height,dpr);this.compositor?.resize(width,height);}
    upload(index,source){
      const gl=this.gl,key=source.width+':'+source.height;gl.bindTexture(gl.TEXTURE_2D,this.textures[index]);
      if(this.dynamicSizes.get(index)!==key){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);this.dynamicSizes.set(index,key);}
      else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
    }
    draw(frame,config,scenes,focusMap) {
      const gl=this.gl;if(gl.isContextLost())return;
      if(this.compositor){const source=this.compositor.render(frame,config);this.upload(frame.scene,source.a);if(frame.bridge>0)this.upload(frame.next,source.b);}
      const L=this.locations,cam=this.compositor?{a:[.5,.5,1,0],b:[.5,.5,1,0]}:cameras(frame,scenes,focusMap);
      let colors=palette(config,scenes[frame.scene]);
      if(config.palette==='scene'&&frame.bridge>0){const next=palette(config,scenes[frame.next]);colors=colors.map((c,i)=>mix(c,next[i],T.span(.2,1,frame.bridge)));}
      const grid=T.grid(this.width,this.height,config.density);this.grid=grid;
      gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);gl.bindVertexArray(this.vao);
      for(const [unit,index,name,sizeName] of [[0,frame.scene,'uA','uSizeA'],[1,frame.next,'uB','uSizeB']]){
        gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.textures[index]);gl.uniform1i(L[name],unit);
        gl.uniform2f(L[sizeName],this.compositor?.width||this.images[index].naturalWidth,this.compositor?.height||this.images[index].naturalHeight);
      }
      gl.uniform2f(L.uRes,this.width,this.height);gl.uniform2f(L.uGrid,grid.cols,grid.rows);
      gl.uniform4fv(L.uCamA,cam.a);gl.uniform4fv(L.uCamB,cam.b);
      gl.uniform4f(L.uStyle,frame.from,frame.to,frame.reveal,frame.forceMatrix?1:0);
      gl.uniform3fv(L.uInk,colors[0]);gl.uniform3fv(L.uBlue,colors[1]);gl.uniform3fv(L.uPaper,colors[2]);
      gl.uniform1f(L.uBridge,frame.bridge);gl.uniform1f(L.uDirection,frame.direction);gl.uniform1f(L.uClock,frame.position);
      gl.drawArrays(gl.TRIANGLES,0,6);this.drawCount++;
    }
    error(){return this.gl.getError();}
    dispose(){const gl=this.gl;this.textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(this.buffer);gl.deleteVertexArray(this.vao);gl.deleteProgram(this.program);this.compositor?.dispose();}
  }
  function mapped(ctx,image,cam,w,h) {
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,ia=iw/ih,va=w/h;
    const sw=iw*Math.min(1,va/ia)/cam[2],sh=ih*Math.min(1,ia/va)/cam[2];
    const sx=T.clip(cam[0]*iw-sw/2,0,iw-sw),sy=T.clip(cam[1]*ih-sh/2,0,ih-sh);
    ctx.drawImage(image,sx,sy,sw,sh,0,0,w,h);
  }
  function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function tone(c,pal){const l=c[0]*.2126+c[1]*.7152+c[2]*.0722;return mix(mix(pal[0],pal[1],T.span(.025,.34,l)),pal[2],T.span(.35,.88,l));}
  class CanvasRenderer {
    constructor(canvas,images){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw new Error('Canvas unavailable');this.images=images;this.kind='CANVAS 2D';this.drawCount=0;this.cache=new Map();this.layer=makeCanvas(1,1);this.sampleA=makeCanvas(1,1);this.sampleB=makeCanvas(1,1);}
    setComposition(compositor){this.compositor=compositor;}
    resize(w,h,dpr){this.width=w;this.height=h;sizeCanvas(this.canvas,w,h,Math.min(1,dpr));this.layer.width=this.canvas.width;this.layer.height=this.canvas.height;this.compositor?.resize(Math.min(w,640),Math.min(w,640)*h/w);}
    surface(index,style,pal,key) {
      const input=this.sources?.get(index)||this.images[index];
      if(style===0)return input;
      const id=[index,style,key].join(':');if(this.cache.has(id))return this.cache.get(id);
      const img=input,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,w=Math.min(1100,iw),h=Math.round(w*ih/iw),c=makeCanvas(w,h),ctx=c.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(img,0,0,w,h);const data=ctx.getImageData(0,0,w,h),raw=new Uint8ClampedArray(data.data);
      const luma=p=>(raw[p]*.2126+raw[p+1]*.7152+raw[p+2]*.0722)/255;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const p=(y*w+x)*4,src=[raw[p]/255,raw[p+1]/255,raw[p+2]/255];let out;
        if(style===1)out=tone(src,pal);
        else if(style===2){const flat=src.map(v=>Math.floor(v*4.5+.35)/4.5);out=mix(flat,tone(flat,pal),.72);}
        else {const gx=luma((y*w+Math.min(w-1,x+1))*4)-luma((y*w+Math.max(0,x-1))*4),gy=luma((Math.min(h-1,y+1)*w+x)*4)-luma((Math.max(0,y-1)*w+x)*4);out=mix(mix(pal[2],pal[1],(1-luma(p))*.055),pal[0],T.span(.075,.255,Math.hypot(gx,gy))*.91);}
        for(let d=0;d<3;d++)data.data[p+d]=T.clip(out[d])*255;
      }
      ctx.putImageData(data,0,0);if(this.cache.size>=35)this.cache.delete(this.cache.keys().next().value);this.cache.set(id,c);return c;
    }
    draw(frame,config,scenes,focusMap){
      if(this.compositor){const source=this.compositor.render(frame,config);this.sources=new Map([[frame.scene,source.a],[frame.next,source.b]]);this.cache.clear();}
      const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height,cam=this.compositor?{a:[.5,.5,1,0],b:[.5,.5,1,0]}:cameras(frame,scenes,focusMap),pal=palette(config,scenes[frame.scene]),key=config.palette+':'+scenes[frame.scene].accent;
      ctx.globalAlpha=1;mapped(ctx,this.surface(frame.scene,frame.from,pal,key),cam.a,w,h);
      if(frame.from!==frame.to && frame.reveal>0){ctx.globalAlpha=frame.reveal;mapped(ctx,this.surface(frame.scene,frame.to,pal,key),cam.a,w,h);ctx.globalAlpha=1;}
      const b=frame.bridge;
      if(b>0){ctx.globalAlpha=T.span(.35,.70,b);const nextPal=palette(config,scenes[frame.next]);mapped(ctx,this.surface(frame.next,3,nextPal,config.palette+':'+scenes[frame.next].accent),cam.b,w,h);ctx.globalAlpha=1;}
      const grid=T.grid(w,h,Math.min(config.density,96));this.grid=grid;
      if(b>0||frame.forceMatrix){
        {
          const {cols,rows}=grid;
          for(const [c,image,camera] of [[this.sampleA,this.sources?.get(frame.scene)||this.images[frame.scene],cam.a],[this.sampleB,this.sources?.get(frame.next)||this.images[frame.next],cam.b]]){
            if(c.width!==cols||c.height!==rows){c.width=cols;c.height=rows;}mapped(c.getContext('2d',{willReadFrequently:true}),image,camera,cols,rows);
          }
          const a=this.sampleA.getContext('2d').getImageData(0,0,cols,rows).data,bb=this.sampleB.getContext('2d').getImageData(0,0,cols,rows).data;
          const layer=this.layer.getContext('2d');layer.clearRect(0,0,w,h);
          const plate=rgb(pal[0].map(v=>v*.52));
          const cw=w/cols,ch=h/rows;
          for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
            const sx=(x+.5)/cols,sy=(y+.5)/rows,wave=T.clip((frame.direction>0?sx:1-sx)*.68+sy*.28+.04*Math.sin(sy*9));
            const amount=frame.forceMatrix?1:T.gridEnvelope(b,wave);if(amount<=0)continue;
            const turn=frame.forceMatrix?0:T.span(.18+wave*.22,.52+wave*.24,b),swap=T.span(.44,.56,turn),p=(y*cols+x)*4;
            const c=[0,1,2].map(i=>(a[p+i]+(bb[p+i]-a[p+i])*swap)/255),l=c[0]*.2126+c[1]*.7152+c[2]*.0722;
            const bank=.14+.86*Math.abs(Math.cos(turn*Math.PI));
            const tw=cw*(1+((.58+.28*Math.sqrt(l))*bank-1)*amount),th=ch*(1+(.62+.25*Math.sqrt(l)-1)*amount);
            const tx=(x+.5)*cw-tw/2,ty=(y+.5)*ch-th/2;
            layer.globalAlpha=amount;layer.fillStyle=plate;layer.fillRect(x*cw,y*ch,cw,ch);
            layer.clearRect(tx,ty,tw,th);layer.fillStyle=rgb(tone(c,pal));layer.fillRect(tx,ty,tw,th);
          }
          layer.globalAlpha=1;ctx.drawImage(this.layer,0,0);
        }
      }
      this.drawCount++;
    }
    error(){return 0;}
    dispose(){this.cache.clear();this.compositor?.dispose();}
  }
  root.MatrixRenderers=Object.freeze({WebGLRenderer,CanvasRenderer,cameras,palette,shader:FRAGMENT});
})(globalThis);
