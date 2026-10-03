import {clamp} from './math.mjs';
import {asset,image,sampleImage,offscreen,range,button,fileInput,caption,coverFit,sourcePointer} from './core.mjs';
/** Semi-Lagrangian velocity transport + pressure projection, in grid-cell units. */
export class Fluid {
  constructor(w=96,h=60) {
    this.w=w;this.h=h;this.stride=w+2;this.size=(w+2)*(h+2);
    for(const k of ['u','v','u0','v0','p','p0','div'])this[k]=new Float32Array(this.size);
  }
  boundary(a,type=0) {
    const {w,h,stride:s}=this;
    for(let x=1;x<=w;x++){a[x]=type===2?-a[s+x]:a[s+x];a[(h+1)*s+x]=type===2?-a[h*s+x]:a[h*s+x];}
    for(let y=1;y<=h;y++){a[y*s]=type===1?-a[y*s+1]:a[y*s+1];a[y*s+w+1]=type===1?-a[y*s+w]:a[y*s+w];}
    a[0]=(a[1]+a[s])*.5;a[w+1]=(a[w]+a[w+1+s])*.5;
    a[(h+1)*s]=(a[h*s]+a[(h+1)*s+1])*.5;a[(h+1)*s+w+1]=(a[h*s+w+1]+a[(h+1)*s+w])*.5;
  }
  sample(a,x,y){const s=this.stride;x=clamp(x,.5,this.w+.5);y=clamp(y,.5,this.h+.5);const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,k=j*s+i;return (a[k]*(1-u)+a[k+1]*u)*(1-v)+(a[k+s]*(1-u)+a[k+s+1]*u)*v;}
  project(iterations=20) {
    const {w,h,stride:s,u,v,div}=this;this.p.fill(0);this.p0.fill(0);
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x;div[i]=-.5*(u[i+1]-u[i-1]+v[i+s]-v[i-s]);}
    this.boundary(div);
    for(let k=0;k<iterations;k++){
      const p=this.p,q=this.p0;
      for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x;q[i]=(div[i]+p[i-1]+p[i+1]+p[i-s]+p[i+s])*.25;}
      this.boundary(q);this.p=q;this.p0=p;
    }
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x;u[i]-=.5*(this.p[i+1]-this.p[i-1]);v[i]-=.5*(this.p[i+s]-this.p[i-s]);}
    this.boundary(u,1);this.boundary(v,2);
  }
  step(dt,damping=.6) {
    this.u0.set(this.u);this.v0.set(this.v);const {w,h,stride:s}=this;
    const decay=Math.exp(-damping*dt);
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*s+x,px=x-dt*this.u0[i],py=y-dt*this.v0[i];this.u[i]=this.sample(this.u0,px,py)*decay;this.v[i]=this.sample(this.v0,px,py)*decay;}
    this.boundary(this.u,1);this.boundary(this.v,2);this.project();
  }
  splat(x,y,dx,dy,radius=.14) {
    for(let j=1;j<=this.h;j++)for(let i=1;i<=this.w;i++) {
      const r2=((i/this.w-x)**2+(j/this.h-y)**2)/(radius*radius),f=Math.exp(-r2*3);
      if(f<.001)continue;const k=j*this.stride+i;
      this.u[k]=clamp(this.u[k]+dx*this.w*f*12,-170,170);this.v[k]=clamp(this.v[k]+dy*this.h*f*12,-170,170);
    }
  }
  divergenceEnergy(){let v=0;const s=this.stride;for(let y=2;y<this.h;y++)for(let x=2;x<this.w;x++){const i=y*s+x;v+=(this.u[i+1]-this.u[i-1]+this.v[i+s]-this.v[i-s])**2;}return v;}
}
export async function create(stage,controls) {
  const W=432,H=270,fluid=new Fluid(),small=offscreen(W,H),cx=small.getContext('2d');
  let original=await image(asset('studies/tidal-garden.svg')),dye=new Float32Array(W*H*4),next=new Float32Array(dye.length),output=new ImageData(W,H),damping=.6;
  let steps=0,acc=0,last=null,sourceName='原创矢量画 · 潮汐花园',generation=0;
  function reset(){dye.set(sampleImage(original,W,H).data);for(const k of ['u','v','u0','v0','p','p0','div'])fluid[k].fill(0);steps=0;acc=0;stage.dirty=true;}
  reset();
  range(controls,'动量衰减',.1,2,.6,.1,v=>damping=v);
  button(controls,'轻推颜料',()=>{fluid.splat(.35,.54,.08,-.045);fluid.splat(.66,.43,-.06,.05);stage.dirty=true;});
  fileInput(controls,'换一张图片','image/png,image/jpeg,image/webp',16,async file=>{const ticket=++generation,url=URL.createObjectURL(file);try{const img=await image(url);if(ticket!==generation)return;original=img;sourceName=file.name;reset();}finally{URL.revokeObjectURL(url);}});
  function transport(dt) {
    fluid.step(dt,damping);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const vx=fluid.sample(fluid.u,x/W*fluid.w+.5,y/H*fluid.h+.5),vy=fluid.sample(fluid.v,x/W*fluid.w+.5,y/H*fluid.h+.5);
      const sx=clamp(x-vx*dt*W/fluid.w,0,W-1),sy=clamp(y-vy*dt*H/fluid.h,0,H-1),a=Math.floor(sx),b=Math.floor(sy),u=sx-a,v=sy-b;
      const p=(b*W+a)*4,q=(b*W+Math.min(W-1,a+1))*4,r=(Math.min(H-1,b+1)*W+a)*4,s=(Math.min(H-1,b+1)*W+Math.min(W-1,a+1))*4,k=(y*W+x)*4;
      for(let ch=0;ch<3;ch++)next[k+ch]=(dye[p+ch]*(1-u)+dye[q+ch]*u)*(1-v)+(dye[r+ch]*(1-u)+dye[s+ch]*u)*v;
      next[k+3]=255;
    }
    [dye,next]=[next,dye];steps++;
  }
  return {reset,pointer(p){if(!p.down){last=null;return;}const q=sourcePointer(p,W,H,stage.width,stage.height);if(last)fluid.splat(q.x,q.y,q.x-last[0],q.y-last[1]);last=[q.x,q.y];},release(){last=null;},
    render(dt){acc+=dt;let n=0;while(acc>=1/60&&n<3){transport(1/60);acc-=1/60;n++;}if(n===3)acc=0;
      output.data.set(dye);cx.putImageData(output,0,0);stage.ctx.imageSmoothingEnabled=true;const fit=coverFit(W,H,stage.width,stage.height);stage.ctx.drawImage(small,fit.x,fit.y,fit.width,fit.height);
      if(stage.pointer.down){stage.ctx.strokeStyle='#f5edd496';stage.ctx.lineWidth=1;stage.ctx.beginPath();stage.ctx.arc(stage.pointer.x*stage.width,stage.pointer.y*stage.height,24,0,Math.PI*2);stage.ctx.stroke();}
      caption(stage.ctx,'DRAG THE PIGMENT / 松手后继续流动',22,stage.height-22,'#fbf0d3');
      stage.status(`${sourceName} · 压力投影 + 颜料输运 · ${steps} 步 · 不会自动复原`);
    },inspect:()=>({steps,grid:[fluid.w,fluid.h],dyeSize:[W,H],divergence:fluid.divergenceEnergy(),finite:fluid.u.every(Number.isFinite)&&dye.every(Number.isFinite)}),dispose(){generation++;}};
}
