import {asset} from './core.mjs';

// Each effect owns its presets and predicates; this shell only presents them.
export function filmstrip(stage, scenes) {
  const footer=document.querySelector('.study-footer'),strip=footer.querySelector('.study-strip');
  const id=document.body.dataset.study,items=scenes.items;
  document.querySelector('#study-atlas-label').textContent=scenes.label;
  document.querySelector('#study-total').textContent='/ '+String(items.length).padStart(2,'0');
  strip.style.setProperty('--scene-count',items.length);
  let current=-2;
  const reveal=button=>{const a=button.getBoundingClientRect(),b=strip.getBoundingClientRect();strip.scrollLeft+=a.left-b.left-(strip.clientWidth-a.width)/2;};
  const buttons=items.map((item,index)=>{
    const button=document.createElement('button');button.type='button';button.className='hall-card study-card';button.dataset.scene=item.id;
    const thumb=document.createElement('span');thumb.className='hall-thumb';
    const img=document.createElement('img');img.src=asset(item.image || `studies/filmstrip/${id}-${item.id}.webp`);img.alt='';img.width=160;img.height=96;thumb.append(img);
    const copy=document.createElement('span');copy.className='hall-card-copy';
    const number=document.createElement('small');number.textContent=String(index+1).padStart(2,'0')+' / '+scenes.kind;
    const title=document.createElement('strong');title.textContent=item.title;copy.append(number,title);button.append(thumb,copy);
    button.addEventListener('click',()=>{item.apply();stage.dirty=true;sync();reveal(button);});
    // Editorial strips keep a pointer target still until its click is delivered.
    button.addEventListener('focus',()=>{if(!['portal','temporal','fluid','folding'].includes(id)||button.matches(':focus-visible'))reveal(button);});strip.append(button);return button;
  });
  function sync(){
    const index=items.findIndex(item=>item.active());
    if(index===current)return;
    current=index;
    buttons.forEach((button,i)=>{button.setAttribute('aria-pressed',String(i===index));if(i===index)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
    document.querySelector('#study-current').textContent=index<0?'—':String(index+1).padStart(2,'0');
    footer.style.setProperty('--hall-position',Math.max(0,index)/(items.length-1));
    footer.classList.toggle('study-custom',index<0);
    if(index>=0)reveal(buttons[index]);
  }
  document.querySelector('#study-prev').addEventListener('click',()=>buttons[(Math.max(0,current)-1+items.length)%items.length].click());
  document.querySelector('#study-next').addEventListener('click',()=>buttons[(current+1)%items.length].click());
  stage.onRendered=sync;sync();
}
