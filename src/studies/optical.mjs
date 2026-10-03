import {clamp,lensRay} from './math.mjs';
import {asset,image,sampleImage,offscreen,range,fileInput,caption,bilinear,coverFit,sourcePointer} from './core.mjs';
export async function create(stage,controls) {
  const W=600,H=375,small=offscreen(W,H),cx=small.getContext('2d');
  let artwork=await image(asset('studies/quiet-orbit.svg')),src=sampleImage(artwork,W,H),output=new ImageData(W,H);
  let ior=1.46,dispersion=.018,radius=98,pos=[.5,.51],lut=[],generation=0,sourceName='原创矢量画 · 静谧轨道';
  function build(){lut=[];for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++)if(x*x+y*y<radius*radius){const rays=[ior-dispersion,ior,ior+dispersion].map(n=>lensRay(x/radius,y/radius,n));if(rays[1])lut.push({x,y,rays});}stage.dirty=true;}
  range(controls,'折射率',1.05,1.8,ior,.01,v=>{ior=v;build();});
  range(controls,'色散',0,.055,dispersion,.001,v=>{dispersion=v;build();});
  range(controls,'镜体尺寸',65,132,radius,1,v=>{radius=v;build();});
  fileInput(controls,'更换背景图','image/png,image/jpeg,image/webp',16,async file=>{const ticket=++generation,url=URL.createObjectURL(file);try{const img=await image(url);if(ticket!==generation)return;artwork=img;src=sampleImage(artwork,W,H);sourceName=file.name;stage.dirty=true;}finally{URL.revokeObjectURL(url);}});
  build();
  return {static:true,reset(){pos=[.5,.51];stage.dirty=true;},pointer(p){if(p.down){const q=sourcePointer(p,W,H,stage.width,stage.height);pos=[clamp(q.x,.14,.86),clamp(q.y,.22,.78)];}},
    render(){
      output.data.set(src.data);const centerX=Math.round(pos[0]*W),centerY=Math.round(pos[1]*H);
      for(const e of lut){const x=centerX+e.x,y=centerY+e.y;if(x<0||y<0||x>=W||y>=H)continue;const k=(y*W+x)*4,nx=e.x/radius,ny=e.y/radius,nz=Math.sqrt(1-nx*nx-ny*ny);
        const highlight=Math.exp(-((nx+.36)**2+(ny+.45)**2)*95)*180+Math.exp(-((nx-.64)**2+(ny-.31)**2)*150)*80;
        for(let ch=0;ch<3;ch++){
          const ray=e.rays[ch];if(!ray){output.data[k+ch]=195;continue;}
          const c=bilinear(src.data,W,H,centerX+ray.x*radius,centerY+ray.y*radius,ch);
          const absorb=Math.exp(-ray.length*[.018,.009,.005][ch]);
          output.data[k+ch]=c*absorb*(1-ray.fresnel)+[172,202,207][ch]*ray.fresnel+highlight*(.3+.7*nz);
        }output.data[k+3]=255;
      }
      cx.putImageData(output,0,0);const {ctx,width:w,height:h}=stage;const fit=coverFit(W,H,w,h);ctx.drawImage(small,fit.x,fit.y,fit.width,fit.height);
      ctx.save();ctx.translate(fit.x,fit.y);ctx.scale(fit.scale,fit.scale);ctx.strokeStyle='#d7eadb72';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(centerX,centerY,radius,0,Math.PI*2);ctx.stroke();ctx.restore();
      caption(ctx,'SNELL / FRESNEL / DISPERSION',22,h-24,'#f2e8c8');
      stage.status(`${sourceName} · 双界面折射 · RGB 分波长采样 · 拖动玻璃球`);
    },inspect:()=>({ior,dispersion,radius,samples:lut.length,pos,model:'two-interface-sphere'}),dispose(){generation++;}};
}
