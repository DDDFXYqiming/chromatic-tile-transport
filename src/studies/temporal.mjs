import {clamp,mix} from './math.mjs';
import {asset,image,offscreen,range,select,fileInput,button,sky,coverFit,sourcePointer} from './core.mjs';

export async function create(stage,controls) {
  const chapters=JSON.parse(document.querySelector('#temporal-chapters').textContent);
  const art=await Promise.all(chapters.map(chapter=>image(asset(chapter.image))));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const theater=document.querySelector('.theater'),hero=document.querySelector('.hero-copy');
  const hint=document.querySelector('.hint'),help=hint.textContent;
  const W=384,H=216,CAP=64,source=offscreen(W,H),sctx=source.getContext('2d',{willReadFrequently:true});
  const result=offscreen(W,H),rctx=result.getContext('2d'),out=new ImageData(W,H);
  const before=offscreen(1,1),beforeContext=before.getContext('2d');
  const video=document.createElement('video');Object.assign(video,{muted:true,loop:true,playsInline:true,preload:'auto'});
  const timestamps=new Float64Array(CAP),ageTable=new Float32Array(257);
  let buffers=[],head=0,count=0,lastTime=-1,clock=0;
  let chapterIndex=0,mode='radial',depth=1.8,sourceKind='art',objectURL=null,disposed=false,notice='';
  let sourceLabel='绯刃交锋 · 交锋镜头',transition=1,chapterTime=0,tour=false;
  const transitionSeconds=1.6,holdSeconds=14;

  const edition=document.createElement('div');edition.className='temporal-edition';
  edition.innerHTML='<span>留刻 <b>AFTERLIGHT</b></span><small>关于时间的影像手记 / VOL. 01</small>';theater.append(edition);
  const folio=document.createElement('aside');folio.className='temporal-folio';folio.setAttribute('aria-label','本章产品札记');
  folio.innerHTML='<div class="temporal-folio-top"><span></span><b></b></div><h2></h2><p></p><div class="temporal-exposures" aria-hidden="true"><i></i><i></i><i></i></div><div class="temporal-tags"></div>';theater.append(folio);
  const note=document.createElement('div');note.className='temporal-note';
  note.innerHTML='<span>NOTES ON PASSING TIME</span><p></p><small></small>';theater.append(note);
  const stamp=document.createElement('div');stamp.className='temporal-stamp';stamp.setAttribute('aria-hidden','true');
  stamp.innerHTML='<span></span><b></b><small></small>';theater.append(stamp);
  hero.setAttribute('aria-live','polite');hero.setAttribute('aria-atomic','true');

  const field=select(controls,'时间形状',[
    ['radial','圆形 · 余光采样'],['wave','矩形 · 街角切片'],['ribbon','水平 · 流动备忘'],['echo','叠层 · 记忆比较'],['clear','归零 · 重返此刻'],
  ],v=>choose(chapters.findIndex(c=>c.mode===v)));
  const depthControl=range(controls,'历史深度（秒）',0,2.6,depth,.1,v=>{depth=v;stage.dirty=true;});
  const sourcePicker=select(controls,'运动源',[
    ['art','章节插画'],['video','示例视频 · 绯刃交锋'],['synthetic','程序运动 · 星轨摆钟'],
  ],v=>setSource(v));
  fileInput(controls,'导入本地视频','video/mp4,video/webm',100,async file=>{
    video.pause();video.removeAttribute('src');video.load();
    if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(file);
    sourceLabel=file.name;video.src=objectURL;video.load();setSource('video');
  });
  const tourButton=button(controls,'连读五章',()=>{tour=!tour;chapterTime=0;stage.dirty=true;});

  function resetCache(){buffers=[];timestamps.fill(0);clock=0;head=count=0;lastTime=-1;}
  function play(){if(sourceKind==='video'&&stage.playing&&!document.hidden&&!disposed)video.play().catch(()=>{
    if(sourceKind==='video'&&stage.playing){notice='视频等待播放许可，请点击继续巡航';stage.dirty=true;}
  });}
  function setSource(kind){
    sourceKind=kind;sourcePicker.value=kind;notice='';resetCache();
    if(kind==='video'){
      if(!video.getAttribute('src')){video.src=asset('matrix-battle/03-clash.mp4');video.load();}
      play();
    }else video.pause();
    stage.dirty=true;
  }
  video.addEventListener('loadeddata',()=>{notice='';lastTime=-1;stage.dirty=true;});
  video.addEventListener('error',()=>{
    if(disposed||sourceKind!=='video')return;
    setSource('art');notice='视频读取失败，已返回本章插画';stage.dirty=true;
  });
  function writeCopy(){
    const c=chapters[chapterIndex],number=String(chapterIndex+1).padStart(2,'0');
    document.body.dataset.chapter=hero.dataset.chapter=folio.dataset.chapter=c.id;
    document.body.style.setProperty('--accent',c.accent);
    hero.querySelector('.eyebrow').replaceChildren();
    const english=document.createElement('span');english.textContent=c.english;
    const index=document.createElement('span');index.textContent=number+' / 05';
    hero.querySelector('.eyebrow').append(english,document.createElement('i'),index);
    [...hero.querySelector('h1').children].forEach((line,i)=>line.textContent=c.headline[i]);
    hero.querySelector('p').textContent=c.body;document.querySelector('#interact > span').textContent=c.action;
    const tag=document.querySelector('.stage-tag');tag.replaceChildren();
    const kicker=document.createElement('b');kicker.textContent=c.kicker;
    tag.append(document.createElement('span'),document.createTextNode('AFTERLIGHT / VISUAL JOURNAL'),kicker);
    document.querySelector('.study-coordinate span').textContent=c.english;
    document.querySelector('.study-coordinate b').textContent=c.time;
    folio.querySelector('.temporal-folio-top span').textContent='PRODUCT JOURNAL / '+number;
    folio.querySelector('.temporal-folio-top b').textContent=c.location;
    folio.querySelector('h2').textContent=c.feature;folio.querySelector('p').textContent=c.detail;
    folio.style.setProperty('--chapter-art',`url("${asset(c.image)}")`);
    const tags=folio.querySelector('.temporal-tags');tags.replaceChildren();
    for(const text of c.tags){const tag=document.createElement('span');tag.textContent=text;tags.append(tag);}
    note.querySelector('p').textContent=c.note;note.querySelector('small').textContent=c.annotation;
    stamp.querySelector('span').textContent='EXPOSURE / '+number;
    stamp.querySelector('b').textContent=c.time;stamp.querySelector('small').textContent=c.location;
    field.value=mode;depthControl.value=String(depth);
    stage.canvas.setAttribute('aria-label',c.title+'。'+c.annotation+'。移动指针探索；左右方向键翻页。');
  }
  function choose(index,{animate=true,continueTour=false}={}){
    if(animate&&stage.playing&&!reduced.matches&&stage.frame>0){
      before.width=stage.canvas.width;before.height=stage.canvas.height;beforeContext.drawImage(stage.canvas,0,0);transition=0;
    }else transition=1;
    chapterIndex=(index+chapters.length)%chapters.length;mode=chapters[chapterIndex].mode;depth=chapters[chapterIndex].depth;
    chapterTime=0;tour=continueTour;setSource('art');writeCopy();
    theater.style.setProperty('--chapter-enter',String(transition));stage.dirty=true;
  }
  function reset(){choose(4,{animate:false});}
  const scenes={label:'THE TIME JOURNAL',kind:'CHAPTER',items:chapters.map((c,i)=>({
    ...c,apply:()=>choose(i),active:()=>chapterIndex===i,
  }))};

  // Still chapters retain full image resolution. The delayed regions re-evaluate
  // the same camera path at an earlier time instead of enlarging the video cache.
  function drawArt(ctx,w,h,t){
    const img=art[chapterIndex],motion=reduced.matches?0:1;
    const zoom=1.09+Math.sin(t*.17)*.012*motion,fit=coverFit(img.width,img.height,w*zoom,h*zoom);
    const present=mode==='clear';
    const x=fit.x-(w*zoom-w)/2+Math.sin(t*(present?.48:.24))*w*.012*motion+(present?(stage.pointer.x-.5)*w*.024:0);
    const y=fit.y-(h*zoom-h)/2+Math.cos(t*(present?.39:.19))*h*.012*motion+(present?(stage.pointer.y-.5)*h*.024:0);
    ctx.drawImage(img,x,y,fit.width,fit.height);
  }
  // Art and cached motion use the same moving slice boundaries and play clock.
  // Pointer input remains live when playback is paused or reduced motion is on.
  function movingField(){
    return {t:reduced.matches?0:stage.t,x:stage.pointer.x,y:stage.pointer.y,layers:8};
  }
  function sliceEdge(i,x,field){
    const {t}=field;
    if(mode==='wave')return .29+i*.11+(field.x-.5)*.24+Math.sin(t*.7)*.025+Math.sin(t*1.15+i*.8)*.014;
    return i/6-.17+(field.y-.5)*.24+Math.sin(x*5.4-t*.95+i*.42)*.042+Math.sin((x-field.x)*4)*.035;
  }
  function sliceDelay(i,field){
    return clamp((i+.5)/field.layers+Math.sin(field.t*1.1+i*.9)*.16+(field.y-.5)*.18);
  }
  function drawPresent(ctx,w,h,draw){
    const field=movingField(),px=w*(.62+(field.x-.5)*.56),py=h*(.46+(field.y-.5)*.6);
    const radius=Math.min(w,h)*(.205+Math.sin(field.t*1.2)*.008),zoom=1.075+Math.sin(field.t*.9)*.012;
    // A lens re-samples the current exposure only; zero depth stays at this instant.
    ctx.save();ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.clip();
    ctx.translate(px,py);ctx.scale(zoom,zoom);ctx.translate(-px,-py);draw();ctx.restore();
    ctx.save();ctx.strokeStyle=chapters[chapterIndex].accent;ctx.lineWidth=1;
    ctx.globalAlpha=.27;ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<2;i++){
      const a=field.t*.42+i*Math.PI;
      ctx.globalAlpha=.38-i*.12;ctx.beginPath();ctx.arc(px,py,radius+9+i*10,a,a+Math.PI*.65);ctx.stroke();
    }
    const light=ctx.createRadialGradient(px-radius*.25,py-radius*.3,0,px,py,radius);
    light.addColorStop(0,'#fff4d514');light.addColorStop(1,'#fff4d500');
    ctx.globalAlpha=1;ctx.fillStyle=light;ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawSlices(ctx,w,h){
    const field=movingField(),vertical=mode==='wave',steps=24;
    for(let i=0;i<field.layers;i++){
      ctx.save();ctx.beginPath();
      if(vertical){const left=sliceEdge(i,0,field)*w,right=sliceEdge(i+1,0,field)*w;ctx.rect(left,0,right-left,h);}
      else{
        for(let n=0;n<=steps;n++){
          const x=.24+.76*n/steps,y=sliceEdge(i,x,field)*h;
          if(n===0)ctx.moveTo(x*w,y);else ctx.lineTo(x*w,y);
        }
        for(let n=steps;n>=0;n--){const x=.24+.76*n/steps;ctx.lineTo(x*w,sliceEdge(i+1,x,field)*h);}
        ctx.closePath();
      }
      ctx.clip();
      const delay=depth*sliceDelay(i,field),phase=field.t*1.15+i*.9;
      const strength=depth/2.6;
      const dx=w*(vertical?.014:.022)*Math.sin(phase+(field.x-.5)*3)*strength;
      const dy=h*(vertical?.018:.013)*Math.cos(phase+(field.y-.5)*3)*strength;
      ctx.translate(dx,dy);drawArt(ctx,w,h,stage.t-delay);ctx.restore();
      ctx.save();ctx.strokeStyle=chapters[chapterIndex].accent;ctx.lineWidth=.8;ctx.globalAlpha=.24;ctx.stroke();ctx.restore();
    }
  }
  function drawSynthetic(t){
    sky(sctx,W,H,'#172d3b','#091a25');
    sctx.strokeStyle='#aebcaa48';sctx.lineWidth=1;
    for(let i=0;i<3;i++){
      sctx.beginPath();sctx.ellipse(W/2,H/2,61+i*34,26+i*19,-.42,0,Math.PI*2);sctx.stroke();
      const a=t*(.9+i*.23)+i*2.1;sctx.fillStyle=['#f1d09b','#94bfc0','#d18b72'][i];
      sctx.beginPath();sctx.arc(W/2+Math.cos(a)*(65+i*30),H/2+Math.sin(a)*(28+i*18),11-i*2,0,Math.PI*2);sctx.fill();
    }
    const swing=Math.sin(t*2)*.9,bobX=W/2+Math.sin(swing)*112,bobY=20+Math.cos(swing)*112;
    sctx.strokeStyle='#bfd0c3';sctx.beginPath();sctx.moveTo(W/2,20);sctx.lineTo(bobX,bobY);sctx.stroke();
    sctx.fillStyle='#edce94';sctx.beginPath();sctx.arc(bobX,bobY,13,0,Math.PI*2);sctx.fill();
  }
  function capture(){
    const t=sourceKind==='video'?video.currentTime:stage.t;
    if(sourceKind==='video'&&video.readyState<2)return;
    if(lastTime>=0&&Math.floor(t*24)===Math.floor(lastTime*24))return;
    if(lastTime>=0){let delta=t-lastTime;if(delta<0)delta=sourceKind==='video'&&Number.isFinite(video.duration)?video.duration-lastTime+t:1/24;clock+=Math.max(0,delta);}
    if(sourceKind==='synthetic')drawSynthetic(t);
    else if(sourceKind==='art')drawArt(sctx,W,H,t);
    else{const fit=coverFit(video.videoWidth,video.videoHeight,W,H);sctx.drawImage(video,fit.x,fit.y,fit.width,fit.height);}
    buffers[head]=sctx.getImageData(0,0,W,H).data;timestamps[head]=clock;head=(head+1)%CAP;count=Math.min(count+1,CAP);lastTime=t;
  }
  function drawHistory(ctx,w,h){
    if(!count){drawArt(ctx,w,h,stage.t);return;}
    const p=sourcePointer(stage.pointer,W,H,w,h),at=age=>(head-1-age+CAP*2)%CAP;
    const newest=timestamps[at(0)],seconds=Math.min(depth,newest-timestamps[at(count-1)]);let j=0;
    for(let i=0;i<=256;i++){
      const wanted=newest-seconds*i/256;
      while(j<count-2&&timestamps[at(j+1)]>wanted)j++;
      const newer=timestamps[at(j)],older=timestamps[at(Math.min(j+1,count-1))];
      ageTable[i]=Math.min(count-1,j+clamp((newer-wanted)/(newer-older||1)));
    }
    const sliced=mode==='wave'||mode==='ribbon',field=movingField(),fit=coverFit(W,H,w,h);
    const edges=Array.from({length:sliced?W:0},(_,x)=>Array.from({length:field.layers+1},(_,i)=>sliceEdge(i,x/W,field)));
    const delays=Array.from({length:field.layers},(_,i)=>sliceDelay(i,field));
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const nx=x/W,ny=y/H,dx=nx-p.x,dy=ny-p.y;
      let v=mode==='clear'?0:mode==='radial'?clamp(Math.hypot(dx*W/H,dy)*1.7):clamp((Math.sin(dx*12)+1)*.5);
      if(sliced){
        // Convert visible slice edges into source coordinates after cover fitting.
        const sx=(nx*fit.width+fit.x)/w,sy=(ny*fit.height+fit.y)/h;
        const column=edges[Math.round(clamp(sx)*(W-1))],position=mode==='wave'?sx:sy;
        let band=0;while(band<field.layers-1&&position>column[band+1])band++;
        v=(position<column[0]||position>column[field.layers]||(mode==='ribbon'&&sx<.24))?0:delays[band];
      }
      const ti=v*256,lo=Math.floor(ti),age=mix(ageTable[lo],ageTable[Math.min(256,lo+1)],ti-lo),a=Math.floor(age),f=age-a;
      const A=buffers[at(a)],B=buffers[at(Math.min(a+1,count-1))],k=(y*W+x)*4;
      for(let ch=0;ch<3;ch++)out.data[k+ch]=mix(A[k+ch],B[k+ch],f);out.data[k+3]=255;
    }
    rctx.putImageData(out,0,0);const draw=()=>ctx.drawImage(result,fit.x,fit.y,fit.width,fit.height);draw();
    if(mode==='clear')drawPresent(ctx,w,h,draw);
  }
  function drawTimeField(ctx,w,h){
    drawArt(ctx,w,h,stage.t);
    if(mode==='clear'){drawPresent(ctx,w,h,()=>drawArt(ctx,w,h,stage.t));return;}
    if(depth===0)return;
    if(mode==='wave'||mode==='ribbon'){drawSlices(ctx,w,h);return;}
    const px=w*(.62+(stage.pointer.x-.5)*.28),py=h*(.43+(stage.pointer.y-.5)*.28);
    ctx.save();ctx.strokeStyle=chapters[chapterIndex].accent;ctx.lineWidth=.7;
    const layers=mode==='radial'?3:mode==='echo'?3:7;
    for(let i=layers;i>0;i--){
      ctx.save();ctx.beginPath();
      if(mode==='radial')ctx.arc(px,py,Math.min(w,h)*(.12+i*.09),0,Math.PI*2);
      else if(mode==='wave')ctx.rect(w*.37+i*w*.07,0,w*.07,h);
      else if(mode==='ribbon')ctx.rect(w*.35,h*(i-1)/layers,w*.65,h/layers);
      else ctx.rect(w*(.43+i*.07),h*(.12+i*.045),w*.19,h*.61);
      ctx.clip();
      const delay=depth*(layers-i+1)/layers;
      if(mode==='echo')ctx.globalAlpha=.7;
      ctx.translate((mode==='wave'?1:mode==='echo'?2:.4)*delay*7,0);
      drawArt(ctx,w,h,stage.t-delay);ctx.restore();
      ctx.globalAlpha=mode==='echo'?.3:.14;ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.restore();
  }
  function drawTransition(ctx,w,h,dt){
    transition=(!stage.playing||reduced.matches)?1:Math.min(1,transition+dt/transitionSeconds);
    const blend=transition*transition*(3-2*transition);
    if(transition<1){
      // The outgoing canvas is captured on every selection, including interruptions.
      // Different arrival times per slice make the dissolve a visible time field.
      const strips=24;
      for(let i=0;i<strips;i++){
        const stagger=Math.abs(i/(strips-1)-.62)*.24;
        const local=clamp((transition-stagger)/(1-stagger));
        ctx.save();ctx.beginPath();ctx.rect(i*w/strips,0,w/strips+.5,h);ctx.clip();
        ctx.globalAlpha=1-local*local*(3-2*local);
        const zoom=1+blend*.04;ctx.translate(w/2,h/2);ctx.scale(zoom,zoom);
        ctx.drawImage(before,-w/2,-h/2,w,h);ctx.restore();
      }
    }
    theater.style.setProperty('--chapter-enter',String(blend));
  }
  writeCopy();
  return {
    scenes,reset,interact:()=>choose(chapterIndex+1),
    key(key){if(key==='ArrowRight')choose(chapterIndex+1);if(key==='ArrowLeft')choose(chapterIndex-1);},
    visibility(on){if(on)play();else video.pause();},
    render(dt){
      if(tour&&dt){chapterTime+=dt;if(chapterTime>=holdSeconds)choose(chapterIndex+1,{continueTour:true});}
      if(sourceKind!=='art')capture();const {ctx,width:w,height:h}=stage;
      ctx.clearRect(0,0,w,h);
      if(sourceKind==='art')drawTimeField(ctx,w,h);else drawHistory(ctx,w,h);
      drawTransition(ctx,w,h,dt);
      const c=chapters[chapterIndex];
      hint.textContent=notice||help;
      tourButton.setAttribute('aria-pressed',String(tour));
      document.querySelector('.telemetry-bottom span').textContent=sourceKind==='art'?'ILLUSTRATED JOURNAL':sourceKind==='video'?'VIDEO / LOCAL PLAYBACK':'PROCEDURAL MOTION';
      stage.status(notice||(sourceKind==='art'?c.location+' · '+c.time+(tour?' · 连读中':' · 手记展开'):sourceKind==='video'?sourceLabel+' · '+count+'/'+CAP+' 帧':'星轨摆钟 · '+count+'/'+CAP+' 帧'));
    },
    inspect:()=>({chapter:chapters[chapterIndex].id,chapterIndex,chapterTime,art:chapters[chapterIndex].image,
      text:chapters[chapterIndex].headline.join(''),texturesLoaded:art.length,transition,transitionSeconds,holdSeconds,tour,
      count,capacity:CAP,bytes:CAP*W*H*4,source:sourceKind,historySeconds:count?clock-timestamps[(head-count+CAP)%CAP]:0,mode,depth,readyState:video.readyState}),
    dispose(){disposed=true;video.pause();video.removeAttribute('src');video.load();if(objectURL)URL.revokeObjectURL(objectURL);buffers=[];},
  };
}
