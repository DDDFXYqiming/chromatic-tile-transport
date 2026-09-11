'use strict';
const assert=require('node:assert/strict'),T=require('../src/matrix/timeline.js'),V=require('../src/matrix/video.js');
const config=T.validate({shotSeconds:5.2,bridgeSeconds:1.2}),tests=[];
function check(name,fn){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.message});}}
check('Incoming video continues at exactly the outgoing bridge time on every scene boundary',()=>{
 for(const boundary of [5.2,10.4]){
  const before=T.frame(boundary-.00001,2,config),after=T.frame(boundary,2,config);
  assert.equal(V.quantize(V.clipTime(before,config,5,true),5),V.quantize(V.clipTime(after,config,5,false),5));
 }
});
check('Video time stays decodable at long and short shot settings',()=>{
 for(const shotSeconds of [4,14])for(const bridgeSeconds of [.3,1.6])for(let t=0;t<shotSeconds*2;t+=.025){
  const c=T.validate({shotSeconds,bridgeSeconds}),f=T.frame(t,2,c);
  for(const incoming of [false,true]){const q=V.quantize(V.clipTime(f,c,5,incoming),5);assert.ok(q>=0&&q<5);}
 }
});
check('Still comparison and reduced motion both pin the video to its first frame',()=>{
 const f=T.frame(2,2,config);assert.equal(V.clipTime(f,{...config,videoMotion:false},5),0);assert.equal(V.clipTime({...f,reduced:true},config,5),0);
 assert.throws(()=>T.validate({videoMotion:1}));
});
console.log(JSON.stringify({suite:'matrix-video-clock',passed:tests.every(t=>t.passed),tests},null,2));if(tests.some(t=>!t.passed))process.exitCode=1;
