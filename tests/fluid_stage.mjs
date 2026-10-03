import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Stage,artworkPoint} from '../src/studies/core.mjs';
import {create,Fluid,PigmentField} from '../src/studies/fluid.mjs';
import {hitRegion} from '../src/studies/fluid-regions.mjs';

// Exercise the production Stage listeners, effect hit/pending logic and solver.
// Only DOM/image/canvas I/O is substituted; this is a Node integration test.
const samples=JSON.parse(readFileSync(0,'utf8'));
const chapters=JSON.parse(readFileSync(new URL('../src/studies/catalog.json',import.meta.url),'utf8')).find(c=>c.id==='fluid').chapters;
const points={mineral:[.60,.71],ink:[.65,.5],paper:[.70,.55],light:[.56,.71]};
const identity=()=>({a:1,b:0,c:0,d:1,e:0,f:0});
const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
class Element {
  constructor(){this.listeners=new Map();this.children=[];this.nodes=new Map();this.style={setProperty(){}};this.rect=null;}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type){this.listeners.delete(type);}
  dispatch(type,extra={}){this.listeners.get(type)?.({type,pointerId:1,...extra});}
  append(...nodes){for(const node of nodes){if(typeof node==='object')node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(){}
  focus(){}
  setPointerCapture(){}
  getBoundingClientRect(){return {...this.rect};}
  getClientRects(){return this.rect?[this.getBoundingClientRect()]:[];}
  querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new Element());return this.nodes.get(key);}
  querySelectorAll(key){return [this.querySelector(key+' 0'),this.querySelector(key+' 1')];}
}
class Context {
  constructor(canvas){this.canvas=canvas;this.matrix=identity();this.lastImage=null;}
  setTransform(a,b,c,d,e,f){this.matrix={a,b,c,d,e,f};}
  getTransform(){return {...this.matrix};}
  drawImage(image,...args){this.lastImage=image;if(image.sample)this.artwork={image,args,matrix:this.getTransform()};}
  getImageData(x,y,w,h){
    const data=new Uint8ClampedArray(w*h*4),sample=this.lastImage?.sample;
    if(sample)for(let j=0;j<h;j++)for(let i=0;i<w;i++){
      const from=(Math.min(79,Math.floor(j/h*80))*120+Math.min(119,Math.floor(i/w*120)))*4;
      data.set(sample.pixels.slice(from,from+4),(j*w+i)*4);
    }
    return {data};
  }
  clearRect(){} putImageData(){} beginPath(){} arc(){} stroke(){} fillRect(){}
}
class Canvas extends Element {
  constructor(){super();this.ctx=new Context(this);this.width=300;this.height=150;}
  set width(v){this.w=v;this.ctx.matrix=identity();} get width(){return this.w;}
  set height(v){this.h=v;this.ctx.matrix=identity();} get height(){return this.h;}
  getContext(kind){return kind==='2d'?this.ctx:null;}
}
let flow,field,calls;
const originalSetMask=Fluid.prototype.setMask,originalFieldMask=PigmentField.prototype.setMask;
const originalSplat=Fluid.prototype.splat,originalStep=Fluid.prototype.step,originalAdvect=PigmentField.prototype.step;
Fluid.prototype.setMask=function(...args){flow=this;return originalSetMask.apply(this,args);};
PigmentField.prototype.setMask=function(...args){field=this;return originalFieldMask.apply(this,args);};
Fluid.prototype.splat=function(...args){calls.force++;return originalSplat.apply(this,args);};
Fluid.prototype.step=function(...args){calls.solve++;return originalStep.apply(this,args);};
PigmentField.prototype.step=function(...args){calls.advect++;return originalAdvect.apply(this,args);};

async function setup(rect,dpr=1){
  calls={force:0,solve:0,advect:0};
  const document=new Element(),canvas=new Canvas(),theater=new Element();canvas.rect=rect;
  document.body=new Element();document.hidden=false;
  const elements=[];
  document.createElement=tag=>{const el=tag==='canvas'?new Canvas():new Element();elements.push(el);return el;};
  document.querySelectorAll=key=>key==='.controls input[type="range"]'?elements.filter(el=>el.type==='range'):Element.prototype.querySelectorAll.call(document,key);
  document.createTextNode=text=>({textContent:text});
  document.querySelector('#fluid-chapters').textContent=JSON.stringify(chapters);
  document.nodes.set('.theater',theater);theater.querySelectorAll=()=>theater.children.filter(el=>el.rect);
  let now=1000,raf;
  Object.assign(globalThis,{
    document,window:new Element(),devicePixelRatio:dpr,
    matchMedia:()=>({matches:false}),performance:{now:()=>now},
    ResizeObserver:class{observe(){}disconnect(){}},MutationObserver:class{observe(){}disconnect(){}},
    ImageData:class{constructor(w,h){this.data=new Uint8ClampedArray(w*h*4);}},
    Image:class{set src(url){this.sample=samples.find(s=>url.endsWith(s.image));assert.ok(this.sample);this.width=this.sample.width;this.height=this.sample.height;queueMicrotask(()=>this.onload());}},
    requestAnimationFrame:fn=>{raf=fn;return 1;},cancelAnimationFrame:()=>{},
  });
  const stage=new Stage(canvas,new Element()),effect=await create(stage,new Element());stage.start(effect);
  const tick=(n=1)=>{for(let i=0;i<n;i++){now+=1000/60;raf(now);assert.ok(!stage.statusElement.textContent?.startsWith('运行失败'),stage.statusElement.textContent);}};
  tick();
  // Independent forward projection from the actual drawImage call and canvas
  // transform. Tests never derive pointer inputs with the production hit helper.
  const client=(u,v)=>{
    const {args:[x,y,w,h],matrix:m}=canvas.ctx.artwork,r=canvas.getBoundingClientRect();
    return {clientX:r.left+(m.a*(x+u*w)+m.c*(y+v*h)+m.e)/canvas.width*r.width,
      clientY:r.top+(m.b*(x+u*w)+m.d*(y+v*h)+m.f)/canvas.height*r.height};
  };
  const reset=chapter=>{
    stage.setPlaying(false);effect.scenes.items[chapter].apply();tick();
    calls={force:0,solve:0,advect:0};
  };
  const gesture=(from,to,{frames=true,steps=16}={})=>{
    canvas.dispatch('pointermove',from);canvas.dispatch('pointerdown',from);
    for(let i=1;i<=steps;i++){
      canvas.dispatch('pointermove',{clientX:from.clientX+(to.clientX-from.clientX)*i/steps,clientY:from.clientY+(to.clientY-from.clientY)*i/steps});
      if(frames)tick();
    }
    canvas.dispatch('pointerup',to);tick(120);
  };
  return {stage,effect,canvas,theater,tick,client,reset,gesture};
}
function inert(initial,label){
  assert.deepEqual(calls,{force:0,solve:0,advect:0},label+' zero force and advection calls');
  assert.ok(flow.u.every(v=>v===0)&&flow.v.every(v=>v===0),label+' zero velocity');
  assert.deepEqual(field.uv,initial,label+' byte-identical pigment UVs');
}

// Explicit contain/letterbox and non-uniform backing-store transforms: even an
// all-white mask must not admit a point outside the painted image rectangle.
const rect=box(27.25,-153.5,1453.4,620.2),surface={width:1817,height:775,transform:{a:1.25,b:0,c:0,d:1.25,e:3,f:7}};
const fit={x:200,y:150,width:600,height:300};
assert.equal(hitRegion({x:140,y:rect.top+30},rect,fit,()=>1,[],surface),null,'letterbox rejects before colour');
for(const matrix of [surface.transform,{a:1.4,b:.1,c:-.2,d:1.1,e:7,f:-11}]){
  for(const [u,v] of [[.1,.2],[.65,.5],[.95,.9]]){
    const x=fit.x+u*fit.width,y=fit.y+v*fit.height;
    const p={x:rect.left+(matrix.a*x+matrix.c*y+matrix.e)/surface.width*rect.width,y:rect.top+(matrix.b*x+matrix.d*y+matrix.f)/surface.height*rect.height};
    const q=artworkPoint(p,rect,fit,{...surface,transform:matrix});
    assert.ok(q&&Math.abs(q.x-u)+Math.abs(q.y-v)<1e-12,'inverse painted transform roundtrip');
  }
}
console.log('PASS backing-store inverse, fractional CSS geometry and letterbox rejection');

let cases=0;
for(const dpr of [1,1.25,1.5,2])for(const chapter of [0,1,2,3]){
  const h=await setup(box(27,85,1453,620),dpr);
  for(const playing of [false,true])for(const frames of [false,true]){
    h.reset(chapter);h.stage.setPlaying(playing);
    const initial=field.uv.slice();
    h.gesture({clientX:140,clientY:218},{clientX:480,clientY:218},{frames});
    inert(initial,`${chapters[chapter].id} DPR ${dpr} playback ${playing} interleaved ${frames}`);
    assert.equal(h.effect.inspect().disturbed,false);assert.equal(h.effect.inspect().active,false);cases++;
  }
  h.reset(chapter);h.stage.setPlaying(true);
  const initial=field.uv.slice(),[u,v]=points[chapters[chapter].id];
  h.gesture(h.client(u,v),h.client(u+.02,v+.01));
  assert.ok(calls.force>0&&calls.advect>0,chapters[chapter].id+' real Stage pigment gesture accepted');
  assert.ok(field.uv.some((v,i)=>Math.abs(v-initial[i])>.0001),'interior pigment moves');
  h.stage.dispose();
}
console.log(`PASS ${cases} full Stage QA blank gestures: zero splats, solver/advection calls and UV changes; all four pigment controls flow`);

for(const layout of [box(27.25,-195.5,1453.4,620.2),box(21,79,974,680),box(13,112,364,840),box(-40,-320,800,700)]){
  const h=await setup(layout,2);h.reset(1);
  const initial=field.uv.slice();
  // A fixed screen point stays still as the artwork's idle zoom changes.
  const p=h.client(.65,.5);h.canvas.dispatch('pointerdown',p);
  for(let i=0;i<12;i++){h.stage.t+=3;h.stage.dirty=true;h.tick();h.canvas.dispatch('pointermove',p);h.tick();}
  h.canvas.dispatch('pointerup',p);inert(initial,'stationary pointer during idle zoom');
  // A scroll/layout displacement without a resize must break the stroke.
  h.canvas.dispatch('pointerdown',h.client(.65,.5));h.canvas.rect={...layout,top:layout.top-40,bottom:layout.bottom-40};
  h.canvas.dispatch('pointermove',h.client(.68,.52));h.canvas.dispatch('pointerup');h.tick();inert(initial,'scroll between pointer events');
  // Captured exterior points retain their raw position, never a clamped edge.
  h.canvas.dispatch('pointerdown',h.client(.65,.5));
  h.canvas.dispatch('pointermove',{clientX:h.canvas.rect.left-40,clientY:h.canvas.rect.top+200});
  assert.equal(h.stage.pointer.inside,false);assert.equal(h.effect.inspect().pointerInside,false);
  h.canvas.dispatch('pointermove',h.client(.68,.52));h.canvas.dispatch('pointerup');h.tick();inert(initial,'capture exit and reentry');
  // Resize invalidates the old frame; input waits for the next painted view.
  h.canvas.dispatch('pointerdown',h.client(.65,.5));h.stage.resize();
  h.canvas.dispatch('pointermove',h.client(.68,.52));h.canvas.dispatch('pointerup');h.tick();inert(initial,'resize before repaint');
  const over=h.client(.65,.5),overlay=new Element();overlay.rect=box(over.clientX-100,over.clientY-100,200,200);h.theater.append(overlay);
  h.gesture(over,h.client(.67,.51));inert(initial,'viewport overlay bounds');
  h.stage.dispose();
}
console.log('PASS scroll, CSS offsets/scaling, mobile crops, stationary zoom, resize, captured pointers and overlays through Stage');
