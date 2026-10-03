import {clamp} from './math.mjs';
import {asset,image,offscreen,coverFit,range,button} from './core.mjs';

// The artwork, editorial copy and world state travel through one chapter model.
export async function create(stage,controls) {
  const chapters=JSON.parse(document.querySelector('#optical-chapters').textContent);
  const textures=await Promise.all(['black','white'].map(world=>image(asset(`studies/optical-${world}.png`))));
  const root=document.body,theater=document.querySelector('.theater');
  const abort=new AbortController(),events={signal:abort.signal};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const frame=offscreen(1,1),previous=offscreen(1,1),layers=[offscreen(1,1),offscreen(1,1)];
  let current=0,split=.77,transition=1,elapsed=0,disposed=false;
  const $=s=>document.querySelector(s);
  const element=(tag,cls,html)=>{const el=document.createElement(tag);el.className=cls;if(html)el.innerHTML=html;return el;};
  const wordmark=element('div','optical-wordmark','<strong>PHASE<span>06</span></strong><span>相界 / OPTICAL SYSTEMS</span>');
  const worlds=element('div','optical-worlds');worlds.setAttribute('role','group');worlds.setAttribute('aria-label','选择黑白空间');
  const worldButtons=['black','white'].map((world,i)=>{
    const b=button(worlds,i?'○ 白场 / 研发':'● 黑场 / 产品',()=>choose((current%2)+(i?2:0)));
    b.dataset.world=world;return b;
  });
  const other=element('aside','optical-other','<span class="optical-other-code"></span><h2></h2><p></p><button type="button">进入另一面 <span aria-hidden="true">↗</span></button>');
  other.setAttribute('aria-label','另一空间预览');other.querySelector('button').addEventListener('click',flip,events);
  const seam=element('div','optical-seam','<span aria-hidden="true">‹<i></i>›</span><small aria-hidden="true">DRAG TO REVEAL</small>');
  seam.tabIndex=0;seam.setAttribute('role','slider');seam.setAttribute('aria-label','光学分界');seam.setAttribute('aria-valuemin','53');seam.setAttribute('aria-valuemax','91');
  const lower=element('div','optical-caption','<span>DUAL REALITY / 06</span><span>ONE INSTRUMENT. TWO PERSPECTIVES.</span>');
  const overlay=element('div','optical-main-overlay');
  overlay.append(wordmark,$('.hero-copy'),$('.stage-tag'),lower);
  theater.append(overlay,worlds,other,seam);
  const bar=$('.instrument-bar');
  const journal=element('article','optical-journal','<div><span class="optical-tag"></span><h2></h2></div><p></p>');
  const specs=element('dl','optical-specs');
  const note=element('p','optical-note');
  const tools=element('details','optical-tools','<summary>光学台 <span aria-hidden="true">＋</span></summary>');
  const toolsBody=element('div','optical-tools-body');toolsBody.append(controls,$('.utility-actions'));tools.append(toolsBody);
  bar.replaceChildren(journal,specs,note,tools);
  const splitInput=range(controls,'分界位置',53,91,77,1,v=>setSplit(v/100));
  button(controls,'黑白翻转',flip);
  const announce=element('p','optical-announcement');announce.setAttribute('role','status');announce.setAttribute('aria-live','polite');theater.append(announce);
  function setSplit(value){
    split=clamp(value,.53,.91);splitInput.value=Math.round(split*100);
    seam.setAttribute('aria-valuenow',String(Math.round(split*100)));
    seam.setAttribute('aria-valuetext',`${Math.round(split*100)}% 当前空间`);
    other.hidden=split>.85;
    theater.style.setProperty('--optical-split',`${split*100}%`);stage.dirty=true;
  }
  function flip(){choose(chapters.findIndex(c=>c.id===chapters[current].pair));}
  function syncCopy(){
    const c=chapters[current],white=c.world==='white';
    root.dataset.opticalWorld=c.world;root.style.setProperty('--accent',white?'#9b4a17':'#efa15f');
    $('.hero-copy .eyebrow').textContent=`${white?'WHITE ROOM':'BLACK FIELD'} / ${c.kicker}`;
    $('h1').replaceChildren(...c.headline.map(text=>{const s=document.createElement('span');s.textContent=text;return s;}));
    $('.hero-copy > p').textContent=c.body;$('#interact > span').textContent=c.action;
    $('.stage-tag b').textContent='PHASE / 相界';
    journal.querySelector('.optical-tag').textContent=c.tag;journal.querySelector('h2').textContent=c.feature;journal.querySelector('p').textContent=c.detail;
    specs.replaceChildren(...c.specs.map(([value,label])=>{const d=element('div','');const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=value;dd.textContent=label;d.append(dt,dd);return d;}));
    note.textContent=c.note;
    worldButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.world===c.world)));
    other.querySelector('.optical-other-code').textContent=white?'01 / BLACK FIELD':'02 / WHITE ROOM';
    other.querySelector('h2').textContent=white?'夜航\n模组':'光路\n手记';
    other.querySelector('p').textContent=white?'FIELD SYSTEM':'RESEARCH JOURNAL';
    $('#canvas').setAttribute('aria-label',`${c.title}。${c.body} 方向键翻阅章节，空格暂停。`);
    announce.textContent=`${c.title}。${c.headline.join('')}`;
    stage.status(`${c.title} · ${Math.round(split*100)}% 当前空间`);
  }
  function choose(index){
    if(index===current)return;
    // Snapshot the visible composite so rapid reversals continue from actual pixels.
    previous.width=frame.width;previous.height=frame.height;previous.getContext('2d').drawImage(frame,0,0);
    current=index;elapsed=0;transition=stage.playing&&!reduced.matches?0:1;
    syncCopy();stage.dirty=true;
  }
  const drag=e=>{const r=theater.getBoundingClientRect();setSplit((e.clientX-r.left)/r.width);};
  seam.addEventListener('pointerdown',e=>{e.preventDefault();seam.setPointerCapture(e.pointerId);seam.focus({preventScroll:true});drag(e);},events);
  seam.addEventListener('pointermove',e=>{if(seam.hasPointerCapture(e.pointerId))drag(e);},events);
  seam.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
      e.preventDefault();e.stopPropagation();
      setSplit(e.key==='Home'?.53:e.key==='End'?.91:split+(e.key==='ArrowRight'?.02:-.02));
    }
  },events);
  reduced.addEventListener('change',()=>{if(reduced.matches){transition=1;stage.setPlaying(false);}},events);
  function dimensions(){
    const w=stage.width,h=stage.height;
    for(const canvas of [frame,...layers])if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const mobile=innerWidth<620&&!root.classList.contains('study-clean');
    return {w,h,artH:mobile?Math.min(320,h):h,mobile};
  }
  function paintWorld(canvas,world,w,h,artH,mobile){
    const ctx=canvas.getContext('2d'),c=chapters[current],white=world===1;
    ctx.fillStyle=white?'#eeeae2':'#101113';ctx.fillRect(0,0,w,h);
    const img=textures[world],fit=coverFit(img.width,img.height,w,artH);
    const zoom=c.zoom+(reduced.matches?0:Math.sin(stage.t*.23)*.004),dw=fit.width*zoom,dh=fit.height*zoom;
    // Anchor the optical eye during close-ups and the right-hand subject crop on phones.
    const x=w*.68-dw*.68,y=(artH-dh)*.48;
    ctx.save();ctx.beginPath();ctx.rect(0,0,w,artH);ctx.clip();ctx.drawImage(img,x,y,dw,dh);ctx.restore();
    const shade=ctx.createLinearGradient(0,0,w*.57,0);
    shade.addColorStop(0,white?'rgba(241,238,231,.84)':'rgba(8,9,10,.78)');shade.addColorStop(1,white?'rgba(241,238,231,0)':'rgba(8,9,10,0)');
    if(!mobile){ctx.fillStyle=shade;ctx.fillRect(0,0,w*.57,artH);}
    if(mobile){const fade=ctx.createLinearGradient(0,artH-65,0,artH);fade.addColorStop(0,white?'#eeeae200':'#10111300');fade.addColorStop(1,white?'#eeeae2':'#101113');ctx.fillStyle=fade;ctx.fillRect(0,artH-65,w,65);}
  }
  function render(dt){
    const {w,h,artH,mobile}=dimensions(),world=chapters[current].world==='white'?1:0;
    layers.forEach((canvas,i)=>paintWorld(canvas,i,w,h,artH,mobile));
    const ctx=frame.getContext('2d'),edge=Math.round(w*split);
    ctx.clearRect(0,0,w,h);ctx.drawImage(layers[world],0,0);
    ctx.save();ctx.beginPath();ctx.rect(edge,0,w-edge,artH);ctx.clip();ctx.drawImage(layers[1-world],0,0);ctx.restore();
    // A narrow glass boundary samples displaced strips of both spaces.
    for(let dx=-9;dx<9;dx+=2){
      const sx=clamp(edge+dx+Math.sin(dx/9*Math.PI)*10,0,w-2);
      ctx.globalAlpha=.55;ctx.drawImage(layers[dx<0?world:1-world],sx,0,2,artH,edge+dx,0,2,artH);
    }
    ctx.globalAlpha=1;ctx.fillStyle='#f9c48d';ctx.fillRect(edge,0,1,artH);
    if(mobile){
      const fade=ctx.createLinearGradient(0,artH-55,0,artH);
      fade.addColorStop(0,world?'#eeeae200':'#10111300');fade.addColorStop(1,world?'#eeeae2':'#101113');
      ctx.fillStyle=fade;ctx.fillRect(0,artH-55,w,55);
    }
    const scanY=artH*(.22+(Math.sin(stage.t*.28)+1)*.25);
    ctx.strokeStyle=world?'#90491730':'#efad6930';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(w*.53,scanY);ctx.lineTo(Math.min(edge-15,w*.87),scanY);ctx.stroke();
    if(transition<1){elapsed+=dt;transition=Math.min(1,elapsed/.85);}
    let remain=0;
    if(transition<1&&previous.width>1){
      const progress=transition*transition*(3-2*transition);remain=w*(1-progress);
      ctx.save();ctx.beginPath();ctx.rect(0,0,remain,h);ctx.clip();ctx.drawImage(previous,0,0,w,h);ctx.restore();
      ctx.fillStyle='#f3b77a';ctx.fillRect(remain,0,2,h);
    }
    const opacity=transition<1?.25+.75*transition:1;
    // Reveal new typography only over the matching world as the boundary passes.
    theater.style.setProperty('--optical-wipe',`${remain}px`);
    theater.style.setProperty('--optical-copy-opacity',String(opacity));bar.style.setProperty('--optical-copy-opacity',String(opacity));
    stage.ctx.clearRect(0,0,w,h);stage.ctx.drawImage(frame,0,0,w,h);
  }
  setSplit(split);syncCopy();
  return {
    scenes:{label:'PHASE / TWO WORLDS',kind:'CHAPTER',items:chapters.map((c,index)=>({id:c.id,title:c.title,image:c.image,active:()=>current===index,apply:()=>choose(index)}))},
    render,interact:flip,
    reset(){setSplit(.77);transition=1;elapsed=0;stage.dirty=true;},
    key(key){if(key==='ArrowRight')choose((current+1)%chapters.length);if(key==='ArrowLeft')choose((current+chapters.length-1)%chapters.length);},
    visibility(playing){if(!playing){transition=1;stage.dirty=true;}},
    resize(){transition=1;stage.dirty=true;},
    inspect:()=>({chapter:chapters[current].id,world:chapters[current].world,art:chapters[current].image,split,transition,texturesLoaded:textures.length,model:'dual-world-optical-boundary',disposed}),
    dispose(){disposed=true;abort.abort();for(const c of [frame,previous,...layers]){c.width=1;c.height=1;}}
  };
}
