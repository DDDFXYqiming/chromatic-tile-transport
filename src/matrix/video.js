/* Native video decoding + PixiJS VideoSource/Sprite, before the existing Matrix shader. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // A starts during the preceding bridge. B keeps that same time when it becomes A.
  function clipTime(frame,config,duration,incoming=false){
    if(frame.reduced||config.videoMotion===false)return 0;
    const logical=incoming?frame.bridge*config.bridgeSeconds:frame.local+config.bridgeSeconds;
    return clamp(logical/(config.shotSeconds+config.bridgeSeconds),0,1)*Math.max(0,duration-1/24);
  }
  function quantize(time,duration,fps=24){return Math.min(Math.floor((time+1e-7)*fps)/fps+.25/fps,duration-.5/fps);}
  class Clip{
    constructor(spec,poster,notify){this.spec=spec;this.poster=poster;this.notify=notify;this.pending=false;this.failed=false;this.error=null;this.decodedFrames=0;this.closed=false;}
    async init(usePixi){
      const v=this.video=document.createElement('video');v.muted=true;v.defaultMuted=true;v.playsInline=true;v.preload='auto';v.loop=false;v.crossOrigin='anonymous';
      try{
        await new Promise((resolve,reject)=>{
          const cleanup=()=>{clearTimeout(timer);v.removeEventListener('loadeddata',ready);v.removeEventListener('error',error);};
          const ready=()=>{cleanup();resolve();},error=()=>{cleanup();reject(new Error('视频无法解码或加载'));};
          const timer=setTimeout(()=>{cleanup();reject(new Error('视频加载超时'));},20000);
          v.addEventListener('loadeddata',ready);v.addEventListener('error',error);v.src=this.spec.src;v.load();
        });
        if(!Number.isFinite(v.duration)||v.duration<=0)throw new Error('视频时长无效');
        this.duration=v.duration;
        if(usePixi){
          this.source=new root.PIXI.VideoSource({resource:v,autoLoad:false,autoPlay:false,updateFPS:24});
          this.source.autoUpdate=false;await this.source.load();this.texture=new root.PIXI.Texture({source:this.source});
        }
        this.onError=()=>this.fail('视频读取中断，已显示静态封面');v.addEventListener('error',this.onError);
        if(v.requestVideoFrameCallback){
          const decoded=(_,meta)=>{if(this.closed)return;this.decodedFrames++;this.mediaTime=meta.mediaTime;this.notify();this.callback=v.requestVideoFrameCallback(decoded);};
          this.callback=v.requestVideoFrameCallback(decoded);
        }
      }catch(e){this.fail(e.message||'视频不可用');}
      if(usePixi)this.posterTexture=root.PIXI.Texture.from(this.poster,true);
      return this;
    }
    fail(message){if(this.closed)return;this.failed=true;this.error=message;this.pending=false;this.video?.pause();this.notify();}
    sync(time,play,rate){
      if(this.closed||this.failed)return;
      const v=this.video;this.wantTime=quantize(time,this.duration,this.spec.fps||24);this.wantPlay=play;this.rate=rate;
      if(!play)v.pause();
      if(this.pending)return;
      const tolerance=play?.18:.002;
      if(Math.abs(v.currentTime-this.wantTime)>tolerance){this.seek(this.wantTime);return;}
      v.playbackRate=rate;
      if(play&&v.paused&&!this.playBlocked){
        const promise=v.play();promise?.then(()=>{this.error=null;},()=>{this.playBlocked=true;this.error='浏览器暂未允许播放，请点击播放按钮';this.notify();});
      }
    }
    seek(time){
      const v=this.video;v.pause();this.pending=true;this.seekGoal=time;
      const cleanup=()=>{clearTimeout(this.seekTimer);v.removeEventListener('seeked',complete);this.seekCleanup=null;};
      const complete=()=>{cleanup();setTimeout(()=>{
        if(this.closed)return;this.pending=false;this.source?.update();
        this.seekMisses=Math.abs(v.currentTime-this.seekGoal)>.004?(this.seekMisses||0)+1:0;
        if(this.seekMisses>=3){this.fail('服务器无法定位视频帧，请使用支持 Range 的本地服务');return;}
        // Coalesce rapid scrubs and display the newest requested frame.
        this.sync(this.wantTime,this.wantPlay,this.rate);this.notify();
      },0);};
      this.seekCleanup=cleanup;v.addEventListener('seeked',complete,{once:true});
      this.seekTimer=setTimeout(()=>{cleanup();this.fail('视频定位超时，已显示静态封面');},8000);
      v.currentTime=time;
    }
    state(){const v=this.video;return {ready:!this.failed&&v?.readyState>=2,failed:this.failed,error:this.error,seeking:this.pending||!!v?.seeking,paused:v?.paused??true,currentTime:v?.currentTime||0,targetTime:this.wantTime??0,seekableEnd:v?.seekable.length?v.seekable.end(v.seekable.length-1):0,duration:this.duration||0,decodedFrames:this.decodedFrames,source:this.source?'PixiJS VideoSource':'HTMLVideoElement'};}
    dispose(){
      this.closed=true;this.seekCleanup?.();clearTimeout(this.seekTimer);
      if(this.callback)this.video.cancelVideoFrameCallback?.(this.callback);
      this.video?.removeEventListener('error',this.onError);this.video?.pause();
      this.texture?.destroy(true);this.posterTexture?.destroy(true);
      if(this.video&&!this.source){this.video.removeAttribute('src');this.video.load();}
    }
  }
  class Surface{
    async init(){
      this.canvas=document.createElement('canvas');this.app=new root.PIXI.Application();
      await this.app.init({canvas:this.canvas,width:1,height:1,background:0xf2f6f2,autoStart:false,sharedTicker:false,preference:['webgl'],preserveDrawingBuffer:true,eventMode:'none'});
      this.app.stop();this.sprite=new root.PIXI.Sprite({anchor:.5});this.sprite.eventMode='none';this.app.stage.addChild(this.sprite);return this;
    }
    resize(w,h){this.app.renderer.resize(w,h);}
    draw(clip,focus){
      const node=this.sprite;node.texture=clip.failed?clip.posterTexture:clip.texture;
      if(!node.texture)return;
      clip.source?.update();const w=this.canvas.width,h=this.canvas.height,iw=node.texture.width,ih=node.texture.height,scale=Math.max(w/iw,h/ih);
      node.scale.set(scale);node.position.set(w/2-clamp((focus[0]-.5)*iw*scale,-(iw*scale-w)/2,(iw*scale-w)/2),h/2-clamp((focus[1]-.5)*ih*scale,-(ih*scale-h)/2,(ih*scale-h)/2));
      this.app.render();
    }
    dispose(last){if(this.app?.renderer)this.app.destroy({removeView:false,releaseGlobalResources:last},{children:true});else this.app?.stage.destroy({children:true});}
  }
  class Compositor{
    constructor(specs,posters,scenes,invalidate){this.kind='video';this.specs=specs;this.posters=posters;this.scenes=scenes;this.invalidate=invalidate;this.clips=[];this.surfaces=[];this.frames=0;this.waiters=[];this.playing=false;this.closed=false;}
    notify(){if(this.closed)return;this.waiters.splice(0).forEach(r=>r());this.invalidate();}
    async init(usePixi=true){
      if(usePixi)try{for(let i=0;i<2;i++){const s=new Surface();this.surfaces.push(s);await s.init();}}
      catch(e){this.warning='视频合成改用 Canvas 兼容路径：'+e.message;this.surfaces.forEach((s,i)=>s.dispose(i===1));this.surfaces=[];}
      this.buffers=this.surfaces.length?this.surfaces.map(s=>s.canvas):[document.createElement('canvas'),document.createElement('canvas')];
      this.clips=await Promise.all(this.scenes.map((scene,i)=>new Clip(this.specs[scene.slug],this.posters[i],()=>this.notify()).init(!!this.surfaces.length)));
      return this;
    }
    resize(w,h){const scale=Math.min(1,Math.sqrt(1200000/(w*h)));this.width=Math.max(1,Math.round(w*scale));this.height=Math.max(1,Math.round(h*scale));
      if(this.surfaces.length)this.surfaces.forEach(s=>s.resize(this.width,this.height));else this.buffers.forEach(c=>{c.width=this.width;c.height=this.height;});}
    setPlayback(play){if(play&&!this.playing)this.clips.forEach(c=>c.playBlocked=false);this.playing=play;if(!play)this.clips.forEach(c=>c.video?.pause());}
    render(frame,config){
      const active=new Set([frame.scene]);if(frame.bridge>0)active.add(frame.next);
      this.clips.forEach((clip,i)=>{
        const incoming=i===frame.next,time=active.has(i)?clipTime(frame,config,clip.duration||5,incoming):0;
        clip.sync(time,this.playing&&!frame.reduced&&config.videoMotion!==false&&active.has(i),(Math.max(.1,(clip.duration||5)-1/24))/(config.shotSeconds+config.bridgeSeconds));
      });
      const draw=(buffer,index)=>{
        const clip=this.clips[index],focus=this.specs[this.scenes[index].slug].focus||[.5,.5];
        if(this.surfaces.length)this.surfaces[buffer].draw(clip,focus);
        else{
          const c=this.buffers[buffer],ctx=c.getContext('2d',{alpha:false}),input=clip.failed?clip.poster:clip.video;
          const iw=input.videoWidth||input.naturalWidth,ih=input.videoHeight||input.naturalHeight,scale=Math.max(c.width/iw,c.height/ih);
          const x=clamp(focus[0]*iw-c.width/scale/2,0,iw-c.width/scale),y=clamp(focus[1]*ih-c.height/scale/2,0,ih-c.height/scale);
          ctx.drawImage(input,x,y,c.width/scale,c.height/scale,0,0,c.width,c.height);
        }
      };
      draw(0,frame.scene);if(frame.bridge>0)draw(1,frame.next);this.frames++;return {a:this.buffers[0],b:this.buffers[1]};
    }
    async settled(){while(this.clips.some(c=>c.pending))await new Promise(resolve=>this.waiters.push(resolve));}
    getState(){return {kind:'video',frames:this.frames,seeking:this.clips.some(c=>c.pending),backend:this.surfaces.length?'PixiJS WebGL':'Canvas 2D',warning:this.warning||null,clips:this.clips.map((c,i)=>({slug:this.scenes[i].slug,...c.state()}))};}
    dispose(){this.closed=true;this.clips.forEach(c=>c.dispose());this.surfaces.forEach((s,i)=>s.dispose(i===this.surfaces.length-1));this.waiters.splice(0).forEach(r=>r());}
  }
  const api={clipTime,quantize,Compositor};if(typeof module==='object'&&module.exports)module.exports=api;else root.MatrixVideos=Object.freeze(api);
})(globalThis);
