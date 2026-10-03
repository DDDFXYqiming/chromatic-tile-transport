import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Fluid,PigmentField} from '../src/studies/fluid.mjs';
import {coverFit} from '../src/studies/core.mjs';
import {pigmentRegion,hitRegion,pigmentStroke,regionWeight} from '../src/studies/fluid-regions.mjs';

const chapters=JSON.parse(readFileSync(0,'utf8'));
const pigmentPoints={mineral:[.60,.71],ink:[.65,.5],paper:[.70,.55],light:[.56,.71]};
// Independently chosen from the original artwork: background, solid minerals,
// copper rim, glass walls/rim, blank paper, amber panes and tabletop shadows.
const excluded={
  mineral:[[.25,.3],[.58,.25],[.72,.4],[.625,.51],[.78,.655],[.97,.96]],
  ink:[[.3,.4],[.40,.4],[.43,.35],[.65,.12],[.97,.45],[.75,.84]],
  paper:[[.2,.4],[.60,.2],[.65,.30],[.44,.87],[.50,.96]],
  light:[[.2,.4],[.65,.4],[.90,.5],[.1,.6],[.35,.95]],
};
for(const c of chapters){
  const weight=pigmentRegion(c.id,Uint8Array.from(c.pixels),120,80);
  const flow=new Fluid(72,48,12),field=new PigmentField(120,80),initial=field.uv.slice();
  flow.setMask(weight);field.setMask(weight);
  const point=pigmentPoints[c.id];
  assert.ok(weight(...point)>.15,c.id+' pigment anchor stays interactive');
  for(const p of excluded[c.id]){
    assert.equal(weight(...p),0,`${c.id} excludes artwork point ${p}`);
    assert.equal(flow.splat(...p,.08,-.05,.3),false,c.id+' rejects blank brush origin');
  }
  for(const p of [[-.01,.5],[1.01,.5],[.5,-.01],[.5,1.01],[NaN,.5],[.5,Infinity]]){
    assert.equal(weight(...p),0);assert.equal(flow.splat(...p,.08,.05),false);
  }
  // Every non-pigment mask cell is also an inert brush origin, including cells
  // immediately beside a pigment. A large radius cannot bridge that boundary.
  let rejected=0;
  for(let y=0;y<80;y++)for(let x=0;x<120;x++){
    const px=(x+.5)/120,py=(y+.5)/80;
    if(weight(px,py)===0){assert.equal(flow.splat(px,py,.08,.08,.3),false);rejected++;}
  }
  for(let i=0;i<120;i++){flow.step(1/60);field.step(flow,1/60);}
  assert.ok(flow.u.every(v=>v===0)&&flow.v.every(v=>v===0));
  assert.deepEqual(field.uv,initial,c.id+' blank input leaves every pigment coordinate identical');

  // QA's horizontal blank gesture, sampled throughout, in the original
  // 1521px layout plus other cover crops and the live image zoom range.
  for(const [width,height] of [[1453,620],[1388,620],[974,680],[338,640],[268,640]]){
    const rect={left:27,top:84,width,height,right:27+width,bottom:84+height};
    for(const zoom of [1,1.013,1.023]){
      const fit=coverFit(c.width,c.height,width*zoom,height*zoom);
      fit.x-=(width*zoom-width)/2;fit.y-=(height*zoom-height)/2;
      for(let i=0;i<=40;i++){
        const x=140+(480-140)*i/40,y=218;
        if(width>=1388)assert.equal(hitRegion({x,y},rect,fit,weight),null,c.id+' QA blank path');
      }
      for(const [x,y] of excluded[c.id])assert.equal(hitRegion({x:rect.left+fit.x+x*fit.width,y:rect.top+fit.y+y*fit.height},rect,fit,weight),null,c.id+' excluded region through cover crop');
      const p={x:rect.left+fit.x+point[0]*fit.width,y:rect.top+fit.y+point[1]*fit.height};
      if(p.x>=rect.left&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom){
        const hit=hitRegion(p,rect,fit,weight);
        assert.ok(hit,c.id+' pigment maps through cover crop');
        assert.ok(Math.abs(hit.x-point[0])+Math.abs(hit.y-point[1])<1e-12);
        assert.equal(hitRegion(p,rect,fit,weight,[{left:p.x-10,right:p.x+10,top:p.y-10,bottom:p.y+10}]),null);
      }
      for(const p of [{x:rect.left-1,y:rect.top+height/2},{x:rect.right+1,y:rect.top+height/2}]){
        assert.equal(hitRegion(p,rect,fit,weight),null,c.id+' captured exterior pointer');
      }
    }
  }

  assert.ok(c.flow.some(s=>weight(s[0],s[1])>.15),c.id+' nudge retains an accepted seed');
  let last={x:point[0],y:point[1]},segments=0;
  for(let i=1;i<=8;i++){
    const q={x:point[0]+.035*i/8,y:point[1]+.015*i/8};
    if(weight(q.x,q.y)<=.15){last=null;continue;}
    if(last&&pigmentStroke(weight,last,q)){
      assert.ok(flow.splat(q.x,q.y,q.x-last.x,q.y-last.y,.095));segments++;
    }
    last=q;
  }
  assert.ok(segments>0,c.id+' pigment drag retains accepted stroke segments');
  for(let i=0;i<180;i++){
    flow.step(1/60);field.step(flow,1/60);
    for(let y=1;y<=flow.h;y++)for(let x=1;x<=flow.w;x++){
      const cell=y*flow.stride+x;
      if(!flow.mask[cell])assert.equal(Math.abs(flow.u[cell])+Math.abs(flow.v[cell])+Math.abs(flow.p[cell]),0);
    }
  }
  assert.ok(field.uv.some((v,i)=>Math.abs(v-initial[i])>.002),c.id+' pigment keeps flowing');
  for(let cell=0;cell<field.mask.length;cell++){
    const k=cell*2;
    if(!field.mask[cell]){
      assert.equal(field.uv[k],initial[k]);assert.equal(field.uv[k+1],initial[k+1]);
    }else{
      const sx=Math.min(field.w-1,Math.floor(field.uv[k]*field.w));
      const sy=Math.min(field.h-1,Math.floor(field.uv[k+1]*field.h));
      assert.ok(field.mask[sy*field.w+sx],c.id+' advected pigment never samples a blank cell');
    }
  }
  assert.ok(flow.u.every(Number.isFinite)&&flow.v.every(Number.isFinite)&&field.uv.every(Number.isFinite));
  console.log(`PASS ${c.id}: ${rejected} blank origins, QA path/crops, overlays, contained pressure and persistent pigment flow`);
}

// A narrow blank gap must interrupt both a stroke and pressure communication.
const islands=(x,y)=>y>.2&&y<.8&&((x>.2&&x<.45)||(x>.55&&x<.8))?1:0;
assert.equal(pigmentStroke(islands,{x:.3,y:.5},{x:.7,y:.5}),false);
assert.equal(pigmentStroke(islands,{x:.3,y:.5},{x:.4,y:.6}),true);
const separate=new Fluid(72,48,12);separate.setMask(islands);
separate.splat(.3,.5,.05,.02,.04);
for(let i=0;i<120;i++)separate.step(1/60);
for(let y=1;y<=separate.h;y++)for(let x=40;x<=separate.w;x++){
  const k=y*separate.stride+x;
  assert.equal(Math.abs(separate.u[k])+Math.abs(separate.v[k]),0,'pressure cannot cross a blank gap');
}
// Opaque local artwork keeps its bounded interaction; transparent pixels do not.
const local=new Uint8Array(120*80*4).fill(255);
const localWeight=pigmentRegion('local',local,120,80);
assert.ok(localWeight(.5,.5)>.15);assert.equal(localWeight(.01,.01),0);
assert.equal(pigmentRegion('local',new Uint8Array(local.length),120,80)(.5,.5),0);
for(const p of [[NaN,.5],[.5,Infinity],[-.1,.5],[1.1,.5]])assert.equal(regionWeight('local',...p),0);
console.log('PASS disconnected regions, stroke gaps, local artwork bounds and transparency');
