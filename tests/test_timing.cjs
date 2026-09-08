'use strict';
const assert = require('node:assert/strict');
const {create, DEFAULTS} = require('../src/timing.js');
const timing = create(), tests = [];
const check = (test, fn) => {try {tests.push({test,passed:true,detail:fn()});} catch(e) {tests.push({test,passed:false,error:e.stack});}};
const near = (a,b,e=1e-6) => assert(Math.abs(a-b)<=e, `${a} != ${b}`);
const d = (f,x,h=1e-5) => (f(x+h)-f(x-h))/(2*h);
check('Exact endpoint positions and no endpoint mosaic gaps',()=>{
  for(const s of [.06,.12,.20,.255]) for(const e of [.77,.81,.85]){
    near(timing.sample(0,s,e).t,0);near(timing.sample(1,s,e).t,1);
    near(timing.sample(0,s,e).mosaic,0);near(timing.sample(1,s,e).mosaic,0);
  }
});
check('All default launches <=5%, all arrivals >=95%',()=>{
  for(let i=0;i<=100;i++){const [s,e]=timing.schedule(.06+.195*i/100,.77+.08*i/100);assert(s>=.015 && s<=.0500001);assert(e>=.95 && e<=.9850001);}
  return DEFAULTS;
});
check('Monotonic, finite, reversible deterministic travel',()=>{
  let prev=0;for(let i=0;i<=10000;i++){const t=timing.travel(i/10000);assert(Number.isFinite(t)&&t>=prev-1e-15&&t<=1);prev=t;near(timing.travel(1-i/10000),1-t,1e-12);}
});
check('C1 speed continuity at ramp seams and zero endpoint velocity',()=>{
  for(const x of [DEFAULTS.ramp,1-DEFAULTS.ramp]) near(d(timing.travel,x-1e-5),d(timing.travel,x+1e-5),1e-5);
  near(d(timing.travel,0),0,1e-6);near(d(timing.travel,1),0,1e-6);
});
check('No timing plateau while tiles have fully opened gaps',()=>{
  let min=Infinity;
  for(let i=0;i<=1000;i++){const u=DEFAULTS.splitEnd+(DEFAULTS.fillStart-DEFAULTS.splitEnd)*i/1000;min=Math.min(min,d(timing.travel,u));}
  assert(min>1);return {minimumNormalizedSpeed:min};
});
check('Splitting and filling overlap with travel, rather than wait for it',()=>{
  for(const u of [.03,.05,.08,.90,.94,.97]){assert(timing.mosaic(u)>0&&timing.mosaic(u)<1);assert(d(timing.travel,u)>.05);}
});
check('Twenty millisecond steps keep both handoff windows moving (4 / 5.8 / 8 sec)',()=>{
  const stats=[];
  for(const duration of [4,5.8,8]){
    let minimum=Infinity;
    for(const [start,end] of [[.1,.78],[.2,.81],[.245,.849]]) for(const [lo,hi] of [[.12,.28],[.75,.88]]){
      for(let p=lo;p+(.02/duration)<=hi;p+=.02/duration){const a=timing.sample(p,start,end),b=timing.sample(p+.02/duration,start,end);minimum=Math.min(minimum,(b.t-a.t)/(.02/duration));}
    }
    assert(minimum>.8);stats.push({duration,minProgressSpeed:minimum});
  }
  return stats;
});
check('Palettes retain the old relative launch/arrival ordering',()=>{
  let a=-1,b=-1;for(let i=0;i<=200;i++){const [s,e]=timing.schedule(.06+.195*i/200,.77+.08*i/200);assert(s>=a&&e>=b);a=s;b=e;}
});
check('Out of range, unknown and non-finite motion values fail explicitly',()=>{
  for(const c of [{ramp:0},{ramp:NaN},{ramp:Infinity},{launchBase:.2},{landBase:.7},{landSpread:.2},{splitEnd:.9},{fillStart:1},{unknown:1}])assert.throws(()=>create(c));
});
check('GLSL timing constants derive from the same validated parameters',()=>{
  const custom=create({ramp:.12,splitEnd:.14});assert(custom.glsl.includes('0.120000000'));assert(custom.glsl.includes('0.140000000'));assert(!custom.glsl.includes('undefined'));
});
check('Boundary-clamped input returns finite bounded state',()=>{
  for(const p of [-1,0,.02,.5,.98,1,2]) {const s=timing.sample(p,.14,.82);assert(s.t>=0&&s.t<=1&&s.mosaic>=0&&s.mosaic<=1);}
});
const report={version:'3.1.0',environment:process.version,tests,passed:tests.every(t=>t.passed)};
console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
