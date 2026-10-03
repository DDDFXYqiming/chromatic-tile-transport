import {clamp} from './math.mjs';
import {asset,image,range,button} from './core.mjs';
import {createArchitecture,STOPS,DOORS,APERTURE,EYE_HEIGHT,routeX,roomAt} from './portal-scene.mjs';
import {createTravel} from './portal-travel.mjs';

export async function create(stage,controls) {
  const chapters=JSON.parse(document.querySelector('#portal-chapters').textContent);
  const art=await Promise.all(chapters.map(chapter=>image(asset(chapter.image))));
  const patina=await image(asset('studies/portal-patina.png'));
  const architecture=createArchitecture(art,patina),travel=createTravel(STOPS[0],DOORS);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const theater=document.querySelector('.theater'),hero=document.querySelector('.hero-copy');
  const eyebrow=hero.querySelector('.eyebrow'),heading=hero.querySelector('h1'),body=hero.querySelector('p');
  const stageTag=document.querySelector('.stage-tag'),coordinate=document.querySelector('.study-coordinate');
  const telemetry=document.querySelector('.telemetry');
  let chapterIndex=0,destination=0,yaw=0,yawTarget=0,auto=false,chapterTime=0,direction=1;
  const holdSeconds=8;

  const edition=document.createElement('div');edition.className='portal-edition';
  edition.innerHTML='<span>彼处 <b>ELSEWHERE</b></span><small>空间声音手记 / CONCEPT JOURNAL</small>';
  theater.append(edition);
  const folio=document.createElement('aside');folio.className='portal-folio';
  folio.setAttribute('aria-label','本章产品札记');
  folio.innerHTML='<div class="portal-folio-top"><span></span><b></b></div><h2></h2><p></p><div class="portal-tags"></div>';
  theater.append(folio);
  const note=document.createElement('div');note.className='portal-note';
  note.innerHTML='<span>FROM THE FIELD</span><p></p><small></small>';theater.append(note);
  const chapterMark=document.createElement('div');chapterMark.className='portal-chapter-mark';
  chapterMark.setAttribute('aria-hidden','true');theater.append(chapterMark);
  hero.setAttribute('aria-live','polite');hero.setAttribute('aria-atomic','true');
  const route=document.createElement('div');route.className='portal-route';route.setAttribute('aria-label','展室行走路线');
  route.innerHTML='<span>01</span><i><b></b><em></em><em></em><em></em></i><span>04</span><output></output>';theater.append(route);
  for(const [i,mark] of [...route.querySelectorAll('em')].entries())mark.style.left=((STOPS[0]-DOORS[i])/(STOPS[0]-STOPS[3])*100)+'%';

  const slider=range(controls,'穿越进度',0,100,0,.1,v=>{
    auto=false;chapterTime=0;
    travel.seek(STOPS[0]+(STOPS[3]-STOPS[0])*v/100);destination=roomAt(travel.z);stage.dirty=true;
  });
  button(controls,'穿过下一扇门',()=>select((destination+1)%4));
  const turnButton=button(controls,'回头看',()=>{yawTarget=yawTarget===0?Math.PI:0;auto=false;stage.dirty=true;});
  const roamButton=button(controls,'自动漫游',()=>{auto=!auto;chapterTime=0;if(auto)stage.setPlaying(true);stage.dirty=true;});

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

  function select(index,{continueRoam=false}={}) {
    destination=index;auto=continueRoam;chapterTime=0;
    // The existing pose is the start of every trip, including an interrupted trip.
    travel.go(STOPS[index]);
    yawTarget=STOPS[index]>travel.z+.1?Math.PI:0;
    if(reduced.matches){travel.seek(STOPS[index]);yaw=yawTarget;}
    stage.dirty=true;
  }
  function reset(){travel.seek(STOPS[0]);destination=0;chapterIndex=0;yaw=yawTarget=0;auto=false;chapterTime=0;direction=1;slider.value=0;writeCopy();stage.dirty=true;}
  const scenes={label:'THE FIELD ATLAS',kind:'JOURNAL',items:chapters.map((chapter,index)=>({
    ...chapter,apply:()=>select(index),active:()=>chapterIndex===index,
  }))};
  writeCopy();
  return {
    scenes,reset,interact:()=>select((destination+1)%chapters.length),
    key(key){
      auto=false;chapterTime=0;
      if(key==='ArrowUp'||key==='ArrowDown')travel.go(clamp(travel.target+(key==='ArrowUp'?-1:1)*Math.cos(yawTarget)*1.2,STOPS[3],STOPS[0]));
      if(key==='ArrowLeft')yawTarget-=.15;
      if(key==='ArrowRight')yawTarget+=.15;
      destination=roomAt(travel.target);
    },
    render(dt){
      // Turning finishes before returning along the same physical corridor.
      yaw+=clamp(yawTarget-yaw,-dt*.85,dt*.85);
      const turning=Math.abs(yawTarget-yaw)>.12;
      if(turning)travel.brake(dt);
      else travel.step(dt);
      if(auto&&dt&&!travel.moving&&!turning){
        chapterTime+=dt;
        if(chapterTime>=holdSeconds){
          if(destination===3)direction=-1;if(destination===0)direction=1;
          select(destination+direction,{continueRoam:true});
        }
      }
      const current=roomAt(travel.z);
      if(current!==chapterIndex){chapterIndex=current;writeCopy();}
      const progress=(STOPS[0]-travel.z)/(STOPS[0]-STOPS[3]);
      slider.value=String((progress*100).toFixed(1));
      const {ctx,width:w,height:h,pointer:p}=stage;
      const eye=[routeX(travel.z)+(reduced.matches?0:(p.x-.5)*.18),EYE_HEIGHT+(reduced.matches?0:(p.y-.5)*-.08),travel.z];
      architecture.render(stage.canvas.width,stage.canvas.height,eye,yaw,reduced.matches?0:stage.t);
      ctx.drawImage(architecture.canvas,0,0,w,h);
      theater.dataset.travelling=String(travel.moving||turning);
      route.style.setProperty('--travel',String(progress));
      route.querySelector('output').textContent=(travel.moving?'行走至 '+chapters[destination].title:chapters[chapterIndex].title)+' / '+(STOPS[0]-travel.z).toFixed(1)+' m';
      roamButton.setAttribute('aria-pressed',String(auto));turnButton.setAttribute('aria-pressed',String(Math.cos(yaw)<0));
      // DOM telemetry is also useful when comparing reproducible threshold frames.
      stage.canvas.dataset.cameraZ=travel.z.toFixed(3);
      stage.canvas.dataset.room=String(chapterIndex+1);
      stage.canvas.dataset.travel=travel.moving?'moving':'settled';
      stage.canvas.dataset.renderer='webgl-depth';
      stage.status(chapters[chapterIndex].location+' · Z '+travel.z.toFixed(2)+' m'+(!stage.playing&&(travel.moving||turning)?' · 待继续':turning?' · 转身中':travel.moving?' · 穿门中':auto?' · 漫游中':' · 已抵达'));
    },
    inspect:()=>({progress:(STOPS[0]-travel.z)/(STOPS[0]-STOPS[3]),z:travel.z,targetZ:travel.target,velocity:travel.velocity,
      chapter:chapters[chapterIndex].id,chapterIndex,destination,yaw,auto,chapterTime,
      renderer:'webgl-depth',rooms:4,doorPlanes:DOORS,aperture:APERTURE,eyeHeight:EYE_HEIGHT,
      insideDoor:DOORS.findIndex(z=>Math.abs(travel.z-z)<APERTURE.depth/2),
      triangles:architecture.triangles,texturesLoaded:art.length+1,
      imageSurfaces:['room-walls','ceiling','water','outcrops','copper-portals'],holdSeconds}),
    dispose:()=>architecture.dispose(),
  };
}
