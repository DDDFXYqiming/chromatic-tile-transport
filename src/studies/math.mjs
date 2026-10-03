/** Small, dependency-free geometry kernel. World units are shared by all studies. */
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, s) => a.map(v => v * s);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));
export const rx = (p, a) => [p[0], p[1]*Math.cos(a)-p[2]*Math.sin(a), p[1]*Math.sin(a)+p[2]*Math.cos(a)];
export const ry = (p, a) => [p[0]*Math.cos(a)+p[2]*Math.sin(a), p[1], -p[0]*Math.sin(a)+p[2]*Math.cos(a)];
export function refract(i, n, eta) {
  const d = dot(i, n), k = 1 - eta*eta*(1-d*d);
  return k < 0 ? null : sub(mul(i, eta), mul(n, eta*d + Math.sqrt(k)));
}
export function lensRay(x, y, ior, depth = 2.5) {
  // Unit sphere, orthographic incident ray; both interfaces obey Snell's law.
  const z2 = 1-x*x-y*y;
  if (z2 <= 0) return null;
  const entry = [x,y,Math.sqrt(z2)], incoming = [0,0,-1];
  const inside = refract(incoming, entry, 1/ior);
  const length = -2*dot(entry, inside);
  const exit = add(entry, mul(inside, length));
  const outgoing = refract(inside, mul(exit,-1), ior);
  if (!outgoing || outgoing[2] >= -0.00001) return null;
  const travel = (-depth-exit[2])/outgoing[2];
  const at = add(exit, mul(outgoing, travel));
  const f0 = ((ior-1)/(ior+1))**2;
  return { x: at[0], y: at[1], fresnel: f0+(1-f0)*(1-entry[2])**5, length };
}

export function camera(eye, target, width, height, focal = 0.9) {
  const forward = unit(sub(target, eye));
  const right = unit(cross(forward, [0,1,0]));
  const up = cross(right, forward);
  const f = Math.min(width,height)*focal;
  return {
    eye, width, height,
    view(p) { const q=sub(p,eye); return [dot(q,right),dot(q,up),dot(q,forward)]; },
    project(q) { return [width/2 + f*q[0]/q[2], height/2 - f*q[1]/q[2]]; }
  };
}
export function clipNear(points, near=0.08) {
  const out=[];
  for(let i=0;i<points.length;i++) {
    const a=points[i], b=points[(i+1)%points.length], ai=a[2]>=near, bi=b[2]>=near;
    if(ai) out.push(a);
    if(ai!==bi) { const t=(near-a[2])/(b[2]-a[2]); out.push(a.map((v,j)=>mix(v,b[j],t))); }
  }
  return out;
}
export function face(points, color, extra={}) { return {points,color,...extra}; }
export function box(center, size, color) {
  const [x,y,z]=center, [a,b,c]=size.map(v=>v/2);
  const p=[[-a,-b,-c],[a,-b,-c],[a,b,-c],[-a,b,-c],[-a,-b,c],[a,-b,c],[a,b,c],[-a,b,c]].map(v=>add(v,[x,y,z]));
  return [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]].map(ids=>face(ids.map(i=>p[i]),color));
}
export function sphere(center, radius, color, lat=12, lon=24) {
  const at=(i,j)=>add(center,[radius*Math.sin(i/lat*Math.PI)*Math.cos(j/lon*Math.PI*2),radius*Math.cos(i/lat*Math.PI),radius*Math.sin(i/lat*Math.PI)*Math.sin(j/lon*Math.PI*2)]);
  const faces=[];
  for(let i=0;i<lat;i++)for(let j=0;j<lon;j++)faces.push(face([at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)],color));
  return faces;
}
function tint(hex, light) {
  const n=parseInt(hex.slice(1),16);
  return `rgb(${[n>>16&255,n>>8&255,n&255].map(v=>Math.round(clamp(v*light,0,255))).join(',')})`;
}
export function renderFaces(ctx, faces, cam, options={}) {
  const light=unit(options.light || [-0.4,0.85,0.6]);
  const draw=[];
  for(const f of faces) {
    const view=f.points.map(p=>cam.view(p));
    const clipped=clipNear(view);
    if(clipped.length<3)continue;
    const normal=unit(cross(sub(f.points[1],f.points[0]),sub(f.points[2],f.points[0])));
    const strength=f.emissive ? 1 : .43+.57*Math.abs(dot(normal,light));
    draw.push({f,points:clipped.map(p=>cam.project(p)),depth:view.reduce((a,p)=>a+p[2],0)/view.length,strength});
  }
  draw.sort((a,b)=>b.depth-a.depth);
  for(const {f,points,strength} of draw) {
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
    if(f.texture && points.length===3 && f.points.every(p=>cam.view(p)[2]>=.08)) {
      const [[x0,y0],[x1,y1],[x2,y2]]=points;
      const uv=f.uv.map(p=>[p[0]*f.texture.width,p[1]*f.texture.height]);
      const [[u0,v0],[u1,v1],[u2,v2]]=uv;
      const det=u0*(v1-v2)+u1*(v2-v0)+u2*(v0-v1);
      const solve=q=>[(q[0]*(v1-v2)+q[1]*(v2-v0)+q[2]*(v0-v1))/det,(q[0]*(u2-u1)+q[1]*(u0-u2)+q[2]*(u1-u0))/det,(q[0]*(u1*v2-u2*v1)+q[1]*(u2*v0-u0*v2)+q[2]*(u0*v1-u1*v0))/det];
      const a=solve([x0,x1,x2]),b=solve([y0,y1,y2]);
      // Slightly overlap the clip triangles to eliminate antialias cracks between tiles.
      const center=points.reduce((q,p)=>[q[0]+p[0]/3,q[1]+p[1]/3],[0,0]);
      const dist=Math.min(...points.map((p,i)=>{const q=points[(i+1)%3];return Math.abs((q[0]-p[0])*(center[1]-p[1])-(q[1]-p[1])*(center[0]-p[0]))/(Math.hypot(q[0]-p[0],q[1]-p[1])||1);}));
      const expand=1+.65/Math.max(.01,dist);
      ctx.save();ctx.beginPath();points.forEach((p,i)=>{const v=[center[0]+(p[0]-center[0])*expand,center[1]+(p[1]-center[1])*expand];i?ctx.lineTo(...v):ctx.moveTo(...v);});ctx.closePath();ctx.clip();ctx.transform(a[0],b[0],a[1],b[1],a[2],b[2]);ctx.drawImage(f.texture,0,0);ctx.restore();
    } else {ctx.fillStyle=tint(f.color,strength);ctx.fill();}
    if(f.seamless){ctx.strokeStyle=tint(f.color,strength);ctx.lineWidth=.8;ctx.stroke();}
    if(f.stroke){ctx.strokeStyle=f.stroke;ctx.lineWidth=.65;ctx.stroke();}
  }
}

export function shadowMasks(n=25) {
  const a=new Uint8Array(n*n), b=new Uint8Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
    const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1;
    a[y*n+x]=+(u*u+v*v<.91 && (u-.39)**2+(v-.10)**2>.73**2);
    b[y*n+x]=+(Math.abs(u)+Math.abs(v)<.98);
  }
  // Projectability requires equal non-empty row support, not arbitrary silhouettes.
  for(let y=0;y<n;y++) {
    const active=a.subarray(y*n,(y+1)*n).some(Boolean)&&b.subarray(y*n,(y+1)*n).some(Boolean);
    if(!active){a.fill(0,y*n,(y+1)*n);b.fill(0,y*n,(y+1)*n);}
  }
  return {a,b,n};
}
export function shadowSolid(n=25) {
  const {a,b}=shadowMasks(n), voxels=[];
  const occupied=(x,y,z)=>x>=0&&y>=0&&z>=0&&x<n&&y<n&&z<n&&a[y*n+x]&&b[y*n+z];
  const h=2/n, faces=[];
  const dirs=[[0,0,-1],[0,0,1],[-1,0,0],[1,0,0],[0,-1,0],[0,1,0]];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)for(let z=0;z<n;z++)if(occupied(x,y,z)) {
    voxels.push([x,y,z]);
    const c=[(x+.5)*h-1,1-(y+.5)*h,(z+.5)*h-1];
    const fs=box(c,[h,h,h],'#b4bbc0');
    dirs.forEach((d,i)=>{if(!occupied(x+d[0],y-d[1],z+d[2]))faces.push(fs[i]);});
  }
  return {a,b,n,voxels,faces};
}

export function foldingPanels(open) {
  // A connected paper net. Every moving panel is defined from its parent's hinge.
  const angle=clamp(open)*Math.PI/2;
  const center=[[-1,-1,0],[1,-1,0],[1,1.4,0],[-1,1.4,0]];
  const left=center.map((_,i)=>[[-2,-1,0],[0,-1,0],[0,1.4,0],[-2,1.4,0]][i]).map(p=>add(ry(p,angle*.78),[-1,0,0]));
  const right=[[0,-1,0],[2,-1,0],[2,1.4,0],[0,1.4,0]].map(p=>add(ry(p,-angle*.78),[1,0,0]));
  const floor=[[-1,0,0],[1,0,0],[1,-2.7,0],[-1,-2.7,0]].map(p=>add(rx(p,-angle),[0,-1,0]));
  // Popup tab: lower edge stays on the floor. At open=0 it lies flat on that sheet.
  const popup=[[-.65,0,0],[.65,0,0],[.65,.85,0],[-.65,.85,0]].map(p=>add(rx(p,Math.PI*(1-clamp(open))**2+angle),[0,-1.35,0])).map(p=>add(rx(p,-angle),[0,-1,0]));
  return {center,left,right,floor,popup};
}
export function imageQuad(points, texture, cols=10, rows=8) {
  const at=(u,v)=>points[0].map((_,i)=>mix(mix(points[0][i],points[1][i],u),mix(points[3][i],points[2][i],u),v));
  const result=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
    const a=[x/cols,y/rows],b=[(x+1)/cols,y/rows],c=[(x+1)/cols,(y+1)/rows],d=[x/cols,(y+1)/rows];
    for(const uv of [[a,b,c],[a,c,d]])result.push(face(uv.map(p=>at(...p)),'#e9e1c9',{texture,uv,emissive:true}));
  }
  return result;
}
