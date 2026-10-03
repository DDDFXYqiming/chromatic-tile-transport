import {clamp} from './math.mjs';
import {bilinear} from './core.mjs';

export const POINTER_WEIGHT=.15;

// Artwork-space contours: powder, the inside of the glass, the painted wash,
// and the light on the worktable. These move with coverFit at every viewport.
const contours={
  mineral:[
    [[.32,.59],[.39,.58],[.47,.65],[.57,.63],[.63,.65],[.67,.72],[.77,.76],[.81,.73],[.89,.74],[.94,.79],[.95,.88],[.79,.89],[.69,.84],[.61,.84],[.53,.80],[.47,.73],[.37,.69],[.32,.65]],
    [[.645,.55],[.68,.525],[.74,.53],[.81,.59],[.87,.595],[.90,.607],[.86,.615],[.76,.60],[.69,.585]],
  ],
  ink:[[[.45,.165],[.93,.165],[.945,.69],[.92,.755],[.78,.775],[.56,.75],[.45,.67]]],
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
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return 0;
  if(chapter==='local')return clamp((1-((x-.5)/.42)**2-((y-.5)/.42)**2)*6);
  return Math.max(0,...(contours[chapter]||[]).map(p=>featheredPolygon(p,x,y)));
}

// Colour gating excludes dark tabletop, copper and unpainted paper inside the
// broad contours. It is sampled once on image load, never read back per frame.
export function pigmentWeight(chapter,x,y,r,g,b,a=255){
  let colour=1;
  if(chapter==='mineral')colour=clamp((Math.max(g,b)-r-8)/22)*clamp((Math.max(g,b)-55)/35);
  if(chapter==='ink')colour=clamp((b-r-12)/24);
  if(chapter==='paper')colour=clamp((r-g-24)/30);
  if(chapter==='light')colour=clamp((r-b-26)/55)*clamp((r-105)/80)*clamp((g-70)/65);
  return regionWeight(chapter,x,y)*colour*a/255;
}

// All consumers share artwork coordinates and one colour mask. Bilinear
// filtering may soften an interior edge, but must not expand its support.
export function pigmentRegion(chapter,pixels,w,h){
  const weights=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const k=y*w+x,i=k*4;
    weights[k]=pigmentWeight(chapter,(x+.5)/w,(y+.5)/h,...pixels.subarray(i,i+4));
  }
  return (x,y)=>{
    const contour=regionWeight(chapter,x,y);
    if(!contour)return 0;
    const cell=Math.min(h-1,Math.floor(y*h))*w+Math.min(w-1,Math.floor(x*w));
    if(!weights[cell])return 0;
    return Math.min(contour,bilinear(weights,w,h,x*w-.5,y*h-.5,0,1));
  };
}

// Use the raw client position, including captured pointers outside the stage.
// fit is the same image rectangle used to draw the current artwork.
export function hitRegion(client,rect,fit,weight,overlays=[]){
  const {x,y}=client;
  if(!Number.isFinite(x)||!Number.isFinite(y)||rect.width<=0||rect.height<=0||
    x<rect.left||x>rect.right||y<rect.top||y>rect.bottom||
    overlays.some(b=>x>=b.left-4&&x<=b.right+4&&y>=b.top-4&&y<=b.bottom+4))return null;
  const q={x:(x-rect.left-fit.x)/fit.width,y:(y-rect.top-fit.y)/fit.height};
  return weight(q.x,q.y)>POINTER_WEIGHT?q:null;
}

export function pigmentStroke(weight,a,b,w=120,h=80){
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(b.x-a.x)*w,Math.abs(b.y-a.y)*h)*2));
  for(let i=0;i<=steps;i++)if(weight(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps)<=POINTER_WEIGHT)return false;
  return true;
}
