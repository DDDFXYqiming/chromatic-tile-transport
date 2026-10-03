import {Stage} from './core.mjs';
import {filmstrip} from './filmstrip.mjs';
const canvas=document.querySelector('#canvas'),status=document.querySelector('#status'),loading=document.querySelector('#loading');
const play=document.querySelector('#play'),reset=document.querySelector('#reset'),snapshot=document.querySelector('#snapshot');
const id=document.body.dataset.study;
const modules={portal:()=>import('./portal.mjs'),temporal:()=>import('./temporal.mjs'),fluid:()=>import('./fluid.mjs'),optical:()=>import('./optical.mjs'),shadow:()=>import('./shadow.mjs'),folding:()=>import('./folding.mjs')};
let stage,effect;
function sync(){document.querySelector('#play-label').textContent=stage.playing?'暂停巡航':'继续巡航';document.querySelector('.play-glyph').textContent=stage.playing?'Ⅱ':'▷';document.querySelector('#play-state').textContent=stage.playing?'影像运行中':'影像已暂停';play.setAttribute('aria-pressed',String(stage.playing));play.setAttribute('aria-label',stage.playing?'暂停巡航':'继续巡航');}
try {
  if(!modules[id])throw new Error('未知实验');
  stage=new Stage(canvas,status);stage.onPlayingChange=sync;sync();
  play.addEventListener('click',()=>{stage.setPlaying(!stage.playing);sync();});
  reset.addEventListener('click',()=>{effect?.reset?.();stage.t=0;stage.dirty=true;});
  snapshot.addEventListener('click',()=>{try{canvas.toBlob(blob=>{if(!blob){stage.status('保存失败：没有可导出的画面');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${id}-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);},'image/png');}catch(e){stage.status('保存失败：'+e.message);}});
  effect=await (await modules[id]()).create(stage,document.querySelector('#controls'));stage.start(effect);filmstrip(stage,effect.scenes);loading.hidden=true;
  const clean=document.querySelector('#clean'),about=document.querySelector('#about');
  clean.addEventListener('click',()=>{const on=document.body.classList.toggle('study-clean');clean.setAttribute('aria-pressed',String(on));});
  document.querySelector('#interact').addEventListener('click',()=>{if(effect.interact){effect.interact();return;}document.body.classList.add('study-clean');clean.setAttribute('aria-pressed','true');canvas.focus({preventScroll:true});});
  let resume=false;
  document.querySelector('#about-open').addEventListener('click',()=>{resume=stage.playing;stage.setPlaying(false);about.showModal();});
  document.querySelector('#about-close').addEventListener('click',()=>about.close());
  about.addEventListener('close',()=>stage.setPlaying(resume));
  window.addEventListener('keydown',e=>{if(e.defaultPrevented||about.open||e.target.closest('input,select,textarea,button,a,summary'))return;if(e.code==='Space'){e.preventDefault();play.click();}if(e.key.toLowerCase()==='h')clean.click();});
  // Stable inspection hooks for tests; no executable input or remote controls.
  window.VisualStudy={id,pause:()=>{stage.setPlaying(false);sync();},play:()=>{stage.setPlaying(true);sync();},reset:()=>reset.click(),inspect:()=>({id,playing:stage.playing,frame:stage.frame,width:stage.width,height:stage.height,rafHz:Math.round(stage.rafHz),...effect.inspect?.()})};
  window.addEventListener('pagehide',()=>stage.dispose(),{once:true});
} catch(e) {
  stage?.dispose();loading.textContent='画面未能启动：'+e.message+'。请从仓库根目录启动静态服务器。';status.textContent='未启动';play.disabled=reset.disabled=snapshot.disabled=true;console.error(e);
}
