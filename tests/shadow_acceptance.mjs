/** Read-only acceptance audit shared by browser-control and automated runners. */
export function auditShadowPage() {
  const checks=[];
  const check=(name,value)=>{if(!value)throw new Error(name);checks.push(name);};
  const state=window.VisualStudy.inspect();
  const chapters=JSON.parse(document.querySelector('#shadow-chapters').textContent);
  const c=chapters.find(c=>c.id===state.chapter);
  const canvas=document.querySelector('#canvas'),r=canvas.getBoundingClientRect();
  const footer=document.querySelector('.study-footer').getBoundingClientRect();
  check('all four original chapter artworks decoded',state.texturesLoaded===4);
  check('current chapter has actually painted',state.renderedChapter===c.id);
  check('three independent lights share the full-page receiver',state.shadowDirections===3&&state.receiver==='full-viewport');
  check('two typographic planes and two image planes rendered',state.contentPlanes===4);
  check('canvas spans the page width and height',r.width>=innerWidth-1&&r.height>=innerHeight-1&&Math.abs(r.left)<1&&Math.abs(r.top)<1);
  check('no horizontal document overflow',document.documentElement.scrollWidth<=innerWidth+1);
  check('headline follows the selected chapter',document.querySelector('h1').textContent===c.headline.join(''));
  check('chapter narrative synchronized',document.querySelector('.hero-copy>p').textContent===c.body);
  check('artwork caption synchronized',document.querySelector('.shadow-caption p').textContent===c.note);
  check('spatial note synchronized',document.querySelector('.shadow-note p').textContent===c.detail);
  check('reading block clears content navigation',document.querySelector('.shadow-note').getBoundingClientRect().bottom<footer.top);
  check('filmstrip points to current chapter',document.querySelector('.study-card[aria-current]').dataset.scene===c.id);
  check('all eight peer experiences remain linked',document.querySelectorAll('.hall-modes>a').length===8);
  const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let low=255,high=0,hash=2166136261;
  for(let i=0;i<data.length;i+=388){const value=data[i];low=Math.min(low,value);high=Math.max(high,value);hash=Math.imul(hash^value,16777619)>>>0;}
  check('live receiver contains rendered artwork and typography',high-low>80);
  return {checks,state,viewport:{width:innerWidth,height:innerHeight},canvasHash:hash};
}
