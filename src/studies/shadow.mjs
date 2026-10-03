import {shadowSolid,camera,box,renderFaces,clamp} from './math.mjs';
import {asset,image,range,button,caption} from './core.mjs';

export async function create(stage,controls) {
  const chapters=JSON.parse(document.querySelector('#shadow-chapters').textContent);
  const art=await Promise.all(chapters.map(chapter=>image(asset(chapter.image))));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const theater=document.querySelector('.theater'),hero=document.querySelector('.hero-copy');
  const solid=shadowSolid(27),pedestal=box([0,-1.2,0],[2.5,.25,2.5],'#6a5947');
  for(const face of solid.faces)face.color='#b6986c';
  let chapterIndex=0,angle=0,orbit=.64,transition=1,chapterTime=0,scan=false,lastTick=0;
  const holdSeconds=18,transitionSeconds=.85;

  const gallery=document.createElement('div');gallery.className='shadow-art';
  art.forEach((img,i)=>{img.alt=chapters[i].alt;img.className='shadow-plate';img.draggable=false;gallery.append(img);});
  theater.prepend(gallery);
  const edition=document.createElement('div');edition.className='shadow-edition';
  edition.innerHTML='<span>半影 <b>PENUMBRA</b></span><small>光的设计札记 <i>ISSUE 01 / FORM & LIGHT</i></small>';
  theater.append(edition);
  const folio=document.createElement('aside');folio.className='shadow-folio';
  folio.setAttribute('aria-label','本章设计札记');
  folio.innerHTML='<span class="shadow-rule"></span><div><small></small><h2></h2><p></p></div>';
  theater.append(folio);
  const artCaption=document.createElement('div');artCaption.className='shadow-art-caption';
  artCaption.innerHTML='<span></span><p></p><small>光影概念图 / AI IMAGE</small>';theater.append(artCaption);
  const chapterMark=document.createElement('div');chapterMark.className='shadow-chapter-mark';
  chapterMark.setAttribute('aria-hidden','true');theater.append(chapterMark);
  hero.setAttribute('aria-live','polite');hero.setAttribute('aria-atomic','true');

  // Editorial photography and the live optical model use distinct surfaces.
  const bench=document.createElement('section');bench.className='shadow-workbench';
  bench.setAttribute('aria-label','光学小实验');
  bench.innerHTML='<div class="shadow-experiment-copy"><span>TRY THE IDEA / 光学小实验</span><h2></h2><p></p><small>拖动光源滑杆，或在模型上左右拖动</small></div><div class="shadow-demo"></div>';
  theater.after(bench);bench.querySelector('.shadow-demo').append(stage.canvas);
  stage.canvas.setAttribute('aria-label','固定实体与实时投影。左右方向键移动光源，上下方向键旋转观察角度。');
  const status=document.querySelector('#status');
  bench.querySelector('.shadow-experiment-copy').append(status);
  document.querySelector('.telemetry').hidden=true;
  document.querySelector('.instrument-title strong').textContent='光源与视角';
  document.querySelector('.instrument-title > span').textContent='LIGHT TABLE / 07';
  document.querySelector('#snapshot').textContent='保存投影';

  function manualLight(degrees) {
    angle=clamp(degrees,0,90)*Math.PI/180;scan=false;syncInputs();stage.dirty=true;
  }
  const input=range(controls,'光源方位',0,90,0,1,manualLight);
  button(controls,'对齐月影 · 0°',()=>manualLight(0));
  button(controls,'对齐菱影 · 90°',()=>manualLight(90));
  const orbitInput=range(controls,'观察雕塑',-170,170,37,1,v=>{orbit=v*Math.PI/180;stage.dirty=true;});
  const scanButton=button(controls,'扫描光源',()=>{scan=!scan;syncInputs();stage.dirty=true;});
  function syncInputs(){
    input.value=Math.round(angle/Math.PI*180);orbitInput.value=Math.round(orbit/Math.PI*180);
    scanButton.setAttribute('aria-pressed',String(scan));
    scanButton.textContent=scan?'停止扫描':'扫描光源';
  }

  function writeCopy() {
    const chapter=chapters[chapterIndex],number=String(chapterIndex+1).padStart(2,'0');
    document.body.style.setProperty('--accent',chapter.accent);
    document.body.dataset.chapter=hero.dataset.chapter=folio.dataset.chapter=chapter.id;
    hero.querySelector('.eyebrow').textContent=chapter.kicker;
    [...hero.querySelector('h1').children].forEach((line,i)=>line.textContent=chapter.headline[i]);
    hero.querySelector('p').textContent=chapter.body;
    document.querySelector('#interact > span').textContent=chapter.action;
    folio.querySelector('small').textContent='DESIGN NOTE / '+number;
    folio.querySelector('h2').textContent=chapter.feature;
    folio.querySelector('p').textContent=chapter.detail;
    artCaption.querySelector('span').textContent=chapter.material;
    artCaption.querySelector('p').textContent=chapter.note;
    chapterMark.textContent=number;
    bench.querySelector('h2').textContent=chapter.experiment;
    bench.querySelector('p').textContent=chapter.observation;
    art.forEach((img,i)=>{img.classList.toggle('is-current',i===chapterIndex);img.setAttribute('aria-hidden',String(i!==chapterIndex));});
    stage.status('平行光投影 · 同一份固定实体 · 27³ 构造网格');
  }

  function select(index,{animate=true}={}) {
    chapterIndex=(index+chapters.length)%chapters.length;chapterTime=0;scan=false;lastTick=0;
    angle=chapters[chapterIndex].angle*Math.PI/180;
    transition=animate&&stage.playing&&!reduced.matches?0:1;
    // Art and prose enter as one plate, including rapid selections.
    writeCopy();syncInputs();stage.dirty=true;
  }
  const scenes={label:'THE LIGHT JOURNAL',kind:'ESSAY',items:chapters.map((chapter,index)=>({
    ...chapter,apply:()=>select(index),active:()=>chapterIndex===index,
  }))};

  function drawExperiment() {
    const {ctx,width:w,height:h}=stage,half=w*.5;
    ctx.fillStyle='#171b1e';ctx.fillRect(0,0,half,h);
    ctx.save();ctx.beginPath();ctx.rect(0,0,half,h);ctx.clip();
    const cam=camera([Math.sin(orbit)*5,2.3,Math.cos(orbit)*5],[0,-.1,0],half,h,.91);
    renderFaces(ctx,[...pedestal,...solid.faces],cam,{light:[Math.sin(angle),.3,Math.cos(angle)]});
    caption(ctx,'01 / FIXED SOLID',14,22,'#c6bca9',9);
    ctx.restore();
    const gradient=ctx.createRadialGradient(half+(w-half)*.5,h*.5,10,half+(w-half)*.5,h*.5,w-half);
    gradient.addColorStop(0,'#e5d9bd');gradient.addColorStop(1,'#aba18c');
    ctx.fillStyle=gradient;ctx.fillRect(half,0,w-half,h);
    ctx.save();ctx.beginPath();ctx.rect(half,0,w-half,h);ctx.clip();
    const scale=Math.min(w-half,h)*.32,cx=half+(w-half)/2,cy=h*.53;
    // Project the same faces drawn at left. Normalize winding to union the faces.
    ctx.fillStyle='#242923';ctx.beginPath();
    for(const face of solid.faces){
      const points=face.points.map(p=>[cx+(p[0]*Math.cos(angle)+p[2]*Math.sin(angle))*scale,cy-p[1]*scale]);
      const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
      if(Math.abs(area)<1e-8)continue;if(area<0)points.reverse();
      points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
    }
    ctx.fill('nonzero');
    caption(ctx,'02 / PROJECTION',half+14,22,'#383d32',9);
    caption(ctx,Math.round(angle/Math.PI*180)+'°',half+14,h-16,'#383d32',12);
    caption(ctx,angle<.035?'月牙':angle>1.535?'菱形':'过渡投影',half+54,h-17,'#383d32',10);
    ctx.restore();
  }
  select(0,{animate:false});
  return {
    scenes,interact:()=>select(chapterIndex+1),
    reset(){orbit=.64;select(chapterIndex,{animate:false});},
    key(key){if(key==='ArrowRight')manualLight(angle/Math.PI*180+3);if(key==='ArrowLeft')manualLight(angle/Math.PI*180-3);
      if(key==='ArrowUp'||key==='ArrowDown'){orbit=clamp(orbit+(key==='ArrowUp'?.08:-.08),-2.96,2.96);syncInputs();}},
    pointer(p){if(p.down){orbit=clamp(orbit+p.dx*3,-2.96,2.96);syncInputs();}},
    visibility(on){lastTick=0;if(!on&&transition<1){transition=1;theater.style.setProperty('--chapter-enter',1);}},
    render(dt){
      // Reading time follows the visible clock, independently of the shared
      // physics timestep cap. Pausing and backgrounding reset this clock.
      const now=performance.now(),elapsed=dt&&lastTick?(now-lastTick)/1000:0;lastTick=now;
      if(dt&&!reduced.matches){
        chapterTime+=elapsed;
        if(chapterTime>=holdSeconds)select(chapterIndex+1);
        if(scan){angle=(.5-.5*Math.cos(stage.t*.55))*Math.PI/2;syncInputs();}
        transition=clamp(transition+elapsed/transitionSeconds);
      }else if(reduced.matches)transition=1;
      const enter=transition*transition*(3-2*transition);
      theater.style.setProperty('--chapter-enter',enter);
      const drift=reduced.matches?0:Math.sin(stage.t*.13)*.004;
      art[chapterIndex].style.transform=`scale(${1.015+drift})`;
      drawExperiment();
    },
    inspect:()=>({angle,orbit,voxels:solid.voxels.length,faces:solid.faces.length,model:'fixed-intersection-solid',
      chapter:chapters[chapterIndex].id,art:chapters[chapterIndex].image,texturesLoaded:art.length,
      transition,chapterTime,holdSeconds,scan}),
  };
}
