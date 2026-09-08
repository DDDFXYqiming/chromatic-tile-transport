/* Main-thread sampling, asynchronous matching, and bounded in-memory plan cache. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lin=new Float64Array(256);
  for(let i=0;i<256;i++){const x=i/255;lin[i]=x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}
  function describe(image,focal,cols,rows,aspect){
    const c=document.createElement('canvas'); c.width=cols*3;c.height=rows*3;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('Cannot read image pixels.');
    const iw=image.naturalWidth,ih=image.naturalHeight,ia=iw/ih;
    const sw=iw*Math.min(1,aspect/ia),sh=ih*Math.min(1,ia/aspect);
    const sx=clamp(focal[0]*iw-sw*.5,0,iw-sw),sy=clamp(focal[1]*ih-sh*.5,0,ih-sh);
    ctx.drawImage(image,sx,sy,sw,sh,0,0,c.width,c.height);
    const raw=ctx.getImageData(0,0,c.width,c.height).data, n=cols*rows,out=new Float32Array(n*4);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      let r=0,g=0,b=0;
      for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++){
        const p=((y*3+dy)*c.width+x*3+dx)*4;
        r+=lin[raw[p]];g+=lin[raw[p+1]];b+=lin[raw[p+2]];
      }
      r/=9;g/=9;b/=9;
      const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
      const i=(y*cols+x)*4;
      out[i]=.2104542553*l+.7936177850*m-.0040720468*s;
      out[i+1]=1.9779984951*l-2.4285922050*m+.4505937099*s;
      out[i+2]=.0259040371*l+.7827717662*m-.808675766*s;
    }
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const left=out[(y*cols+Math.max(0,x-1))*4],right=out[(y*cols+Math.min(cols-1,x+1))*4];
      const top=out[(Math.max(0,y-1)*cols+x)*4],bottom=out[(Math.min(rows-1,y+1)*cols+x)*4];
      out[(y*cols+x)*4+3]=Math.hypot(right-left,bottom-top)*.5;
    }
    return out;
  }
  class TileTransportManager {
    constructor(images,media,onUpdate,onError){
      this.images=images;this.media=media;this.onUpdate=onUpdate;this.onError=onError;
      this.cache=new Map();this.worker=null;this.queue=[];this.busy=false;this.jobId=0;this.generation=0;this.current=null;
      this.workerMode='Web Worker';this.errors=[];
    }
    configure(cols,rows,width,height,spatial){
      const aspect=width/height,key=[cols,rows,aspect.toFixed(4),spatial].join(':');
      if(this.key===key)return;
      this.key=key;this.generation++;this.busy=false;this.queue=[];
      if(this.worker){this.worker.terminate();this.worker=null;}
      if(this.cache.has(key)){
        this.current=this.cache.get(key);this.cache.delete(key);this.cache.set(key,this.current);
      }else{
        const descriptors=this.images.map((img,i)=>describe(img,this.media[i].position,cols,rows,aspect));
        this.current={key,config:{cols,rows,aspect,spatial},descriptors,plans:new Map(),baselines:new Map()};
        this.cache.set(key,this.current);
      }
      while(this.cache.size>3)this.cache.delete(this.cache.keys().next().value);
      for(let i=0;i<this.images.length;i++)this.request(i,(i+1)%this.images.length,false);
      this.runNext();this.onUpdate();
    }
    get(a,b){return this.current?.plans.get(a+':'+b)||null;}
    request(a,b,priority=true){
      if(!this.current||this.get(a,b))return;
      const key=a+':'+b;
      if(this.active?.key===key&&this.busy)return;
      const existing=this.queue.findIndex(j=>j.key===key);
      if(existing>=0){if(priority){const [j]=this.queue.splice(existing,1);this.queue.unshift(j);}return;}
      const job={a,b,key};priority?this.queue.unshift(job):this.queue.push(job);
      if(priority)this.runNext();
    }
    runNext(){
      if(this.busy||!this.queue.length||!this.current)return;
      const job=this.queue.shift(),entry=this.current,generation=this.generation,id=++this.jobId;
      this.busy=true;this.active=job;
      const done=data=>{
        if(generation!==this.generation||entry!==this.current)return;
        this.busy=false;this.active=null;
        if(data.error){this.errors.push(data.error);this.onError(new Error(data.error));return;}
        entry.plans.set(job.key,data);this.onUpdate();setTimeout(()=>this.runNext(),0);
      };
      if(!this.worker){
        try{
          const url=URL.createObjectURL(new Blob([window.MATCH_WORKER_SOURCE],{type:'text/javascript'}));
          this.worker=new Worker(url);URL.revokeObjectURL(url);
        }catch(e){this.workerMode='main-thread fallback';}
      }
      if(this.worker){
        this.worker.onmessage=e=>{if(e.data.id===id)done(e.data);};
        this.worker.onerror=e=>{e.preventDefault();this.worker.terminate();this.worker=null;this.workerMode='main-thread fallback';this.runFallback(entry,job,done);};
        this.worker.postMessage({id,A:entry.descriptors[job.a],B:entry.descriptors[job.b],config:entry.config});
      }else this.runFallback(entry,job,done);
    }
    runFallback(entry,job,done){
      setTimeout(()=>{
        try{const module={exports:{}};const solve=new Function('module',window.MATCH_WORKER_SOURCE+';return module.exports.solve;')(module);done(solve(entry.descriptors[job.a],entry.descriptors[job.b],entry.config));}
        catch(error){done({error:String(error.stack||error)});}
      },30);
    }
    baseline(mode,a,b){
      const entry=this.current;if(!entry)return null;
      const key=[mode,a,b].join(':');if(entry.baselines.has(key))return entry.baselines.get(key);
      const {cols,rows,aspect}=entry.config,n=cols*rows,A=entry.descriptors[a],B=entry.descriptors[b],attrs=new Float32Array(n*10),map=new Int32Array(n);
      let col=0;
      for(let i=0;i<n;i++){
        const x=i%cols,y=Math.floor(i/cols),bx=Math.floor(x/8)*8,by=Math.floor(y/8)*8;
        let tx=x,ty=y;
        if(mode==='geometry'){const rx=bx+7-y%8,ry=by+x%8;if(rx<cols&&ry<rows){tx=rx;ty=ry;}}
        const j=ty*cols+tx;map[i]=j;
        const sx=(x+.5)/cols,sy=(y+.5)/rows,ex=(tx+.5)/cols,ey=(ty+.5)/rows,k=i*10;
        attrs[k]=ex;attrs[k+1]=ey;attrs[k+2]=sx+(ex-sx)/3;attrs[k+3]=sy+(ey-sy)/3;attrs[k+4]=ex-(ex-sx)/3;attrs[k+5]=ey-(ey-sy)/3;
        attrs[k+6]=.12+.12*A[i*4];attrs[k+7]=.77+.08*B[j*4];
        const l=A[i*4]-B[j*4],u=A[i*4+1]-B[j*4+1],v=A[i*4+2]-B[j*4+2];
        attrs[k+8]=Math.sqrt(l*l+1.6*(u*u+v*v));attrs[k+9]=Math.hypot((ex-sx)*aspect,ey-sy)/Math.hypot(aspect,1);col+=attrs[k+8];
      }
      const result={attrs,map,metrics:{meanColorError:col/n,count:n,bijection:true,uniqueTargets:n}};entry.baselines.set(key,result);return result;
    }
    diagnostics(){return {configuration:this.key,plansReady:this.current?.plans.size||0,worker:this.workerMode,computing:this.busy,errors:this.errors.slice()};}
  }
  window.TileTransportManager=TileTransportManager;
})();
