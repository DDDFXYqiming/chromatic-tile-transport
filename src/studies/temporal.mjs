import {clamp,mix} from './math.mjs';
import {asset,offscreen,range,select,fileInput,caption,sky,coverFit,sourcePointer} from './core.mjs';
export async function create(stage,controls) {
  const W=384,H=216,CAP=64,source=offscreen(W,H),sctx=source.getContext('2d',{willReadFrequently:true});
  const result=offscreen(W,H),rctx=result.getContext('2d'),out=new ImageData(W,H);
  const video=document.createElement('video');Object.assign(video,{muted:true,loop:true,playsInline:true,preload:'auto'});
  const timestamps=new Float64Array(CAP),ageTable=new Float32Array(257);let clock=0;
  let buffers=[],head=0,count=0,lastTime=-1,synthetic=false,depth=1.8,mode='radial',sourceLabel='绯刃交锋 · 交锋镜头',objectURL=null,disposed=false,notice='';
  const field=select(controls,'时间形状',[['radial','圆形时间波'],['wave','弯曲时间带'],['ribbon','水平时间流']],v=>{mode=v;stage.dirty=true;});
  range(controls,'历史深度（秒）',0,2.6,1.8,.1,v=>{depth=v;stage.dirty=true;});
  const sourcePicker=select(controls,'运动源',[['video','仓库战斗视频'],['synthetic','程序运动 · 星轨摆钟']],async v=>{synthetic=v==='synthetic';reset();if(synthetic){video.pause();sourceLabel='程序运动 · 星轨摆钟';}else{sourceLabel='绯刃交锋 · 交锋镜头';setVideo(asset('matrix-battle/03-clash.mp4'));}stage.dirty=true;});
  function reset(){buffers=[];timestamps.fill(0);clock=0;head=count=0;lastTime=-1;stage.dirty=true;}
  function play(){if(!synthetic&&stage.playing&&!document.hidden&&!disposed)video.play().catch(()=>{notice='视频等待播放许可，请点击播放';stage.dirty=true;});}
  function setVideo(url){reset();video.src=url;video.load();play();}
  video.addEventListener('loadeddata',()=>{notice='';lastTime=-1;stage.dirty=true;});
  video.addEventListener('error',()=>{if(disposed)return;synthetic=true;sourcePicker.value='synthetic';sourceLabel='程序运动 · 星轨摆钟';notice='仓库视频读取失败，已切换到程序动画';reset();});
  fileInput(controls,'导入本地视频','video/mp4,video/webm',100,async file=>{if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(file);synthetic=false;sourcePicker.value='video';sourceLabel=file.name;notice='';setVideo(objectURL);});
  setVideo(asset('matrix-battle/03-clash.mp4'));
  function drawSynthetic(t){
    sky(sctx,W,H,'#172d3b','#091a25');
    const g=sctx.createRadialGradient(192,110,8,192,110,125);g.addColorStop(0,'#dabc7345');g.addColorStop(1,'#dabc7300');sctx.fillStyle=g;sctx.fillRect(0,0,W,H);
    sctx.strokeStyle='#aebcaa48';sctx.lineWidth=1;
    for(let i=0;i<3;i++){sctx.beginPath();sctx.ellipse(W/2,H/2,61+i*34,26+i*19,-.42,0,Math.PI*2);sctx.stroke();}
    for(let i=0;i<3;i++){
      const a=t*(.9+i*.23)+i*2.1,x=W/2+Math.cos(a)*(65+i*30),y=H/2+Math.sin(a)*(28+i*18);
      sctx.fillStyle=['#f1d09b','#94bfc0','#d18b72'][i];sctx.beginPath();sctx.arc(x,y,11-i*2,0,Math.PI*2);sctx.fill();
    }
    sctx.strokeStyle='#bfd0c3';sctx.beginPath();sctx.moveTo(W/2,20);const a=Math.sin(t*2)*.9;sctx.lineTo(W/2+Math.sin(a)*112,20+Math.cos(a)*112);sctx.stroke();
    sctx.fillStyle='#edce94';sctx.beginPath();sctx.arc(W/2+Math.sin(a)*112,20+Math.cos(a)*112,13,0,Math.PI*2);sctx.fill();
  }
  function capture(){
    const t=synthetic?stage.t:video.currentTime;if(!synthetic&&video.readyState<2)return;
    if(lastTime>=0&&Math.floor(t*24)===Math.floor(lastTime*24))return;
    if(lastTime>=0){let delta=t-lastTime;if(delta<0)delta=!synthetic&&Number.isFinite(video.duration)?video.duration-lastTime+t:1/24;clock+=Math.max(0,delta);}
    if(synthetic)drawSynthetic(t);else{const sc=Math.max(W/video.videoWidth,H/video.videoHeight),w=video.videoWidth*sc,h=video.videoHeight*sc;sctx.drawImage(video,(W-w)/2,(H-h)/2,w,h);}
    buffers[head]=sctx.getImageData(0,0,W,H).data;timestamps[head]=clock;head=(head+1)%CAP;count=Math.min(count+1,CAP);lastTime=t;
  }
  return {reset,visibility(on){if(on)play();else video.pause();},
    render(){capture();const {ctx,width:w,height:h,pointer:pointer}=stage;const p=sourcePointer(pointer,W,H,w,h),fit=coverFit(W,H,w,h);
      if(!count){drawSynthetic(0);ctx.drawImage(source,fit.x,fit.y,fit.width,fit.height);stage.status(notice||'正在读取本地视频首帧…');return;}
      const at=age=>(head-1-age+CAP*2)%CAP;
      const newest=timestamps[at(0)],oldest=timestamps[at(count-1)],seconds=Math.min(depth,newest-oldest),aspect=W/H;
      let j=0;
      for(let i=0;i<=256;i++){
        const wanted=newest-seconds*i/256;
        while(j<count-2&&timestamps[at(j+1)]>wanted)j++;
        const newer=timestamps[at(j)],older=timestamps[at(Math.min(j+1,count-1))];
        ageTable[i]=Math.min(count-1,j+clamp((newer-wanted)/(newer-older||1)));
      }
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const nx=x/W,ny=y/H,dx=nx-p.x,dy=ny-p.y;
        const v=mode==='radial'?clamp(Math.hypot(dx*aspect,dy)*1.7):mode==='wave'?clamp((dx+Math.sin(ny*8+p.y*4)*.13)*1.6+.5):clamp((ny-p.y)*1.3+.5);
        const ti=v*256,lo=Math.floor(ti),age=mix(ageTable[lo],ageTable[Math.min(256,lo+1)],ti-lo),a=Math.floor(age),f=age-a,A=buffers[(head-1-a+CAP*2)%CAP],B=buffers[(head-1-Math.min(a+1,count-1)+CAP*2)%CAP],k=(y*W+x)*4;
        out.data[k]=mix(A[k],B[k],f);out.data[k+1]=mix(A[k+1],B[k+1],f);out.data[k+2]=mix(A[k+2],B[k+2],f);out.data[k+3]=255;
      }
      rctx.putImageData(out,0,0);ctx.drawImage(result,fit.x,fit.y,fit.width,fit.height);
      ctx.strokeStyle='#eee3be65';ctx.lineWidth=1;ctx.beginPath();ctx.arc(pointer.x*w,pointer.y*h,12,0,Math.PI*2);ctx.stroke();
      caption(ctx,'NOW  →  PAST  /  每个位置取不同历史帧',22,h-22,'#f0e7cd');
      stage.status(`${sourceLabel} · ${count}/${CAP} 帧 · ${Math.round(CAP*W*H*4/1048576)} MiB 缓存上限${notice?' · '+notice:''}`);
    },inspect:()=>({count,capacity:CAP,bytes:CAP*W*H*4,source:synthetic?'synthetic':'video',historySeconds:count?clock-timestamps[(head-count+CAP)%CAP]:0,mode,depth,readyState:video.readyState}),
    dispose(){disposed=true;video.pause();video.removeAttribute('src');video.load();if(objectURL)URL.revokeObjectURL(objectURL);buffers=[];}};
}
