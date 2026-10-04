/** Node lifecycle/command checks. Native pixel acceptance lives in temporal_plates. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {create} from '../src/studies/temporal.mjs';
import {filmstrip} from '../src/studies/filmstrip.mjs';
const chapters=JSON.parse(readFileSync(new URL('../src/studies/catalog.json',import.meta.url),'utf8')).find(s=>s.id==='temporal').chapters;
let hash=0,commands=0;
function record(name,args){
  commands++;
  for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${name}: non-finite coordinate`);
  for(const char of name+args.map(v=>typeof v==='number'?v.toFixed(4):v?.src||String(v)).join(','))hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
}
const contexts=[];
function context(){
  let saves=0;
  const target={save(){saves++;record('save',[]);},restore(){assert.ok(saves-->0);record('restore',[]);},
    balanced(){assert.equal(saves,0);},getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)};},
    createLinearGradient(...a){record('linear',a);return {addColorStop(...a){record('stop',a);}};},
    createRadialGradient(...a){record('radial',a);return {addColorStop(...a){record('stop',a);}};}};
  const ctx=new Proxy(target,{get:(o,k)=>k in o?o[k]:(...a)=>record(k,a),set:(o,k,v)=>{record(k,[v]);o[k]=v;return true;}});
  contexts.push(ctx);return ctx;
}
const nodes=new Map();
class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.queries=new Map();this.attributes={};this.dataset={};this.events={};this.textContent='';this.style={setProperty(){}};this.classList={toggle(){}};this.width=1440;this.height=650;this.currentTime=0;this.readyState=0;}
  append(...items){for(const child of items){this.children.push(child);child.parentElement=this;if(child.className)nodes.set('.'+child.className,child);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  querySelector(key){if(!this.queries.has(key))this.queries.set(key,new Element(key));return this.queries.get(key);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k];}
  removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,fn){this.events[k]=fn;}
  add(item){this.append(item);}
  click(){this.events.click?.();}
  load(){} pause(){} play(){return Promise.resolve();}
  getBoundingClientRect(){return {left:0,top:0,right:160,bottom:96,width:160,height:96};}
  matches(){return false;}
  getContext(){return this.ctx??=context();}
}
const node=key=>{if(!nodes.has(key))nodes.set(key,new Element(key));return nodes.get(key);};
node('#temporal-chapters').textContent=JSON.stringify(chapters);
node('.hero-copy').querySelector('h1').append(new Element('span'),new Element('span'));
globalThis.document={body:new Element('body'),hidden:false,querySelector:node,createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};
document.body.dataset.study='temporal';
globalThis.Option=class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}};
globalThis.Image=class{constructor(){this.width=1672;this.height=941;}set src(value){this._src=value;queueMicrotask(()=>this.onload());}get src(){return this._src;}};
globalThis.ImageData=class{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);}};
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(readFileSync(new URL(url),'utf8'))});
const reduced={matches:false};globalThis.matchMedia=()=>reduced;
const stage={ctx:context(),canvas:new Element('canvas'),width:1440,height:650,t:0,frame:1,playing:false,pointer:{x:.5,y:.5},status(){}};
const controls=new Element(),effect=await create(stage,controls);filmstrip(stage,effect.scenes);
const strip=node('.study-footer').querySelector('.study-strip');
function draw(dt=0){if(stage.playing)stage.t+=dt;hash=0;commands=0;effect.render(stage.playing?dt:0);stage.onRendered();contexts.forEach(c=>c.balanced());assert.ok(commands>0);return hash;}
function synchronized(index){
  const c=chapters[index],s=effect.inspect();assert.equal(s.chapter,c.id);assert.equal(s.art,c.image);assert.equal(s.mode,c.mode);assert.equal(s.source,'art');
  assert.equal(node('.hero-copy').querySelector('h1').children.map(c=>c.textContent).join(''),c.headline.join(''));
  assert.equal(node('.hero-copy').querySelector('p').textContent,c.body);
  assert.equal(node('.temporal-folio').querySelector('h2').textContent,c.feature);
  assert.equal(node('.temporal-note').querySelector('small').textContent,c.annotation);
  assert.equal(strip.children[index].attributes['aria-current'],'true');
  assert.equal(strip.children.filter(c=>c.attributes['aria-current']).length,1);
}
for(const [w,h] of [[1440,650],[768,650],[390,1000],[320,900]]){
  stage.width=w;stage.height=h;
  for(let i=0;i<5;i++){
    strip.children[i].click();const paused=draw();synchronized(i);assert.equal(paused,draw(),'pause keeps drawing deterministic');
    stage.pointer.x=.8;const moved=draw();if([1,4].includes(i))assert.notEqual(moved,paused,'pointer changes content-specific geometry');stage.pointer.x=.5;
    stage.playing=true;assert.notEqual(paused,draw(.5),'playback changes drawing');stage.playing=false;
  }
}
effect.key('ArrowRight');draw();synchronized(0);effect.key('ArrowLeft');draw();synchronized(4);
const selectors=controls.children.filter(c=>c.tagName==='label').flatMap(c=>c.children).filter(c=>c.tagName==='select');
selectors[0].value='wave';selectors[0].events.change();draw();synchronized(1);
stage.playing=true;strip.children[4].click();draw(.4);assert.ok(effect.inspect().transition>0&&effect.inspect().transition<1);
strip.children[1].click();draw(2);synchronized(1);assert.equal(effect.inspect().transition,1);
const tour=controls.children.find(c=>c.tagName==='button');tour.click();draw(15);synchronized(2);assert.equal(effect.inspect().tour,true);
stage.playing=false;effect.reset();draw();synchronized(4);assert.equal(effect.inspect().depth,0);assert.equal(effect.inspect().tour,false);
assert.equal(effect.inspect().foldFrames,49);assert.equal(effect.inspect().foldTriangles,252);
reduced.matches=true;
for(let i=0;i<5;i++){strip.children[i].click();draw();synchronized(i);assert.equal(effect.inspect().transition,1);}
selectors[1].value='synthetic';selectors[1].events.change();stage.playing=true;
for(let i=0;i<70;i++)draw(1/24);
assert.equal(effect.inspect().count,64);assert.equal(effect.inspect().bytes,64*384*216*4);
strip.children[1].click();draw();synchronized(1);assert.equal(effect.inspect().count,0);
effect.dispose();console.log('Temporal runtime: 20 chapter/viewport combinations, real filmstrip callbacks, synchronized copy/art, deterministic pause, pointer, transitions, tour, reset, reduced motion and bounded media cache PASS');
