import {Stage} from './core.mjs';
const canvas=document.querySelector('#canvas'),status=document.querySelector('#status'),loading=document.querySelector('#loading');
const play=document.querySelector('#play'),reset=document.querySelector('#reset'),snapshot=document.querySelector('#snapshot');
const id=document.body.dataset.study;
const modules={portal:()=>import('./portal.mjs'),temporal:()=>import('./temporal.mjs'),fluid:()=>import('./fluid.mjs'),optical:()=>import('./optical.mjs'),shadow:()=>import('./shadow.mjs'),folding:()=>import('./folding.mjs')};
let stage,effect;
function sync(){play.textContent=stage.playing?'暂停':'播放';play.setAttribute('aria-pressed',String(stage.playing));}
try {
  if(!modules[id])throw new Error('未知实验');
  stage=new Stage(canvas,status);stage.onPlayingChange=sync;sync();
  play.addEventListener('click',()=>{stage.setPlaying(!stage.playing);sync();});
  reset.addEventListener('click',()=>{effect?.reset?.();stage.t=0;stage.dirty=true;});
  snapshot.addEventListener('click',()=>{try{canvas.toBlob(blob=>{if(!blob){stage.status('保存失败：没有可导出的画面');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${id}-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);},'image/png');}catch(e){stage.status('保存失败：'+e.message);}});
  effect=await (await modules[id]()).create(stage,document.querySelector('#controls'));stage.start(effect);loading.hidden=true;
  // Stable inspection hooks for tests; no executable input or remote controls.
  window.VisualStudy={id,pause:()=>{stage.setPlaying(false);sync();},play:()=>{stage.setPlaying(true);sync();},reset:()=>reset.click(),inspect:()=>({id,playing:stage.playing,frame:stage.frame,width:stage.width,height:stage.height,rafHz:Math.round(stage.rafHz),...effect.inspect?.()})};
  window.addEventListener('pagehide',()=>stage.dispose(),{once:true});
} catch(e) {
  stage?.dispose();loading.textContent='画面未能启动：'+e.message+'。请从仓库根目录启动静态服务器。';status.textContent='未启动';play.disabled=reset.disabled=snapshot.disabled=true;console.error(e);
}
