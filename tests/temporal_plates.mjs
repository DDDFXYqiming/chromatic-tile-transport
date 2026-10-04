/** Geometry/asset checks, with optional native Canvas raster acceptance. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {RAIN_HORIZON,rainDelay,rainOffset,foldOpening,sampleFold,projectFold,drawRainEcho,drawDawnLetter,rainFit} from '../src/studies/temporal-plates.mjs';
const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
const chapters=JSON.parse(read('src/studies/catalog.json')).find(s=>s.id==='temporal').chapters;
const mesh=JSON.parse(read('assets/'+chapters[4].fold));
assert.equal(mesh.frameCount,49);assert.equal(mesh.frames.length,49);assert.equal(mesh.panels,7);
assert.equal(mesh.uv.length,154);assert.equal(mesh.faces.length,252);
assert.notEqual(chapters[0].effect,chapters[4].effect);
assert.equal(chapters[1].effect,'rain-reflection');assert.equal(chapters[4].effect,'blender-fold-letter');
for(const frame of mesh.frames){
  assert.equal(frame.length,mesh.uv.length);
  assert.ok(frame.flat().every(Number.isFinite));
  for(const face of mesh.faces){
    assert.ok(face.every(i=>i>=0&&i<frame.length));
    const [a,b,c]=face.map(i=>frame[i]),ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    assert.ok(Math.hypot(...cross)>.01,'paper triangles retain area through folding');
  }
  for(let row=0;row<7;row++)for(let col=0;col<21;col++){
    const a=frame[row*22+col],b=frame[row*22+col+1];
    assert.ok(Math.abs(Math.hypot(...a.map((v,k)=>v-b[k]))-1/3)<.00001,'paper never stretches across hinge');
  }
}
assert.deepEqual(sampleFold(mesh,0),mesh.frames[0]);assert.deepEqual(sampleFold(mesh,1),mesh.frames.at(-1));
assert.notDeepEqual(sampleFold(mesh,.3),sampleFold(mesh,.9));
for(const y of [0,.2,RAIN_HORIZON])for(const t of [0,8,200]){
  assert.equal(rainDelay(.5,y),0,'architecture has no time displacement');
  assert.ok(Math.abs(rainOffset(y,t,{x:.5,y:.5},2.4))===0);
}
assert.equal(Math.abs(rainOffset(.9,8,{x:.5,y:.5},0)),0);
assert.notEqual(rainOffset(.9,0,{x:.5,y:.5},2.4),rainOffset(.9,4,{x:.5,y:.5},2.4));
for(const [w,h] of [[1440,650],[1920,800],[768,650],[390,1000],[320,900]]){
  for(const t of [0,3,8,13,1000])for(const pointer of [{x:0,y:0},{x:.5,y:.5},{x:1,y:1}]){
    const pose=projectFold(mesh,w,h,t,pointer);
    assert.ok(pose.points.flat().every(Number.isFinite));
    assert.ok(pose.points.every(([x,y])=>x>=0&&x<=w&&y>=0&&y<=h),'all paper corners remain in frame');
    assert.ok(pose.opening>=.08&&pose.opening<=1);
  }
}
assert.equal(foldOpening(0,undefined,true),foldOpening(50,undefined,true));
assert.notEqual(foldOpening(0,{x:0,y:.5},true),foldOpening(0,{x:1,y:.5},true));
console.log('Temporal plates: 49 inextensible connected poses, UV topology, responsive projection, water mask, zero-depth and reduced-motion PASS');

const canvasArg=process.argv.indexOf('--canvas-module');
if(canvasArg>=0){
  const {createCanvas,loadImage}=createRequire(import.meta.url)(resolve(process.argv[canvasArg+1]));
  const out=resolve(process.argv[process.argv.indexOf('--output')+1]);mkdirSync(out,{recursive:true});
  const rain=await loadImage(new URL('assets/'+chapters[1].image,root));
  const dawn=await loadImage(new URL('assets/'+chapters[4].image,root));
  const digest=c=>createHash('sha256').update(c.toBuffer('image/png')).digest('hex');
  const checks=[];
  for(const [w,h] of [[1440,650],[390,1000]]){
    const canvas=createCanvas(w,h),ctx=canvas.getContext('2d'),p={x:.5,y:.5};
    const render=(kind,t,options={})=>{ctx.clearRect(0,0,w,h);if(kind==='rain')drawRainEcho(ctx,w,h,rain,t,p,2.4,options);else drawDawnLetter(ctx,w,h,dawn,mesh,t,p,options);return digest(canvas);};
    for(const kind of ['rain','fold']){
      const first=render(kind,0);assert.equal(first,render(kind,0),'paused native pixels are stable');
      writeFileSync(resolve(out,`${kind}-${w}-t0.png`),canvas.toBuffer('image/png'));
      assert.notEqual(first,render(kind,4),'actual rendered pixels animate');
      writeFileSync(resolve(out,`${kind}-${w}-t4.png`),canvas.toBuffer('image/png'));
      assert.equal(render(kind,0,{reduced:true}),render(kind,9,{reduced:true}));
      checks.push(`${kind} ${w}px: stable pause, moving pixels, reduced motion`);
    }
    const fit=rainFit(rain,w,h),upper=Math.max(0,Math.floor(fit.y+fit.height*RAIN_HORIZON));
    render('rain',0);const a=ctx.getImageData(0,0,w,upper).data;
    render('rain',4);const b=ctx.getImageData(0,0,w,upper).data;
    assert.deepEqual(a,b,'tram and skyline remain pixel-identical while water animates');
    drawRainEcho(ctx,w,h,rain,2,p,0);const zero=digest(canvas);
    ctx.clearRect(0,0,w,h);ctx.drawImage(rain,fit.x,fit.y,fit.width,fit.height);
    assert.equal(zero,digest(canvas),'zero depth restores the undistorted plate');
    checks.push(`${w}px: dry scene invariant and zero-depth identity`);
  }
  writeFileSync(resolve(out,'raster-results.json'),JSON.stringify({checks,passed:checks.length},null,2)+'\n');
  console.log('Native Canvas raster acceptance PASS:',checks.join('; '));
}
