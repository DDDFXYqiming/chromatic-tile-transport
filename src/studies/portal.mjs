import {camera,box,renderFaces,imageQuad,clamp} from './math.mjs';
import {asset,image,range,button,offscreen,coverFit} from './core.mjs';

// Catalog chapters are embedded by the builder, so art and copy share one source.
export async function create(stage,controls) {
  const chapters=JSON.parse(document.querySelector('#portal-chapters').textContent);
  const [art,patina]=await Promise.all([
    Promise.all(chapters.map(chapter=>image(asset(chapter.image)))),
    image(asset('studies/portal-patina.png')),
  ]);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const theater=document.querySelector('.theater'),hero=document.querySelector('.hero-copy');
  const eyebrow=hero.querySelector('.eyebrow'),heading=hero.querySelector('h1'),body=hero.querySelector('p');
  const stageTag=document.querySelector('.stage-tag'),coordinate=document.querySelector('.study-coordinate');
  const telemetry=document.querySelector('.telemetry');
  const before=offscreen(1,1),beforeContext=before.getContext('2d');
  let chapterIndex=0,progress=0,target=0,yaw=0,auto=false,custom=false;
  let transition=1,chapterTime=0,travelTime=0,copyPending=false;
  const transitionSeconds=1.2,holdSeconds=12;

  const edition=document.createElement('div');edition.className='portal-edition';
  edition.innerHTML='<span>彼处 <b>ELSEWHERE</b></span><small>空间声音手记 / CONCEPT JOURNAL</small>';
  theater.append(edition);
  const folio=document.createElement('aside');folio.className='portal-folio';
  folio.setAttribute('aria-label','本章产品札记');
  folio.innerHTML='<div class="portal-folio-top"><span></span><b></b></div><h2></h2><p></p><div class="portal-tags"></div>';
  theater.append(folio);
  const note=document.createElement('div');note.className='portal-note';
  note.innerHTML='<span>FROM THE FIELD</span><p></p><small></small>';
  theater.append(note);
  const chapterMark=document.createElement('div');chapterMark.className='portal-chapter-mark';
  chapterMark.setAttribute('aria-hidden','true');theater.append(chapterMark);
  hero.setAttribute('aria-live','polite');hero.setAttribute('aria-atomic','true');

  const slider=range(controls,'穿越进度',0,100,0,1,v=>{target=v/100;custom=true;auto=false;stage.dirty=true;});
  button(controls,'穿过画框',()=>select(1));
  button(controls,'回头看',()=>select(2));
  const roamButton=button(controls,'自动漫游',()=>{if(auto){auto=false;stage.dirty=true;}else select(3);});

  // Patinated jambs and threshold slabs surround the photographic environment.
  // The camera traverses z=0; the environment acts as a distant backdrop.
  const faces=[];
  for(const z of [0,-3]) {
    for(const [center,size] of [
      [[-4.65,2.2,z],[.18,7,.25]],[[4.65,2.2,z],[.18,7,.25]],
      [[0,5.65,z],[9.5,.15,.25]],[[0,-1.2,z],[9.5,.1,.4]],
    ])for(const side of box(center,size,'#756348'))faces.push(...imageQuad(side.points,patina,1,3));
  }

  function writeCopy() {
    const chapter=chapters[chapterIndex],number=String(chapterIndex+1).padStart(2,'0');
    document.body.style.setProperty('--accent',chapter.accent);
    document.body.dataset.chapter=chapter.id;
    hero.dataset.chapter=folio.dataset.chapter=chapter.id;
    eyebrow.replaceChildren();
    const name=document.createElement('span');name.textContent=chapter.english;
    const rule=document.createElement('i'),index=document.createElement('span');index.textContent=number+' / 04';
    eyebrow.append(name,rule,index);
    [...heading.children].forEach((line,i)=>line.textContent=chapter.headline[i]);
    body.textContent=chapter.body;
    document.querySelector('#interact > span').textContent=chapter.action;
    stageTag.replaceChildren();
    const dash=document.createElement('span'),tag=document.createElement('b');tag.textContent=chapter.kicker;
    stageTag.append(dash,document.createTextNode('ELSEWHERE / FIELD JOURNAL'),tag);
    coordinate.querySelector('span').textContent=chapter.coordinate;
    coordinate.querySelector('b').textContent=chapter.time;
    folio.querySelector('.portal-folio-top span').textContent='PRODUCT NOTE / '+number;
    folio.querySelector('.portal-folio-top b').textContent=chapter.location;
    folio.querySelector('h2').textContent=chapter.feature;
    folio.querySelector('p').textContent=chapter.detail;
    const tags=folio.querySelector('.portal-tags');tags.replaceChildren();
    for(const text of chapter.tags){const tag=document.createElement('span');tag.textContent=text;tags.append(tag);}
    note.querySelector('p').textContent=chapter.note;
    note.querySelector('small').textContent=chapter.location+' / '+chapter.time;
    chapterMark.textContent=number;
    telemetry.querySelector('.telemetry-bottom span').textContent=chapter.english;
    telemetry.setAttribute('aria-label','当前手记');
    roamButton.setAttribute('aria-pressed',String(auto));
  }

  function select(index,{continueRoam=false,animate=true}={}) {
    if(animate&&stage.playing&&!reduced.matches&&stage.frame>0){
      before.width=stage.canvas.width;before.height=stage.canvas.height;
      beforeContext.drawImage(stage.canvas,0,0);transition=0;
    }else transition=1;
    chapterIndex=index;custom=false;chapterTime=0;travelTime=0;
    const pose=chapters[index].pose;target=pose.progress;yaw=pose.yaw;
    auto=continueRoam||index===3;
    // A paused chapter selection stays paused, including the roaming chapter.
    if(!animate||!stage.playing||reduced.matches)progress=target;
    // Hold previous copy until the crossfade midpoint so art and text switch together.
    if(animate&&stage.playing&&!reduced.matches&&stage.frame>0)copyPending=true;
    else{copyPending=false;writeCopy();}
    stage.dirty=true;
  }
  function reset(){select(0,{animate:false});progress=0;slider.value=0;}
  const scenes={label:'THE FIELD ATLAS',kind:'JOURNAL',items:chapters.map((chapter,index)=>({
    ...chapter,apply:()=>select(index),active:()=>!custom&&chapterIndex===index,
  }))};
  function drawEnvironment(ctx,w,h) {
    const artwork=art[chapterIndex],p=stage.pointer;
    const drift=reduced.matches?0:Math.sin(stage.t*.11)*.009;
    const zoom=1.035+progress*.06+Math.sin(yaw)*.025;
    const fit=coverFit(artwork.width,artwork.height,w*zoom,h*zoom);
    const ox=(p.x-.5)*-13+drift*w,oy=(p.y-.5)*-9;
    ctx.drawImage(artwork,fit.x-(w*zoom-w)*.5+ox,fit.y-(h*zoom-h)*.5+oy,fit.width,fit.height);
    ctx.save();ctx.globalAlpha=.3;
    // Keep the foreground architecture at the periphery of the content aperture.
    ctx.beginPath();ctx.rect(0,0,w*.09,h);ctx.rect(w*.91,0,w*.09,h);ctx.rect(0,0,w,h*.035);ctx.rect(0,h*.965,w,h*.035);ctx.clip();
    const eye=[(p.x-.5)*.55,1.68+(p.y-.5)*-.2,5.7-progress*10.1];
    const cam=camera(eye,[eye[0]+Math.sin(yaw),eye[1],eye[2]-Math.cos(yaw)],w,h,.86);
    if(w>600)renderFaces(ctx,faces,cam);ctx.restore();
    const shade=ctx.createLinearGradient(0,0,w,0);
    shade.addColorStop(0,'#061113ee');shade.addColorStop(.2,'#071418ba');shade.addColorStop(.49,'#07141815');shade.addColorStop(1,'#06101805');
    ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    const bottom=ctx.createLinearGradient(0,h*.45,0,h);
    bottom.addColorStop(0,'#06111300');bottom.addColorStop(1,'#061113b3');
    ctx.fillStyle=bottom;ctx.fillRect(0,0,w,h);
  }
  writeCopy();
  return {
    scenes,reset,interact:()=>select((chapterIndex+1)%chapters.length),
    key(key){custom=true;auto=false;if(key==='ArrowUp')target=clamp(target+.08);if(key==='ArrowDown')target=clamp(target-.08);if(key==='ArrowLeft')yaw-=.12;if(key==='ArrowRight')yaw+=.12;},
    render(dt){
      if(auto&&dt){
        chapterTime+=dt;travelTime+=dt;
        if(chapterTime>=holdSeconds)select((chapterIndex+1)%chapters.length,{continueRoam:true});
        target=clamp(chapters[chapterIndex].pose.progress+Math.sin(travelTime*.28)*.16);
      }
      progress=dt?progress+(target-progress)*(1-Math.exp(-dt*3)):target;
      slider.value=String(Math.round(progress*100));
      const {ctx,width:w,height:h}=stage;
      ctx.clearRect(0,0,w,h);drawEnvironment(ctx,w,h);
      transition=(!stage.playing||reduced.matches)?1:Math.min(1,transition+dt/transitionSeconds);
      const blend=transition*transition*(3-2*transition);
      if(copyPending&&blend>=.5){writeCopy();copyPending=false;}
      // Fade old copy out, then new copy in around the same midpoint as the art mix.
      const enter=copyPending?(1-Math.min(1,blend*2)):((!stage.playing||reduced.matches||transition>=1)?1:Math.min(1,Math.max(0,(blend-.5)*2)));
      theater.style.setProperty('--chapter-enter',String(enter));
      if(transition<1){
        ctx.save();ctx.globalAlpha=1-blend;
        const scale=1+blend*.075;ctx.translate(w/2,h/2);ctx.scale(scale,scale);
        ctx.drawImage(before,-w/2,-h/2,w,h);ctx.restore();
        ctx.save();ctx.globalAlpha=Math.sin(transition*Math.PI)*.25;
        ctx.strokeStyle=chapters[chapterIndex].accent;ctx.lineWidth=1;
        const aperture=.22+blend*.82;ctx.strokeRect(w*(1-aperture)*.5,h*(1-aperture)*.5,w*aperture,h*aperture);ctx.restore();
      }
      roamButton.setAttribute('aria-pressed',String(auto));
      const chapter=chapters[chapterIndex];
      stage.status(chapter.location+' · '+chapter.time+(auto?' · 漫游中':' · 手记已展开'));
    },
    inspect:()=>({progress,target,auto,z:5.7-progress*10.1,faces:faces.length,yaw,
      chapter:chapters[chapterIndex].id,chapterIndex,chapterTime,transition,
      art:chapters[chapterIndex].image,text:chapters[chapterIndex].headline.join(''),
      texturesLoaded:art.length+1,transitionSeconds,holdSeconds}),
  };
}
