import {clamp} from './math.mjs';
export const ASSETS = new URL('../../assets/',import.meta.url);
export const asset = name => new URL(name,ASSETS).href;
export async function image(url) {
  const img=new Image();img.decoding='async';
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('图片无法读取'));img.src=url;});
  return img;
}
export function offscreen(w,h) { const c=document.createElement('canvas');c.width=w;c.height=h;return c; }
export function sampleImage(img,w,h) {
  const c=offscreen(w,h),ctx=c.getContext('2d',{willReadFrequently:true});
  const s=Math.max(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;
  ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);return ctx.getImageData(0,0,w,h);
}
export function bilinear(data,w,h,x,y,ch=0,stride=4) {
  x=clamp(x,0,w-1);y=clamp(y,0,h-1);
  const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;
  const i=(b*w+a)*stride+ch,j=(b*w+Math.min(w-1,a+1))*stride+ch;
  const k=(Math.min(h-1,b+1)*w+a)*stride+ch,l=(Math.min(h-1,b+1)*w+Math.min(w-1,a+1))*stride+ch;
  return (data[i]*(1-u)+data[j]*u)*(1-v)+(data[k]*(1-u)+data[l]*u)*v;
}
export function range(parent,label,min,max,value,step,onChange) {
  const wrap=document.createElement('label'), text=document.createElement('span'), out=document.createElement('output'), input=document.createElement('input');
  text.textContent=label;input.type='range';Object.assign(input,{min,max,step,value});
  input.setAttribute('aria-label',label);out.value=String(value);
  input.addEventListener('input',()=>{out.value=input.value;onChange(Number(input.value));});
  wrap.append(text,input,out);parent.append(wrap);return input;
}
export function select(parent,label,items,onChange) {
  const wrap=document.createElement('label'),span=document.createElement('span'),input=document.createElement('select');span.textContent=label;
  input.setAttribute('aria-label',label);items.forEach(([v,t])=>input.add(new Option(t,v)));
  input.addEventListener('change',()=>onChange(input.value));wrap.append(span,input);parent.append(wrap);return input;
}
export function button(parent,label,onClick) { const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',onClick);parent.append(b);return b; }
export function fileInput(parent,label,accept,limitMB,onFile) {
  const wrap=document.createElement('label');wrap.className='file-button';wrap.textContent=label;
  const f=document.createElement('input');f.type='file';f.accept=accept;
  f.addEventListener('change',async()=>{const file=f.files?.[0];if(!file)return;try{if(file.size>limitMB*1024*1024)throw new Error(`文件不能超过 ${limitMB} MB`);await onFile(file);}catch(e){document.querySelector('#status').textContent=e.message;}finally{f.value='';}});
  wrap.append(f);parent.append(wrap);return f;
}
export class Stage {
  constructor(canvas,status) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.statusElement=status;
    this.pointer={x:.5,y:.5,down:false,dx:0,dy:0};this.keys=new Set();this.playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.width=0;this.height=0;this.t=0;this.frame=0;this.dirty=true;this.rafHz=0;this.last=0;
    this.abort=new AbortController();const options={signal:this.abort.signal};
    this.resize=()=>{const r=canvas.getBoundingClientRect();this.width=Math.max(1,Math.round(r.width));this.height=Math.max(1,Math.round(r.height));this.dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(this.width*this.dpr);canvas.height=Math.round(this.height*this.dpr);this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.dirty=true;this.effect?.resize?.();};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);
    const move=e=>{const r=canvas.getBoundingClientRect(),x=clamp((e.clientX-r.left)/r.width),y=clamp((e.clientY-r.top)/r.height);this.pointer.dx=x-this.pointer.x;this.pointer.dy=y-this.pointer.y;this.pointer.x=x;this.pointer.y=y;this.effect?.pointer?.(this.pointer,e);this.dirty=true;};
    canvas.addEventListener('pointerdown',e=>{this.pointer.down=true;canvas.setPointerCapture(e.pointerId);move(e);canvas.focus({preventScroll:true});},options);
    canvas.addEventListener('pointermove',move,options);
    const release=()=>{this.pointer.down=false;this.pointer.dx=0;this.pointer.dy=0;this.effect?.release?.();};
    canvas.addEventListener('pointerup',release,options);canvas.addEventListener('pointercancel',release,options);canvas.addEventListener('lostpointercapture',release,options);
    window.addEventListener('blur',()=>{this.keys.clear();release();},options);
    canvas.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')){e.preventDefault();this.keys.add(e.key);this.effect?.key?.(e.key);this.dirty=true;}if(e.code==='Space'){e.preventDefault();document.querySelector('#play').click();}if(e.key.toLowerCase()==='r')document.querySelector('#reset').click();},options);
    window.addEventListener('keyup',e=>this.keys.delete(e.key),options);
    document.addEventListener('visibilitychange',()=>{this.last=0;this.effect?.visibility?.(!document.hidden&&this.playing);},options);
    this.resize();
  }
  status(text){this.statusElement.textContent=text;}
  setPlaying(on){this.playing=on;this.last=0;this.effect?.visibility?.(on&&!document.hidden);this.dirty=true;this.onPlayingChange?.();}
  start(effect) {
    this.effect=effect;this.resize();this.effect.visibility?.(this.playing&&!document.hidden);
    const loop=now=>{this.raf=requestAnimationFrame(loop);if(document.hidden){this.last=0;return;}
      const elapsed=this.last?Math.min((now-this.last)/1000,.05):0;this.last=now;
      if(elapsed)this.rafHz=this.rafHz*.94+(1/elapsed)*.06;
      const dt=this.playing?elapsed:0;if(this.playing)this.t+=dt;
      if((this.playing&&!effect.static)||this.dirty){try{effect.render(dt);this.frame++;this.onRendered?.();for(const el of document.querySelectorAll('.controls input[type="range"]')){const out=el.parentElement.querySelector('output');if(out)out.value=el.value;}}catch(e){this.status('运行失败：'+e.message);console.error(e);this.setPlaying(false);}this.dirty=false;}
    };this.raf=requestAnimationFrame(loop);
  }
  dispose(){cancelAnimationFrame(this.raf);this.abort.abort();this.observer.disconnect();this.effect?.dispose?.();}
}
export function sky(ctx,w,h,top='#0c2733',bottom='#091319') {const g=ctx.createLinearGradient(0,0,w*.25,h);g.addColorStop(0,top);g.addColorStop(1,bottom);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
export function caption(ctx,text,x,y,color='#b6cfcc',size=11) {ctx.fillStyle=color;ctx.font=`${size}px ui-monospace,Consolas,monospace`;ctx.fillText(text,x,y);}

export function coverFit(sw,sh,w,h){const scale=Math.max(w/sw,h/sh);return {scale,x:(w-sw*scale)/2,y:(h-sh*scale)/2,width:sw*scale,height:sh*scale};}
export function sourcePointer(p,sw,sh,w,h){const f=coverFit(sw,sh,w,h);return {x:clamp((p.x*w-f.x)/f.width),y:clamp((p.y*h-f.y)/f.height)};}
