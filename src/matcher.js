/*
 * Content-aware, bijective tile transport. No neural networks or dependencies.
 * A balanced rank tree seeds a permutation; small exact assignments and
 * edge-aware pair exchanges refine it. This is NOT a global OT optimum.
 * Descriptors: mean OKLab + local lightness edge magnitude.
 * OKLab matrices: Björn Ottosson, https://bottosson.github.io/posts/oklab/
 */
(function (scope) {
  'use strict';
  const clip = (x, a, b) => Math.max(a, Math.min(b, x));
  function solve(A, B, config) {
    const started = performance.now();
    const { cols, rows, aspect, spatial = .022 } = config;
    const n = cols * rows;
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || n > 200000 || !Number.isFinite(spatial) || spatial < 0 || A.length !== n * 4 || B.length !== n * 4 || !Number.isFinite(aspect) || aspect <= 0 || cols < 2 || rows < 2)
      throw new Error('Invalid descriptor dimensions.');
    for (let i=0; i<A.length; i++) if (!Number.isFinite(A[i]) || !Number.isFinite(B[i])) throw new Error('Non-finite descriptor.');
    const px = new Float32Array(n), py = new Float32Array(n);
    const diag = Math.hypot(aspect, 1), ax = aspect / diag, ay = 1 / diag;
    for (let i=0;i<n;i++) { px[i]=(i%cols+.5)/cols*ax; py[i]=(Math.floor(i/cols)+.5)/rows*ay; }
    const cdist=(i,j)=>{const a=i*4,b=j*4; const l=A[a]-B[b],u=A[a+1]-B[b+1],v=A[a+2]-B[b+2]; return l*l+1.6*(u*u+v*v);};
    const cost=(i,j)=>{const dx=px[i]-px[j],dy=py[i]-py[j],g=A[i*4+3]-B[j*4+3]; return cdist(i,j)+spatial*(dx*dx+dy*dy)+.025*g*g;};
    const map = new Int32Array(n), inverse = new Int32Array(n);
    const ids = Array.from({length:n}, (_,i)=>i);
    const rank = new Int32Array(n), rankAt = new Int32Array(n);
    const F = [A,B].map(S=>{
      const f=new Float32Array(n*6),ws=Math.sqrt(spatial);
      for(let i=0;i<n;i++){const a=i*4,b=i*6; f[b]=S[a];f[b+1]=S[a+1]*Math.sqrt(1.6);f[b+2]=S[a+2]*Math.sqrt(1.6);f[b+3]=px[i]*ws;f[b+4]=py[i]*ws;f[b+5]=S[a+3]*Math.sqrt(.025);}
      return f;
    });
    let rankCursor=0;
    function leaf(sa,sb) {
      // Hungarian assignment inside a <=16-cell leaf only: bounded memory/time.
      const m=sa.length,u=new Float64Array(m+1),v=new Float64Array(m+1),p=new Int32Array(m+1),way=new Int32Array(m+1);
      for(let i=1;i<=m;i++){
        p[0]=i; let j0=0;
        const minv=new Float64Array(m+1).fill(Infinity),used=new Uint8Array(m+1);
        do {
          used[j0]=1;const i0=p[j0];let delta=Infinity,j1=0;
          for(let j=1;j<=m;j++) if(!used[j]){
            const cur=cost(sa[i0-1],sb[j-1])-u[i0]-v[j];
            if(cur<minv[j]){minv[j]=cur;way[j]=j0;}
            if(minv[j]<delta){delta=minv[j];j1=j;}
          }
          for(let j=0;j<=m;j++){if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;}
          j0=j1;
        } while(p[j0]!==0);
        do {const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0!==0);
      }
      for(let j=1;j<=m;j++) map[sa[p[j]-1]]=sb[j-1];
      for(const i of sa){rankAt[rankCursor]=i;rank[i]=rankCursor++;}
    }
    function partition(sa,sb) {
      if(sa.length<=16){leaf(sa,sb);return;}
      // Compare within-image variance, not the difference in palette means.
      // Otherwise a global exposure shift would dominate every split.
      let axis=0,best=-1;
      for(let d=0;d<6;d++){
        let score=0;
        for(let s=0;s<2;s++){
          const list=s?sb:sa, f=F[s]; let sum=0,sq=0;
          for(const i of list){const x=f[i*6+d];sum+=x;sq+=x*x;}
          score+=Math.max(0,sq-sum*sum/list.length);
        }
        if(score>best){best=score;axis=d;}
      }
      sa.sort((i,j)=>F[0][i*6+axis]-F[0][j*6+axis]||i-j);
      sb.sort((i,j)=>F[1][i*6+axis]-F[1][j*6+axis]||i-j);
      const half=Math.floor(sa.length/2);
      partition(sa.slice(0,half),sb.slice(0,half));partition(sa.slice(half),sb.slice(half));
    }
    let identical=true;
    for(let i=0;i<A.length;i++)if(A[i]!==B[i]){identical=false;break;}
    if(identical){for(let i=0;i<n;i++){map[i]=i;rank[i]=i;rankAt[i]=i;}}
    else partition(ids.slice(),ids.slice());
    for(let i=0;i<n;i++)inverse[map[i]]=i;

    const neigh=new Int32Array(n*4).fill(-1),weight=new Float32Array(n*4);
    for(let i=0;i<n;i++){
      const x=i%cols,y=Math.floor(i/cols),ns=[x?i-1:-1,x<cols-1?i+1:-1,y?i-cols:-1,y<rows-1?i+cols:-1];
      for(let k=0;k<4;k++)if(ns[k]>=0){
        const j=ns[k],a=i*4,b=j*4,dL=A[a]-A[b],du=A[a+1]-A[b+1],dv=A[a+2]-A[b+2];
        neigh[a+k]=j;weight[a+k]=Math.exp(-(dL*dL+du*du+dv*dv)/.004);
      }
    }
    const coh=.008;
    function edge(i,ti,j,tj){const dx=(px[ti]-px[i])-(px[tj]-px[j]),dy=(py[ti]-py[i])-(py[tj]-py[j]);return dx*dx+dy*dy;}
    function objective(){let v=0;for(let i=0;i<n;i++){v+=cost(i,map[i]);for(let k=0;k<4;k++){const j=neigh[i*4+k];if(j>i)v+=coh*weight[i*4+k]*edge(i,map[i],j,map[j]);}}return v/n;}
    const initialObjective=objective();
    let swaps=0,seed=0x48a3c79;
    function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
    function trySwap(i,k){
      if(k<0||k>=n||i===k)return;
      const ti=map[i],tk=map[k];
      let delta=cost(i,tk)+cost(k,ti)-cost(i,ti)-cost(k,tk);
      // Exact change of the incident source-neighbour edges, counting i--k once.
      for(let d=0;d<4;d++){
        const j=neigh[i*4+d];if(j<0)continue;
        delta+=coh*weight[i*4+d]*(edge(i,tk,j,j===k?ti:map[j])-edge(i,ti,j,map[j]));
      }
      for(let d=0;d<4;d++){
        const j=neigh[k*4+d];if(j<0||j===i)continue;
        delta+=coh*weight[k*4+d]*(edge(k,ti,j,map[j])-edge(k,tk,j,map[j]));
      }
      if(delta < -1e-10){map[i]=tk;map[k]=ti;inverse[tk]=i;inverse[ti]=k;swaps++;}
    }
    if(!identical)for(let sweep=0;sweep<4;sweep++){
      for(let t=0;t<n;t++){
        const i=sweep%2?n-1-t:t;
        for(let d=0;d<4;d++)trySwap(i,neigh[i*4+d]);
        const target=map[i];
        for(let d=0;d<4;d++){const q=neigh[target*4+d];if(q>=0)trySwap(i,inverse[q]);}
        for(const off of [-13,13,47]){const r=rank[i]+off;if(r>=0&&r<n)trySwap(i,rankAt[r]);}
        trySwap(i,Math.floor(random()*n));trySwap(i,Math.floor(random()*n));
      }
    }
    // Bilateral flow averages produce neighbouring, same-colour streams.
    // Endpoint positions NEVER change: the mapping remains a strict permutation.
    function flowAvg(i,S,targetSide){
      let sx=0,sy=0,sw=0;
      const x=i%cols,y=Math.floor(i/cols),a=i*4;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
        const xx=x+dx,yy=y+dy;if(xx<0||xx>=cols||yy<0||yy>=rows)continue;
        const j=yy*cols+xx,b=j*4,dl=S[a]-S[b],da=S[a+1]-S[b+1],db=S[a+2]-S[b+2];
        const w=Math.exp(-.2*(dx*dx+dy*dy)-(dl*dl+da*da+db*db)/.008);
        const s=targetSide?inverse[j]:j, dest=map[s];
        sx+=((dest%cols)-(s%cols))/cols*w;sy+=(Math.floor(dest/cols)-Math.floor(s/cols))/rows*w;sw+=w;
      }
      return [sx/sw,sy/sw];
    }
    const attrs=new Float32Array(n*10),moves=new Float64Array(n);
    let col=0,identityCol=0,legacyCol=0,travel=0,fixed=0;
    let mapHash=2166136261;
    const seen=new Uint8Array(n);
    for(let i=0;i<n;i++){
      const j=map[i];if(j<0||j>=n||seen[j])throw new Error('Non-bijective transport plan.');seen[j]=1;
      const sx=(i%cols+.5)/cols,sy=(Math.floor(i/cols)+.5)/rows,tx=(j%cols+.5)/cols,ty=(Math.floor(j/cols)+.5)/rows;
      const dx=tx-sx,dy=ty-sy, dist=Math.hypot(dx*ax,dy*ay),out=flowAvg(i,A,false),incoming=flowAvg(j,B,true);
      const k=i*10;
      // Controls retain 45% of the tile's own velocity and 55% of local flow.
      attrs[k]=tx;attrs[k+1]=ty;
      attrs[k+2]=clip(sx+(dx*.45+out[0]*.55)/3,-.015,1.015);
      attrs[k+3]=clip(sy+(dy*.45+out[1]*.55)/3,-.015,1.015);
      attrs[k+4]=clip(tx-(dx*.45+incoming[0]*.55)/3,-.015,1.015);
      attrs[k+5]=clip(ty-(dy*.45+incoming[1]*.55)/3,-.015,1.015);
      attrs[k+6]=.095+.12*A[i*4]+.04*clip(.5+A[i*4+1]*3-A[i*4+2]*2,0,1)-.035*dist;
      attrs[k+7]=.77+.08*B[j*4];attrs[k+8]=Math.sqrt(cdist(i,j));attrs[k+9]=dist;
      col+=Math.sqrt(cdist(i,j));identityCol+=Math.sqrt(cdist(i,i));
      // A deterministic 8x8 block rotation, as a geometry-only diagnostic baseline.
      const x=i%cols,y=Math.floor(i/cols),bx=Math.floor(x/8)*8,by=Math.floor(y/8)*8;
      const lx=bx+7-y%8,ly=by+x%8, legacy=lx<cols&&ly<rows?ly*cols+lx:i;
      legacyCol+=Math.sqrt(cdist(i,legacy));travel+=dist;moves[i]=dist;if(i===j)fixed++;
      mapHash^=j;mapHash=Math.imul(mapHash,16777619);
    }
    moves.sort();
    return {map,attrs,metrics:{count:n,bijection:true,uniqueTargets:n,identity:identical,fixed,
      meanColorError:col/n,samePositionError:identityCol/n,geometryBaselineError:legacyCol/n,
      colorReductionVsSame:identityCol>1e-12?1-col/identityCol:0,
      meanTravel:travel/n,p90Travel:moves[Math.floor(n*.9)],initialObjective,finalObjective:objective(),swaps,
      spatial,hash:(mapHash>>>0).toString(16),computeMs:performance.now()-started}};
  }
  if(typeof module==='object'&&module.exports){module.exports={solve};return;}
  scope.onmessage=e=>{
    const {id,A,B,config}=e.data;
    try {const result=solve(A,B,config);scope.postMessage({id,...result},[result.map.buffer,result.attrs.buffer]);}
    catch(error){scope.postMessage({id,error:String(error.stack||error)});}
  };
})(typeof self==='object'?self:globalThis);
