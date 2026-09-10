/* Analytic local rigs. Static spatial weights + periodic channels keep scrubbing deterministic. */
(function(root){
  'use strict';
  const clip=v=>Math.max(0,Math.min(1,v));
  const smooth=(a,b,v)=>{const t=clip((v-a)/(b-a));return t*t*(3-2*t);};
  const FREQUENCIES=[3,2,5,8,4],CHANNELS=FREQUENCIES.length*2;
  function gaussian(u,v,x,y,rx,ry){return Math.exp(-(((u-x)/rx)**2+((v-y)/ry)**2)*2);}
  function weights(kind,u,v,aspect=1){
    const w=new Float32Array(CHANNELS*2);
    const add=(axis,frequency,amplitude,lag=0)=>{
      const i=axis*CHANNELS+FREQUENCIES.indexOf(frequency)*2;
      w[i]+=amplitude*Math.cos(lag);w[i+1]+=amplitude*Math.sin(lag);
    };
    if(kind==='character'){
      const head=1-smooth(.31,.42,v),neckX=.57,neckY=.37;
      // The face receives one near-rigid head tilt; hair/cloth fields are excluded from it.
      add(0,2,-(v-neckY)*.014*head/aspect,-.4);
      add(1,2,(u-neckX)*.014*head*aspect,-.4);
      add(1,3,-.0022*head);
      const face=1-smooth(.85,1.8,((u-.455)/.185)**2+((v-.23)/.115)**2);
      const chest=gaussian(u,v,.52,.58,.36,.22);
      add(0,3,(u-.52)*.018*chest);add(1,3,-.0048*chest);
      const hairBand=smooth(.06,.25,v)*(1-smooth(.34,.43,v))*(1-face);
      const left=(1-smooth(.24,.36,u))*hairBand,right=smooth(.61,.74,u)*hairBand;
      add(0,5,.016*left,-v*7-1);add(1,2,.005*left,-v*5);
      add(0,5,-.019*right,-v*8-.6);add(1,2,.006*right,-v*4-.8);
      const sleeve=smooth(.44,.73,v)*clip(1-smooth(.27,.42,u)+smooth(.68,.82,u));
      add(0,5,.009*sleeve,-v*6-.7);add(1,3,.0038*sleeve,-u*3);
      const ribbon=gaussian(u,v,.81,.74,.18,.2);
      add(0,5,.007*ribbon,-v*9);add(1,5,.011*ribbon,-v*6-.8);
      add(0,2,.008*smooth(.8,1,v),-u*5);
    }else if(kind==='fish'){
      const tail=smooth(.24,.95,u),bodyBand=.35+.65*gaussian(u,v,.57,.5,.5,.28);
      add(1,8,(.004+.071*tail*tail)*bodyBand,-u*5.7);
      add(0,8,.012*tail*(v-.5),-u*5.7+Math.PI/2);
      const fins=tail*(smooth(.14,.35,Math.abs(v-.5)));
      add(1,4,.036*fins,-u*6-.8);add(0,4,.017*fins,-v*5);
    }else if(kind==='plant'){
      const reach=Math.pow(clip((.98-v)/.88),1.55);
      add(0,2,.041*reach,-v*1.7);add(1,2,.013*reach,-u*2-.7);
      for(const [x,y,lag] of [[.24,.65,0],[.49,.28,1.1],[.83,.22,2.1]]){
        const petal=gaussian(u,v,x,y,.21,.22);
        add(0,4,(u-x)*.062*petal,lag);add(1,4,(v-y)*.052*petal,lag+.3);
      }
    }
    return w;
  }
  function channels(clock,phase=0){
    const c=new Float32Array(CHANNELS);
    FREQUENCIES.forEach((f,i)=>{const a=f*clock+phase;c[i*2]=Math.sin(a);c[i*2+1]=Math.cos(a);});return c;
  }
  function point(kind,u,v,clock,strength=1,aspect=1,phase=0){
    const w=weights(kind,u,v,aspect),c=channels(clock,phase);let x=u,y=v;
    for(let k=0;k<CHANNELS;k++){x+=w[k]*c[k]*strength;y+=w[CHANNELS+k]*c[k]*strength;}return [x,y];
  }
  // PixiJS creates the mesh; these are only artwork-specific motion weights.
  function compile(kind,basePositions,width,height){
    const base=new Float32Array(basePositions),count=base.length/2,spatial=new Float32Array(count*CHANNELS*2);
    for(let n=0;n<count;n++)spatial.set(weights(kind,base[n*2]/width,base[n*2+1]/height,width/height),n*CHANNELS*2);
    return {kind,base,spatial,width,height,vertices:count};
  }
  function update(rig,positions,clock,strength=1,phase=0){
    const c=channels(clock,phase),{base,spatial,width,height}=rig;
    for(let n=0;n<rig.vertices;n++){
      let x=0,y=0,offset=n*CHANNELS*2;
      for(let k=0;k<CHANNELS;k++){x+=spatial[offset+k]*c[k];y+=spatial[offset+CHANNELS+k]*c[k];}
      positions[n*2]=base[n*2]+x*strength*width;positions[n*2+1]=base[n*2+1]+y*strength*height;
    }
    return positions;
  }
  const api={FREQUENCIES,CHANNELS,weights,channels,point,compile,update};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MatrixDeformation=Object.freeze(api);
})(typeof globalThis==='object'?globalThis:this);
