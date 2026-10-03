import {clamp} from './math.mjs';
import {range,button} from './core.mjs';
import {exhibitionRenderer} from './shadow-apparatus.mjs';

export async function create(stage,controls) {
  const chapters=JSON.parse(document.querySelector('#shadow-chapters').textContent);
  const renderer=exhibitionRenderer(chapters),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const theater=document.querySelector('.theater'),hero=document.querySelector('.hero-copy');
  let chapterIndex=0,angle=0,view=0,strength=.9,time=0,auto=true,age=0,dragging=false;
  const edition=document.createElement('div');edition.className='shadow-edition';edition.innerHTML='<span>半影 <i>／</i> PENUMBRA</span><small>光的三重奏 · A SPATIAL ANTHOLOGY</small>';theater.append(edition);
  const caption=document.createElement('div');caption.className='shadow-caption';caption.innerHTML='<small></small><p></p>';theater.append(caption);
  const note=document.createElement('div');note.className='shadow-note';note.innerHTML='<span></span><p></p>';theater.append(note);
  const index=document.createElement('div');index.className='shadow-index';index.innerHTML='<b>01</b><span>光有来处<br>影无定形</span>';theater.append(index);
  const reading=document.createElement('section');reading.className='shadow-reading';reading.innerHTML='<h3></h3><p></p><p></p>';document.querySelector('#about h2').after(reading);
  const directions=document.createElement('div');directions.className='shadow-directions';directions.innerHTML='<span>Ⅰ <i></i> 青光</span><span>Ⅱ <i></i> 绯光</span><span>Ⅲ <i></i> 金光</span>';theater.append(directions);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='shadow-settings';toggle.textContent='调光 ↗';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','shadow-instruments');theater.append(toggle);
  const bar=document.querySelector('.instrument-bar');bar.id='shadow-instruments';bar.hidden=true;
  toggle.addEventListener('click',()=>{bar.hidden=!bar.hidden;toggle.setAttribute('aria-expanded',String(!bar.hidden));});
  bar.addEventListener('keydown',e=>{if(e.key==='Escape'){bar.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}});
  document.querySelector('.instrument-title strong').textContent='光的三重奏';
  document.querySelector('.instrument-title>span').textContent='PENUMBRA / 07';
  hero.setAttribute('aria-live','polite');hero.setAttribute('aria-atomic','true');
  stage.canvas.setAttribute('aria-label','半影空间展。三束光照亮铜质雕塑与浮字。拖动改变光向和视角，左右方向键调光，上下方向键转动雕塑。');
  const angleInput=range(controls,'光的方向',-180,180,0,1,v=>{angle=v*Math.PI/180;age=0;stage.dirty=true;});
  const viewInput=range(controls,'观察角度',-1,1,0,.05,v=>{view=v;age=0;stage.dirty=true;});
  const strengthInput=range(controls,'影的浓度',.2,1,.9,.05,v=>{strength=v;stage.dirty=true;});
  const autoButton=button(controls,'自动换章',()=>{auto=!auto;autoButton.setAttribute('aria-pressed',String(auto));age=0;});autoButton.setAttribute('aria-pressed','true');
  function select(i){chapterIndex=(i+chapters.length)%chapters.length;age=0;angle=chapterIndex*.5;const c=chapters[chapterIndex];
    document.body.dataset.chapter=c.id;document.body.style.setProperty('--accent',c.accent);
    hero.querySelector('.eyebrow').textContent=c.kicker;[...hero.querySelector('h1').children].forEach((el,j)=>el.textContent=c.headline[j]);
    hero.querySelector('p').textContent=c.body;document.querySelector('#interact>span').textContent=c.action;
    caption.querySelector('small').textContent=c.material;caption.querySelector('p').textContent=c.note;
    note.querySelector('span').textContent=c.feature;note.querySelector('p').textContent=c.detail;
    reading.querySelector('h3').textContent=c.title;reading.querySelectorAll('p')[0].textContent=c.body;reading.querySelectorAll('p')[1].textContent=c.detail;
    index.querySelector('b').textContent=String(chapterIndex+1).padStart(2,'0');stage.status(c.title);stage.dirty=true;
  }
  const motionChange=()=>{if(reduced.matches)stage.setPlaying(false);stage.dirty=true;};reduced.addEventListener('change',motionChange);
  select(0);
  return {
    scenes:{label:'FOUR SHADOW POEMS',kind:'篇',items:chapters.map((c,i)=>({...c,apply:()=>select(i),active:()=>chapterIndex===i}))},
    interact(){select(chapterIndex+1);},reset(){view=0;time=0;strength=.9;strengthInput.value='.9';select(chapterIndex);},
    key(key){if(key==='ArrowRight')angle+=.08;if(key==='ArrowLeft')angle-=.08;if(key==='ArrowUp')view=clamp(view+.1,-1,1);if(key==='ArrowDown')view=clamp(view-.1,-1,1);age=0;},
    pointer(p){if(p.down){if(dragging){angle+=p.dx*3;view=clamp(view+p.dy,-1,1);}dragging=true;age=0;}},release(){dragging=false;},
    render(dt){if(dt&&!reduced.matches&&!dragging){time+=dt;angle+=dt*.18;age+=dt;if(auto&&age>=22)select(chapterIndex+1);}
      angleInput.value=String(Math.round(Math.atan2(Math.sin(angle),Math.cos(angle))*180/Math.PI));viewInput.value=String(view);
      renderer.draw(stage.ctx,stage.width,stage.height,{chapter:chapterIndex,angle,view,time,strength});
    },
    inspect:()=>({chapter:chapters[chapterIndex].id,art:chapters[chapterIndex].image,angle,view,strength,auto,age,time,renderer:'multi-light-sculpture-exhibition',...renderer.inspect()}),
    dispose(){reduced.removeEventListener('change',motionChange);},
  };
}
