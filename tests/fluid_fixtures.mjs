import {readFileSync} from 'node:fs';

// Lossless full-size plate pixels, independent of canvas downsampling.
export function samples(){
  return JSON.parse(readFileSync(0,'utf8')).map(c=>{
    const labels=Buffer.from(c.mask.pixels,'base64'),data=new Uint8ClampedArray(labels.length*4);
    for(let i=0;i<labels.length;i++){data.fill(labels[i],i*4,i*4+3);data[i*4+3]=255;}
    return {...c,material:{width:c.mask.width,height:c.mask.height,data}};
  });
}

export const pigmentPoints={mineral:[.60,.71],ink:[.65,.5],paper:[.70,.55],light:[.585,.686]};
export const qaLayout={left:27,top:85,width:1453,height:620,right:1480,bottom:705};
export const qaBlank={from:{clientX:140,clientY:218},to:{clientX:480,clientY:218}};
export const qaPigment=[
  {chapter:0,from:{clientX:830,clientY:600},to:{clientX:930,clientY:600}},
  {chapter:1,from:{clientX:800,clientY:350},to:{clientX:1000,clientY:350}},
];
