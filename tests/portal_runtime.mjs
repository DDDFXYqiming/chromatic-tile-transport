/** Node lifecycle/command checks; rendering and layout acceptance belong to live QA. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {create} from '../src/studies/portal.mjs';
import {DOOR_ASSET} from '../src/studies/portal-door.mjs';

const chapters=JSON.parse(readFileSync(new URL('../src/studies/catalog.json',import.meta.url),'utf8')).find(c=>c.id==='portal').chapters;
const model=JSON.parse(readFileSync(DOOR_ASSET,'utf8'));
const commands=[],uniforms=new Map();let uploads=0,buffers=0,draws=0,deleted=0;
const gl=new Proxy({DEPTH_TEST:1,BLEND:2,
  createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({id:++buffers}),createTexture:()=>({id:++uploads}),
  getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(p,n)=>n,getAttribLocation:(p,n)=>n,
  uniform1f(n,v){assert.ok(Number.isFinite(v));uniforms.set(n,v);},
  uniform3fv(n,v){assert.ok(v.every(Number.isFinite));uniforms.set(n,v);},
  enable(mode){commands.push(['enable',mode]);},disable(mode){commands.push(['disable',mode]);},
  drawArrays(){draws++;commands.push(['draw',uniforms.get('hingeAngle')]);},
  deleteTexture(){deleted++;},getExtension:()=>({loseContext(){}}),
},{get:(o,k)=>k in o?o[k]:()=>{}});
class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.events={};this.style={setProperty(){}};this.dataset={};this.textContent='';this.selectors=new Map();}
  append(...items){this.children.push(...items);for(const c of items)c.parentElement=this;}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(k,fn){this.events[k]=fn;}
  querySelector(selector){if(!this.selectors.has(selector))this.selectors.set(selector,new Element(selector));return this.selectors.get(selector);}
  querySelectorAll(selector){if(selector==='em')return this.markers??=Array.from({length:3},()=>new Element('em'));return this.children.filter(c=>c.tagName===selector);}
  set innerHTML(v){this.html=v;}
}
const elements=new Map(),element=s=>{if(!elements.has(s))elements.set(s,new Element(s));return elements.get(s);};
element('#portal-chapters').textContent=JSON.stringify(chapters);
element('.hero-copy').querySelector('h1').append(new Element('span'),new Element('span'));
globalThis.document={body:new Element('body'),querySelector:element,createTextNode:text=>Object.assign(new Element('text'),{textContent:text}),
  createElement(tag){const el=new Element(tag);if(tag==='canvas')el.getContext=kind=>kind==='webgl'?gl:{drawImage(){}};return el;}};
globalThis.Image=class{constructor(){this.width=this.height=1024;}set src(v){this.url=v;queueMicrotask(()=>this.onload());}};
const reduced={matches:false};globalThis.matchMedia=()=>reduced;
globalThis.fetch=async url=>{assert.equal(String(url),String(DOOR_ASSET));return {ok:true,json:async()=>model};};
const stage={canvas:Object.assign(new Element('canvas'),{width:1440,height:600}),width:1440,height:600,
  pointer:{x:.5,y:.5},ctx:{drawImage(){}},playing:true,status(){},setPlaying(on){this.playing=on;}};
const controls=new Element(),effect=await create(stage,controls);
assert.equal(uploads,5,'four artworks and one shared bronze texture uploaded');
assert.ok(commands.some(([op,mode])=>op==='enable'&&mode===gl.DEPTH_TEST));
assert.ok(commands.some(([op,mode])=>op==='disable'&&mode===gl.BLEND));
assert.equal(effect.scenes.items.length,4);
for(const index of [1,2,3,0]){
  effect.scenes.items[index].apply();
  let turning=false,opening=false;
  for(let f=0;f<2400;f++){
    effect.render(1/60);
    const state=effect.inspect();
    turning ||= state.yaw>0;
    opening ||= state.doorLeaves.some(d=>d.angle>0&&d.angle<1.5);
    if(state.z===state.targetZ&&Math.abs(state.yaw-(index===0?Math.PI:0))<.01)break;
  }
  const state=effect.inspect();assert.equal(state.chapter,chapters[index].id);assert.equal(state.z,state.targetZ);
  assert.ok(opening);if(index===0)assert.ok(turning);
  const hero=element('.hero-copy');
  assert.equal(hero.querySelector('h1').children.map(c=>c.textContent).join(''),chapters[index].headline.join(''));
  assert.equal(hero.querySelector('p').textContent,chapters[index].body);
  assert.equal(document.body.dataset.chapter,chapters[index].id);
  assert.equal(element('.theater').dataset.travelling,'false');
  assert.ok(effect.scenes.items[index].active());
}
assert.ok(commands.some(([op,angle])=>op==='draw'&&angle>.2));
assert.ok(commands.some(([op,angle])=>op==='draw'&&angle<-.2));
effect.reset();effect.scenes.items[1].apply();effect.render(1.6);
const frozen=effect.inspect();effect.render(0);
assert.equal(effect.inspect().z,frozen.z);assert.deepEqual(effect.inspect().doorLeaves,frozen.doorLeaves);
reduced.matches=true;effect.scenes.items[3].apply();effect.render(0);
assert.equal(effect.inspect().chapter,chapters[3].id);
effect.reset();effect.render(0);assert.equal(effect.inspect().chapter,chapters[0].id);
effect.dispose();assert.equal(deleted,5);
console.log(`Portal runtime PASS: ${draws} opaque draw commands; 4 chapter selections, two hinge directions, copy, pause, reset, reduced motion and shared texture lifecycle.`);
