import {foldingPanels,face,imageQuad,camera,renderFaces,mix,clamp,sub,cross,unit,add,mul,dot} from './math.mjs';
import {asset,image,offscreen,range,button} from './core.mjs';

// Taller walls fit the full 3:2 illustration. The original floor/pop-up net and
// the vertical hinges retain their rigid motion and shared attachment edges.
function paperPanels(open) {
  const panels=foldingPanels(open);
  for(const name of ['left','center','right'])panels[name]=panels[name].map(([x,y,z])=>[x,y>0?3:y,z]);
  return panels;
}
const mapPanel=(points,u,v)=>points[0].map((_,i)=>mix(mix(points[0][i],points[1][i],u),mix(points[3][i],points[2][i],u),v));

export async function create(stage,controls) {
  const chapters=JSON.parse(document.querySelector('#folding-chapters').textContent);
  const art=await Promise.all(chapters.map(chapter=>image(asset(chapter.image))));
  const textures=art.map(img=>[0,1,2].map(i=>{
    const c=offscreen(512,1024);
    c.getContext('2d').drawImage(img,i*img.width/3,0,img.width/3,img.height,0,0,512,1024);
    return c;
  }));
  const floors=chapters.map((chapter,index)=>{
    const c=offscreen(640,864),ctx=c.getContext('2d');
    ctx.fillStyle=chapter.floor;ctx.fillRect(0,0,640,864);
    ctx.strokeStyle=chapter.ink+'38';ctx.lineWidth=1;ctx.strokeRect(25,25,590,814);
    for(let y=45;y<800;y+=15){ctx.beginPath();ctx.moveTo(25,y);ctx.lineTo(615,y);ctx.stroke();}
    ctx.fillStyle=chapter.floor;ctx.fillRect(105,612,430,145);
    ctx.fillStyle=chapter.ink;ctx.textAlign='center';ctx.font='28px Georgia,serif';ctx.fillText('F O L I O',320,663);
    ctx.font='16px sans-serif';ctx.fillText('0'+(index+1)+'  /  '+chapter.title,320,703);
    return c;
  });
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const theater=document.querySelector('.theater'),hero=document.querySelector('.hero-copy');
  const coordinate=document.querySelector('.study-coordinate');
  let chapterIndex=0,target=chapters[0].pose.open,open=stage.playing ? .08 : target;
  let orbit=chapters[0].pose.orbit,auto=false,chapterTime=0;
  const holdSeconds=16;

  const edition=document.createElement('div');edition.className='folding-edition';
  edition.innerHTML='<span>纸间 <b>FOLIO</b></span><small>把远行，装订成册</small>';theater.append(edition);
  const folio=document.createElement('aside');folio.className='folding-folio';folio.setAttribute('aria-label','本章纸艺札记');
  folio.innerHTML='<div><span>PAPER NOTES</span><b></b></div><h2></h2><p></p>';theater.append(folio);
  const note=document.createElement('div');note.className='folding-note';
  note.innerHTML='<span></span><p></p><small></small>';theater.append(note);
  const mark=document.createElement('div');mark.className='folding-page-mark';mark.setAttribute('aria-hidden','true');theater.append(mark);
  const announcement=document.createElement('span');announcement.className='folding-announcement';
  announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');theater.append(announcement);

  const manual=()=>{auto=false;autoButton.setAttribute('aria-pressed','false');stage.dirty=true;};
  const input=range(controls,'展开程度',0,100,Math.round(target*100),1,v=>{target=v/100;manual();});
  button(controls,'收平 / 立起',()=>{target=target>.1?0:chapters[chapterIndex].pose.open;manual();});
  const orbitInput=range(controls,'观察角度',-55,55,Math.round(orbit*180/Math.PI),1,v=>{orbit=v*Math.PI/180;manual();});
  button(controls,'重展这一页',()=>select(chapterIndex));
  const autoButton=button(controls,'自动翻页',()=>{
    auto=!auto;chapterTime=0;autoButton.setAttribute('aria-pressed',String(auto));
    if(auto)stage.setPlaying(true);stage.dirty=true;
  });
  autoButton.setAttribute('aria-pressed','false');
  document.querySelector('.instrument-title span').textContent='THE PAPER DESK / 08';
  document.querySelector('.instrument-title strong').textContent='翻阅与折叠';
  document.querySelector('.stage').setAttribute('aria-label','纸间立体旅行刊物');

  function writeCopy() {
    const chapter=chapters[chapterIndex],number=String(chapterIndex+1).padStart(2,'0');
    document.body.dataset.chapter=chapter.id;document.body.style.setProperty('--accent',chapter.accent);
    theater.style.setProperty('--paper-ink',chapter.ink);hero.dataset.chapter=folio.dataset.chapter=chapter.id;
    const eyebrow=hero.querySelector('.eyebrow');eyebrow.replaceChildren();
    const title=document.createElement('span');title.textContent=chapter.kicker;
    const line=document.createElement('i'),tag=document.createElement('span');tag.textContent='TRAVEL JOURNAL';eyebrow.append(title,line,tag);
    [...hero.querySelector('h1').children].forEach((el,i)=>el.textContent=chapter.headline[i]);
    hero.querySelector('p').textContent=chapter.body;document.querySelector('#interact > span').textContent=chapter.action;
    folio.querySelector('b').textContent=number+' / 04';folio.querySelector('h2').textContent=chapter.feature;folio.querySelector('p').textContent=chapter.detail;
    note.querySelector('span').textContent=chapter.location+'  ·  '+chapter.time;note.querySelector('p').textContent=chapter.note;
    note.querySelector('small').textContent=chapter.annotation+'  /  拖动画面，换个角度';
    coordinate.querySelector('span').textContent='ISSUE 01 / SMALL JOURNEYS';coordinate.querySelector('b').textContent='一张纸，四次远行';mark.textContent=number;
    announcement.textContent='第 '+(chapterIndex+1)+' 章，共 4 章。'+chapter.title+'。'+chapter.headline.join('');
    stage.canvas.setAttribute('aria-label',chapter.title+'立体纸景。左右拖动或左右方向键改变视角，上下方向键控制展开程度。');
  }
  function select(index,{animate=true,continueAuto=false}={}) {
    chapterIndex=index;chapterTime=0;auto=continueAuto;target=chapters[index].pose.open;orbit=chapters[index].pose.orbit;
    // Art and prose switch atomically; the newly selected paper then unfolds.
    open=animate&&stage.playing&&!reduced.matches ? .08 : target;
    input.value=Math.round(target*100);orbitInput.value=Math.round(orbit*180/Math.PI);
    autoButton.setAttribute('aria-pressed',String(auto));writeCopy();stage.dirty=true;
  }
  const scenes={label:'THE FOLIO INDEX',kind:'CHAPTER',items:chapters.map((chapter,index)=>({
    ...chapter,apply:()=>select(index),active:()=>chapterIndex===index,
  }))};

  function drawPaper(ctx,w,h) {
    const chapter=chapters[chapterIndex],p=paperPanels(open),faces=[],archFaces=[];
    const cam=camera([Math.sin(orbit)*8.8,mix(.8,4.5,open),Math.cos(orbit)*8.8],[0,.25,mix(0,.65,open)],w,h,1.25);
    // Frame the whole connected sheet, including its lowered floor at 0%.
    const project=cam.project,points=Object.values(p).flat().map(v=>project(cam.view(v)));
    const xs=points.map(v=>v[0]),ys=points.map(v=>v[1]);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const scale=Math.min(1,(w-32)/(right-left),(h-36)/(bottom-top));
    cam.project=q=>{const [x,y]=project(q);return [(x-(left+right)/2)*scale+w/2,(y-(top+bottom)/2)*scale+h/2];};
    for(const [name,index] of [['left',0],['center',1],['right',2]]) {
      const normal=unit(cross(sub(p[name][1],p[name][0]),sub(p[name][2],p[name][0])));
      const back=p[name].map(v=>add(v,mul(normal,-.012)));
      if(dot(normal,sub(cam.eye,p[name][0]))>0)faces.push(...imageQuad([p[name][3],p[name][2],p[name][1],p[name][0]],textures[chapterIndex][index],4,8));
      else faces.push(face(back,'#d7ccb6'));
      for(let i=0;i<4;i++)faces.push(face([p[name][i],p[name][(i+1)%4],back[(i+1)%4],back[i]],'#ede3cd'));
    }
    faces.push(...imageQuad(p.floor,floors[chapterIndex],4,6));
    const at=(u,v)=>mapPanel(p.popup,u,v);
    for(const [u0,u1] of [[0,.13],[.87,1]])archFaces.push(face([at(u0,0),at(u1,0),at(u1,.55),at(u0,.55)],chapter.arch,{stroke:chapter.ink+'66'}));
    for(let i=0;i<24;i++) {
      const a=i/24*Math.PI,b=(i+1)/24*Math.PI;
      const outer=t=>at(.5+.5*Math.cos(t),.55+.45*Math.sin(t));
      const inner=t=>at(.5+.37*Math.cos(t),.55+.33*Math.sin(t));
      archFaces.push(face([outer(a),outer(b),inner(b),inner(a)],chapter.arch,{seamless:true}));
    }
    ctx.fillStyle='#ede8dc';ctx.fillRect(0,0,w,h);
    const light=ctx.createRadialGradient(w*.43,h*.4,10,w*.5,h*.5,w*.62);
    light.addColorStop(0,'#fbf8ef');light.addColorStop(1,'#e4ddcf');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(w*.5,h*.86);ctx.scale(1,.15);
    const shadow=ctx.createRadialGradient(0,0,0,0,0,w*.35);shadow.addColorStop(0,'#453a2630');shadow.addColorStop(1,'#453a2600');
    ctx.fillStyle=shadow;ctx.fillRect(-w*.5,-w*.5,w,w);ctx.restore();
    // At the flat endpoint the tab lies on its floor: paint that small overlay
    // last so equal-depth floor triangles cannot erase parts of the paper arch.
    if(open<.1){renderFaces(ctx,faces,cam);renderFaces(ctx,archFaces,cam);}
    else renderFaces(ctx,[...faces,...archFaces],cam);
    return p;
  }
  let panels=paperPanels(open);writeCopy();
  return {
    scenes,
    get static(){return !auto&&Math.abs(open-target)<.0001;},
    reset(){select(0,{animate:false});},
    interact(){select((chapterIndex+1)%chapters.length);},
    key(key){
      if(key==='ArrowUp')target=clamp(target+.05);if(key==='ArrowDown')target=clamp(target-.05);
      if(key==='ArrowLeft')orbit=clamp(orbit-.08,-55*Math.PI/180,55*Math.PI/180);
      if(key==='ArrowRight')orbit=clamp(orbit+.08,-55*Math.PI/180,55*Math.PI/180);manual();
    },
    pointer(p,e){if(p.down&&e.type==='pointermove'){orbit=clamp(orbit+p.dx*2.4,-55*Math.PI/180,55*Math.PI/180);manual();}},
    render(dt){
      if(auto&&dt){chapterTime+=dt;if(chapterTime>=holdSeconds)select((chapterIndex+1)%chapters.length,{continueAuto:true});}
      open=dt&&!reduced.matches?mix(open,target,1-Math.exp(-dt*4.5)):target;if(Math.abs(open-target)<.0001)open=target;
      input.value=Math.round(open*100);orbitInput.value=Math.round(orbit*180/Math.PI);panels=drawPaper(stage.ctx,stage.width,stage.height);
      stage.status(chapters[chapterIndex].title+' · 展开 '+Math.round(open*100)+'%'+(auto?' · 自动翻页':''));
    },
    inspect:()=>({open,target,orbit,auto,panels,model:'connected-hinge-net',chapter:chapters[chapterIndex].id,
      chapterIndex,chapterTime,holdSeconds,art:chapters[chapterIndex].image,text:chapters[chapterIndex].headline.join(''),texturesLoaded:art.length}),
  };
}
