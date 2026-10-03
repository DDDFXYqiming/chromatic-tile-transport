import {clamp} from './math.mjs';

// Artwork-space contours: powder, the inside of the glass, the painted wash,
// and the light on the worktable. These move with coverFit at every viewport.
const contours={
  mineral:[
    [[.30,.58],[.38,.55],[.47,.62],[.56,.59],[.66,.66],[.76,.72],[.88,.70],[.98,.77],[.98,.90],[.76,.90],[.55,.82],[.38,.70],[.30,.65]],
    [[.65,.52],[.74,.49],[.81,.52],[.82,.59],[.94,.60],[.88,.63],[.74,.61],[.67,.57]],
  ],
  ink:[[[.425,.15],[.96,.15],[.965,.73],[.94,.79],[.78,.805],[.54,.78],[.425,.70]]],
  paper:[[[.39,.55],[.47,.41],[.61,.37],[.72,.20],[.90,.12],[.94,.24],[1,.24],[1,.98],[.82,.99],[.70,.93],[.61,.91],[.51,.80],[.47,.69],[.40,.65]]],
  light:[[[.18,.70],[.46,.61],[.55,.65],[.78,.72],[.96,.75],[.96,.83],[.70,.88],[.50,.87],[.21,.93],[.16,.86]]],
};

function featheredPolygon(points,x,y){
  let inside=false,distance=Infinity;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,ay]=points[j],[bx,by]=points[i],dx=bx-ax,dy=by-ay;
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    const t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,y-ay-t*dy));
  }
  const t=inside?clamp(distance/.018):0;
  return t*t*(3-2*t);
}

export function regionWeight(chapter,x,y){
  if(chapter==='local')return clamp((1-((x-.5)/.42)**2-((y-.5)/.42)**2)*6);
  return Math.max(0,...(contours[chapter]||[]).map(p=>featheredPolygon(p,x,y)));
}

// Colour gating excludes dark tabletop, copper and unpainted paper inside the
// broad contours. It is sampled once on image load, never read back per frame.
export function pigmentWeight(chapter,x,y,r,g,b,a=255){
  let colour=1;
  if(chapter==='mineral')colour=clamp((Math.max(g,b)-r-8)/22);
  if(chapter==='paper')colour=clamp((r-g-24)/30);
  if(chapter==='light')colour=clamp((r-b-26)/55);
  return regionWeight(chapter,x,y)*colour*a/255;
}
