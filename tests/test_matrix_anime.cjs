'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('../src/matrix/timeline.js'),V=require('../src/matrix/video.js');
const reports=[];
for(const profile of ['anime','battle']){
const data=JSON.parse(fs.readFileSync(`examples/matrix-${profile}/config.json`,'utf8')),scenes=JSON.parse(fs.readFileSync(`examples/matrix-${profile}/scenes.json`,'utf8')),c=T.validate(data.options);
assert.equal(scenes.length,5);assert.equal(new Set(Object.values(data.videos).map(v=>v.src)).size,5);
assert.ok(Math.abs(5*c.shotSeconds-21.5)<1e-10);
const playbackRate=(5-1/24)/(c.shotSeconds+c.bridgeSeconds);assert.ok(playbackRate>.95&&playbackRate<=1);
for(let i=1;i<=5;i++){
 const t=i*c.shotSeconds,a=T.frame(t-.00001,5,c),b=T.frame(t,5,c);
 assert.equal(V.quantize(V.clipTime(a,c,5,true),5),V.quantize(V.clipTime(b,c,5),5));
}
reports.push({profile,passed:true,shotCount:5,cycleSeconds:21.5,playbackRate,allFiveJoinsContinuous:true});
}
console.log(JSON.stringify({suite:'matrix-five-shot-clock',passed:true,profiles:reports},null,2));
