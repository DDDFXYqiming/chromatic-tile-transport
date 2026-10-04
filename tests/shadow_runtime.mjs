/** Node-only lifecycle and drawing-command checks; no raster/layout assertions. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {create} from '../src/studies/shadow.mjs';
const chapters=JSON.parse(readFileSync(new URL('../src/studies/catalog.json',import.meta.url),'utf8')).find(c=>c.id==='shadow').chapters;
let hash=0,commands=0,canvasId=0;
function record(name,args){
  commands++;
  for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${name} received ${value}`);
  const text=name+args.map(v=>typeof v==='number'?v.toFixed(5):v?.canvasId??String(v)).join(',');
  for(const char of text)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
}
function context(){
  let depth=0;
  const methods={save(){depth++;record('save',[]);},restore(){assert.ok(depth-->0,'unbalanced canvas restore');record('restore',[]);},
    createLinearGradient(...a){record('linear',a);return {addColorStop(...a){record('stop',a);}};},
    createRadialGradient(...a){record('radial',a);return {addColorStop(...a){record('stop',a);}};},
    createPattern(){return 'grain';},balanced(){assert.equal(depth,0);}};
  return new Proxy(methods,{get:(o,k)=>k in o?o[k]:(...a)=>record(k,a),set:(o,k,v)=>{record(k,[v]);o[k]=v;return true;}});
}
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.events={};this.style={setProperty(){}};this.dataset={};this.textContent='';}
  append(...items){this.children.push(...items);items.forEach(c=>c.parentElement=this);}
  after(){}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(k,fn){this.events[k]=fn;}
  focus(){}
  querySelector(selector){return this.querySelectorAll(selector)[0];}
  querySelectorAll(selector){return this.children.filter(c=>c.tagName===selector);}
  set innerHTML(value){this.children=[];for(const m of value.matchAll(/<(small|span|p|h3|b)(?:>| )/g))this.append(new Element(m[1]));}
}
const elements=new Map();
function element(selector){if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);}
const hero=element('.hero-copy'),heading=new Element('h1');heading.append(new Element('span'),new Element('span'));
const eyebrow=new Element('.eyebrow');hero.append(heading,eyebrow,new Element('p'));
element('#shadow-chapters').textContent=JSON.stringify(chapters);
const body=new Element('body');
globalThis.document={body,querySelector:element,createElement(tag){const el=new Element(tag);if(tag==='canvas'){el.canvasId=++canvasId;const ctx=context();el.getContext=()=>ctx;}return el;}};
const reduced={matches:false,addEventListener(k,fn){this.listener=fn;},removeEventListener(){this.listener=null;}};
globalThis.matchMedia=()=>reduced;
const ctx=context(),stage={ctx,canvas:new Element('canvas'),width:1536,height:695,playing:true,status(){},setPlaying(on){this.playing=on;}},controls=new Element();
const effect=await create(stage,controls);
function draw(dt=0){hash=0;commands=0;effect.render(dt);ctx.balanced();assert.ok(commands>200);return hash;}
for(const [w,h] of [[1536,695],[1920,1080],[768,1024],[390,844],[320,568]]){
  stage.width=w;stage.height=h;
  for(const scene of effect.scenes.items){
    scene.apply();const first=draw(),state=effect.inspect();
    assert.equal(state.chapter,scene.id);assert.equal(state.renderedChapter,scene.id);
    assert.equal(state.projectedFaces,state.sculptureFaces*3);assert.equal(state.shadowDirections,3);
    assert.equal(heading.children.map(c=>c.textContent).join(''),scene.headline.join(''));
    assert.equal(hero.querySelector('p').textContent,scene.body);
    assert.equal(first,draw(),'paused scene must render identical drawing commands');
    assert.notEqual(first,draw(.5),'playing scene must change the actual draw commands');
  }
}
effect.scenes.items[0].apply();draw();
const angle=effect.inspect().angle;effect.key('ArrowRight');draw();assert.equal(effect.inspect().angle,angle+.08);
effect.pointer({down:true,dx:0,dy:0});effect.pointer({down:true,dx:.1,dy:.4});draw();assert.equal(effect.inspect().view,.4);
const dragged=draw();assert.equal(dragged,draw(.5),'dragging holds the automatic motion');effect.release();assert.notEqual(dragged,draw(.5));
const ranges=controls.children.filter(c=>c.tagName==='label').map(c=>c.querySelector('input'));
ranges[0].value='85';ranges[0].events.input();draw();assert.ok(Math.abs(effect.inspect().angle-85*Math.PI/180)<1e-12);
ranges[2].value='.4';ranges[2].events.input();draw();assert.equal(effect.inspect().strength,.4);
effect.reset();draw();assert.equal(effect.inspect().view,0);assert.equal(effect.inspect().strength,.9);assert.equal(ranges[2].value,'.9');
const auto=controls.children.find(c=>c.tagName==='button');auto.events.click();const chapter=effect.inspect().chapter;draw(23);assert.equal(effect.inspect().chapter,chapter);
auto.events.click();draw(23);assert.notEqual(effect.inspect().chapter,chapter);
reduced.matches=true;reduced.listener();assert.equal(stage.playing,false);const still=draw();assert.equal(still,draw(1));
effect.dispose();assert.equal(reduced.listener,null);
console.log('Shadow runtime: 20 chapter/viewport combinations, draw determinism, motion, controls, reset, chapter clock and reduced motion PASS');
