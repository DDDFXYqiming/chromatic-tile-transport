/* Matrix Motion application. The original WarpArchive is deliberately not imported. */
(async function () {
  'use strict';
  const T=MatrixTimeline, $=id=>document.getElementById(id);
  const data=window.MATRIX_DATA, params=new URLSearchParams(location.search);
  if(!data||!Array.isArray(data.scenes)||data.scenes.length<2){$('error').hidden=false;$('error').textContent='影像清单缺失，请使用 scripts/build_matrix.py 构建。';return;}
  const scenes=data.scenes,settings=$('settings'),focus=data.config.focus||{},reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
  document.body.classList.toggle('layered-study',!!data.config.composition);
  let config=T.validate(data.config.options||{}),seconds=0,ready=false,playing=false,reduced=reducedQuery.matches;
  let renderer,images,layerImages=[],compositor=null,frame,last=0,raf=0,dirty=true,loop=null,restorePlay=false,contextLost=false;
  const modeLabels={auto:'导演编排',original:'原画',duotone:'双色',poster:'色块',line:'线描',matrix:'固定点阵'};
  const warnings=[];let dominant=-1,touchY=null;
  function showError(e){$('error').hidden=false;$('error').textContent='影像暂时无法显示：'+e.message+'。可尝试通过项目本地服务器打开，或使用离线单文件版本。';$('loading').classList.add('ready');playing=false;}
  function loadImage(scene){return new Promise((resolve,reject)=>{
    const img=new Image();img.decoding='async';const timer=setTimeout(()=>reject(new Error(scene.name+' 加载超时')),20000);
    img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(new Error(scene.name+' 素材加载失败'));};img.src=scene.src;
  });}
  async function makeRenderer(){
    let canvas=$('matrixCanvas');
    try{if(params.get('renderer')==='canvas')throw new Error('Canvas requested');renderer=new MatrixRenderers.WebGLRenderer(canvas,images);}
    catch(e){warnings.push(e.message);const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);canvas=fresh;renderer=new MatrixRenderers.CanvasRenderer(canvas,images);}
    if(data.config.composition){
      const visibility=compositor?.visibility||{},study=compositor?.study||null;
      compositor=new MatrixLayers.Compositor(data.config.composition,layerImages,scenes);compositor.visibility=visibility;compositor.study=study;
      await compositor.init(renderer.kind!=='CANVAS 2D');
      if(compositor.meshWarning)warnings.push(compositor.meshWarning);
      renderer.setComposition(compositor);
    }
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;restorePlay=playing;playing=false;$('loadingText').textContent='图形上下文暂时丢失，正在等待恢复…';$('loading').classList.remove('ready');});
    canvas.addEventListener('webglcontextrestored',async()=>{try{renderer.dispose();const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);await makeRenderer();contextLost=false;resize();playing=restorePlay&&!reduced;last=0;$('loading').classList.add('ready');render();}catch(e){showError(e);}});
  }
  function resize(){if(!renderer)return;const c=$('stage');renderer.resize(Math.max(1,c.clientWidth),Math.max(1,c.clientHeight),devicePixelRatio);dirty=true;if(ready&&!contextLost)render();}
  function render(){
    if(!ready||contextLost)return;
    frame=T.frame(seconds,scenes.length,config,reduced);
    if(config.motionStudy&&compositor){
      const pose=compositor.study||frame;
      frame={...frame,scene:pose.scene,next:pose.scene,phase:pose.phase,bridge:0,from:0,to:0,reveal:0,forceMatrix:false,label:reduced?'静态浏览 / REDUCED MOTION':'定机位 / MOTION STUDY'};
    }
    renderer.draw(frame,config,scenes,focus);dirty=false;
    const current=frame.bridge>.58?frame.next:frame.scene;
    if(current!==dominant){dominant=current;const s=scenes[current];$('sceneTitle').textContent=s.name;$('sceneEnglish').textContent=s.en;
      $('stageNumber').textContent=String(current+1).padStart(2,'0')+' — '+String(scenes.length).padStart(2,'0');
      $('chapter').replaceChildren(document.createTextNode(String(current+1).padStart(2,'0')));const tail=document.createElement('span');tail.textContent='/ '+String(scenes.length).padStart(2,'0');$('chapter').append(tail);
      document.querySelectorAll('.film-item').forEach((el,i)=>{el.classList.toggle('active',i===current);el.setAttribute('aria-current',i===current?'true':'false');});}
    const shade=compositor?Math.max(T.span(0,.25,frame.bridge)*(1-T.span(.72,1,frame.bridge)),frame.forceMatrix?1:0):frame.shade;
    $('stage').classList.toggle('dark',shade>.5);
    $('stage').style.setProperty('--shade-mix',shade.toFixed(4));
    $('stagePhase').textContent=frame.label;
    $('timeline').max=frame.total;$('timeline').value=frame.position;
    $('elapsed').textContent=frame.position.toFixed(2).padStart(5,'0');$('totalTime').textContent=frame.total.toFixed(2);
    $('engineLabel').textContent=renderer.kind+(loop?' / PREVIEW':' / LIVE');
    $('bridgeButton').setAttribute('aria-pressed',String(!!loop));
    const subject=compositor?'双镜头':'双图';
    $('bridgeButton').setAttribute('aria-label',loop?'退出'+subject+'演示，继续正常播放':'播放'+subject+'慢速演示');
    $('bridgeLabel').textContent=loop?'退出'+subject+'演示':'慢看'+subject+'切换';
    $('bridgeArrow').textContent=loop?'↙':'↗';
    $('playGlyph').textContent=playing?'Ⅱ':'▷';$('playLabel').textContent=playing?'暂停播放':'继续播放';$('playButton').setAttribute('aria-label',playing?'暂停播放':'继续播放');
    if(settings.open)$('diagnostics').textContent=`${renderer.kind} · ${renderer.grid.cols} × ${renderer.grid.rows} 固定格点 · ${frame.position.toFixed(3)}s${renderer.kind==='CANVAS 2D'?' · 简化兼容效果':''}`;
  }
  function seek(value){if(!Number.isFinite(value))throw new TypeError('seek expects finite seconds');seconds=T.wrap(value,scenes.length*config.shotSeconds);loop=null;playing=false;dirty=true;render();return getState();}
  function pause(){playing=false;render();}
  function play(){if(reduced)return;playing=true;last=0;render();}
  function go(index){if(!ready)return;const was=playing;if(compositor)compositor.study=null;seek(T.wrap(index,scenes.length)*config.shotSeconds);if(was)play();}
  function syncControls(){
    for(const key of ['palette','shotSeconds','bridgeSeconds','density','zoom']){
      const select=$(key),value=String(config[key]);
      if(!Array.from(select.options).some(o=>o.value===value)){const o=document.createElement('option');o.value=value;o.textContent=value;select.add(o);}select.value=value;
    }
    $('parallax').checked=config.parallax>0;$('reduced').checked=reduced;$('clean').checked=document.body.classList.contains('clean');
    if($('layerControls')){
      $('layerControls').hidden=!compositor;$('layerMotion').checked=config.layerMotion;
      $('deformation').checked=config.deformation;$('motionStudy').checked=config.motionStudy;
      $('deformation').disabled=!compositor?.surfaces.length;
      $('deformationStrength').disabled=!compositor?.surfaces.length;
      $('deformationStrength').value=config.deformationStrength;$('deformationStrengthValue').textContent=config.deformationStrength.toFixed(2)+'×';
      $('deformationNote').textContent=compositor?.surfaces.length?'鱼尾游动、花枝弯曲、人物呼吸与发梢摆动。':'当前为简化兼容模式，局部形变不可用。';
      for(const key of ['cameraX','cameraY']){$(key).value=config[key];$(key+'Value').textContent=Math.round(config[key]*100)+'%';}
    }
    document.querySelectorAll('#modeButtons button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===config.mode)));
    const budget=T.timing(config);
    $('timingSummary').textContent=`导演编排 · 每幕 ${budget.shotSeconds.toFixed(2)} 秒：原画 ${budget.originalSeconds.toFixed(2)} 秒 / 点阵含进出 ${budget.bridgeSeconds.toFixed(2)} 秒 / 其他显影 ${budget.accentSeconds.toFixed(2)} 秒。`;
  }
  function configure(patch){const next=T.validate(patch,config);seconds=seconds/config.shotSeconds*next.shotSeconds;config=next;loop=null;
    if('autoplay'in patch)playing=config.autoplay&&!reduced;syncControls();dirty=true;render();return getState();}
  function setReduced(value){if(typeof value!=='boolean')throw new TypeError('reduced must be boolean');reduced=value;if(reduced){playing=false;loop=null;}syncControls();dirty=true;render();}
  function getState(){return {ready,engine:renderer?.kind||'loading',seconds:frame?.position||0,sceneCount:scenes.length,playing,reduced,config:{...config},
    frame:frame?{...frame}:null,grid:renderer?.grid||null,width:renderer?.width||0,height:renderer?.height||0,
    glError:contextLost?null:renderer?.error()||0,contextLost,drawCount:renderer?.drawCount||0,bridgeLoop:!!loop,
    preview:loop?T.previewPosition(loop.elapsed,loop.scene,scenes.length,config):null,timing:T.timing(config),composition:compositor?.getState()||null,warnings:warnings.slice()};}
  function tick(now){raf=requestAnimationFrame(tick);if(!ready||contextLost||document.hidden){last=0;return;}
    const dt=last?Math.min(.06,(now-last)/1000):0;last=now;
    if(playing&&!reduced&&!settings.open){
      const previous=seconds;
      if(loop){loop.elapsed+=dt;seconds=T.previewPosition(loop.elapsed,loop.scene,scenes.length,config).position;}
      else seconds=T.wrap(seconds+dt,scenes.length*config.shotSeconds);
      if(seconds!==previous)dirty=true;
    }
    if(dirty)render();
  }
  function inspectBridge(){if(!ready)return;configure({mode:'auto',motionStudy:false});setReduced(false);const index=frame.scene;seek((index+1)*config.shotSeconds-config.bridgeSeconds*.5);}
  function toggleImmersive(value){document.body.classList.toggle('immersive',value??!document.body.classList.contains('immersive'));resize();}
  function closeSettings(){settings.close();last=0;}
  function openSettings(){settings.showModal();syncControls();render();}
  scenes.forEach((scene,i)=>{
    const button=document.createElement('button');button.type='button';button.className='film-item';button.setAttribute('aria-label','第'+(i+1)+'幕：'+scene.name);
    const img=new Image();img.src=scene.src;img.alt='';img.style.objectPosition=scene.position.map(x=>(x*100)+'%').join(' ');
    const label=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=scene.name;small.textContent=String(i+1).padStart(2,'0')+' / '+scene.en;label.append(strong,small);button.append(img,label);button.addEventListener('click',()=>go(i));$('filmstrip').append(button);
  });
  T.MODES.forEach(mode=>{const b=document.createElement('button');b.textContent=modeLabels[mode];b.type='button';b.dataset.mode=mode;b.setAttribute('aria-pressed',String(mode===config.mode));b.addEventListener('click',()=>configure({mode,motionStudy:false}));$('modeButtons').append(b);});
  for(const key of ['palette','shotSeconds','bridgeSeconds','density','zoom'])$(key).addEventListener('change',()=>configure({[key]:key==='palette'?$(key).value:Number($(key).value)}));
  for(const key of ['cameraX','cameraY'])$(key).addEventListener('input',()=>configure({[key]:Number($(key).value)}));
  $('layerMotion').addEventListener('change',()=>configure({layerMotion:$('layerMotion').checked}));
  for(const key of ['deformation','motionStudy'])$(key).addEventListener('change',()=>configure({[key]:$(key).checked}));
  $('deformationStrength').addEventListener('input',()=>configure({deformationStrength:Number($('deformationStrength').value)}));
  $('parallax').addEventListener('change',()=>configure({parallax:$('parallax').checked?.65:0}));
  $('clean').addEventListener('change',()=>document.body.classList.toggle('clean',$('clean').checked));
  $('reduced').addEventListener('change',()=>setReduced($('reduced').checked));
  $('settingsOpen').addEventListener('click',openSettings);$('settingsClose').addEventListener('click',closeSettings);
  settings.addEventListener('click',e=>{if(e.target===settings){const r=settings.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSettings();}});
  settings.addEventListener('close',()=>{last=0;});
  $('playButton').addEventListener('click',()=>playing?pause():play());
  $('previous').addEventListener('click',()=>{if(ready)go(frame.scene-1)});$('next').addEventListener('click',()=>{if(ready)go(frame.scene+1)});
  $('immersive').addEventListener('click',()=>toggleImmersive());$('exitImmersive').addEventListener('click',()=>toggleImmersive(false));
  $('timeline').addEventListener('input',e=>seek(Number(e.target.value)));
  $('inspectBridge').addEventListener('click',()=>{inspectBridge();closeSettings();});
  $('reset').addEventListener('click',()=>{config=T.validate(data.config.options||{});seconds=0;loop=null;reduced=reducedQuery.matches;document.body.classList.remove('clean');playing=!reduced;syncControls();closeSettings();render();});
  $('bridgeButton').addEventListener('click',()=>{
    if(!ready)return;if(loop){loop=null;play();return;}const i=dominant;
    configure({mode:'auto',motionStudy:false});setReduced(false);loop={scene:i,elapsed:0};
    seconds=T.previewPosition(0,i,scenes.length,config).position;play();
  });
  $('stage').addEventListener('wheel',e=>{if(!ready||settings.open)return;e.preventDefault();const units=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;seek(seconds+e.deltaY*units*.003);},{passive:false});
  $('stage').addEventListener('pointerdown',e=>{if(e.target.closest('button,a'))return;touchY={x:e.clientX,y:e.clientY,seconds};$('stage').setPointerCapture(e.pointerId);});
  $('stage').addEventListener('pointermove',e=>{if(touchY)seek(touchY.seconds+(touchY.y-e.clientY+e.clientX-touchY.x)*.012);});
  for(const e of ['pointerup','pointercancel','lostpointercapture'])$('stage').addEventListener(e,()=>{touchY=null;});
  addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(document.body.classList.contains('immersive'))toggleImmersive(false);return;}
    if(!ready||settings.open||e.target.closest('input,select,textarea,button,a'))return;
    if(e.code==='Space'){e.preventDefault();playing?pause():play();}
    if(e.key.toLowerCase()==='f')toggleImmersive();
    if(e.key==='ArrowRight'){e.preventDefault();go(frame.scene+1);}if(e.key==='ArrowLeft'){e.preventDefault();go(frame.scene-1);}
  });
  reducedQuery.addEventListener('change',e=>setReduced(e.matches));
  document.addEventListener('visibilitychange',()=>{last=0;});
  new ResizeObserver(resize).observe($('stage'));
  window.MatrixMotion=Object.freeze({getState,seek,seekScene:go,pause,play,configure,setReduced,inspectBridge,
    setLayerVisible(id,value){if(!compositor||!data.config.composition.layers.some(l=>l.id===id)||typeof value!=='boolean')throw new TypeError('Unknown layer or non-boolean visibility');compositor.visibility[id]=value;document.querySelectorAll('[data-layer]').forEach(e=>{if(e.dataset.layer===id)e.checked=value;});dirty=true;render();},
    setClean(value){if(typeof value!=='boolean')throw new TypeError('clean must be boolean');document.body.classList.toggle('clean',value);syncControls();},
    setImmersive:toggleImmersive,render(){dirty=true;render();},
    snapshot(){render();return $('matrixCanvas').toDataURL('image/png');}});
  try{
    [images,layerImages]=await Promise.all([Promise.all(scenes.map(loadImage)),Promise.all((data.config.composition?.layers||[]).map(l=>loadImage({src:l.src,name:l.label})))]);await makeRenderer();
    if(compositor){
      data.config.composition.layers.forEach(layer=>{
        const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.dataset.layer=layer.id;
        input.addEventListener('change',()=>{compositor.visibility[layer.id]=input.checked;dirty=true;render();});
        label.append(input,document.createTextNode(layer.label));$('layerList').append(label);
      });
      document.querySelectorAll('.film-item img').forEach((img,i)=>{img.src=compositor.thumbnail(i,config);});
    }
    if(T.MODES.includes(params.get('mode')))config=T.validate({mode:params.get('mode')},config);
    const initial=Number(params.get('scene')||0);if(Number.isFinite(initial))seconds=T.wrap(Math.floor(initial),scenes.length)*config.shotSeconds;
    resize();ready=true;playing=config.autoplay&&!reduced;syncControls();render();$('loading').classList.add('ready');raf=requestAnimationFrame(tick);
  }catch(e){showError(e);}
  addEventListener('pagehide',()=>{cancelAnimationFrame(raf);last=0;});
  addEventListener('pageshow',e=>{if(e.persisted){last=0;raf=requestAnimationFrame(tick);}});
})();
