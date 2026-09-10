/* A deterministic multiplane scene, composited before the existing Matrix shaders. */
(function(root){
  'use strict';
  const T=root.MatrixTimeline;
  const mix=(a,b,t)=>a+(b-a)*t;
  function cameraAt(keys,phase){
    let a=keys[0],b=keys[keys.length-1];
    for(let i=1;i<keys.length;i++)if(phase<=keys[i].p){a=keys[i-1];b=keys[i];break;}
    const t=T.smooth((phase-a.p)/Math.max(.00001,b.p-a.p));
    return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),scale:mix(a.scale,b.scale,t)};
  }
  function layout(composition,scene,phase,seconds,total,config,width,height,visibility={}){
    const camera=cameraAt(scene.cameraKeys,phase),portrait=width/height<1;
    camera.scale=1+(camera.scale-1)*(config.zoom-1)/.65;
    camera.x+=config.cameraX||0;camera.y+=config.cameraY||0;
    if(portrait){camera.x=mix(.64,camera.x,.3);camera.scale=1+(camera.scale-1)*.55;}
    const unit=height/composition.height,clock=seconds/total*Math.PI*2;
    return composition.layers.map(layer=>{
      const depth=layer.depth??1,motion=config.layerMotion===false?0:config.parallax/.65;
      const drift=layer.drift||[0,0],angle=clock+(layer.phase||0);
      const x=(layer.x+Math.sin(angle)*drift[0]*motion)*composition.width;
      const y=(layer.y+Math.sin(angle*2)*drift[1]*motion)*composition.height;
      const scale=1+(camera.scale-1)*depth;
      return {...layer,visible:visibility[layer.id]!==false,
        screenX:width/2+(x-composition.width/2-(camera.x-.5)*composition.width*depth)*unit*scale,
        screenY:height/2+(y-composition.height/2-(camera.y-.5)*composition.height*depth)*unit*scale,
        screenHeight:layer.height*composition.height*unit*scale,
        angle:((layer.rotation||0)+Math.sin(angle)*(layer.sway||0)*motion)*Math.PI/180,
        opacity:layer.opacity??1,camera};
    });
  }
  class Compositor{
    constructor(composition,images,scenes){
      this.composition=composition;this.images=images;this.scenes=scenes;this.visibility={};this.frames=0;
      this.buffers=[document.createElement('canvas'),document.createElement('canvas')];this.last=[];
    }
    resize(width,height){
      // GPU-backed Canvas 2D supplies the layered texture; no readback or image encoding per frame.
      const scale=Math.min(1,Math.sqrt(1200000/(width*height)));
      this.width=Math.max(1,Math.round(width*scale));this.height=Math.max(1,Math.round(height*scale));
      for(const c of this.buffers)if(c.width!==this.width||c.height!==this.height){c.width=this.width;c.height=this.height;}
    }
    draw(canvas,sceneIndex,phase,seconds,config){
      const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{alpha:false});
      const layers=layout(this.composition,this.scenes[sceneIndex],phase,seconds,this.scenes.length*config.shotSeconds,config,w,h,this.visibility);
      ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle='#f2f6f2';ctx.fillRect(0,0,w,h);
      layers.forEach((layer,i)=>{
        if(!layer.visible)return;const image=this.images[i];ctx.save();ctx.globalAlpha=layer.opacity;
        if(layer.kind==='background'){
          const cover=Math.max(w/image.naturalWidth,h/image.naturalHeight)*1.14;
          const iw=image.naturalWidth*cover,ih=image.naturalHeight*cover;
          ctx.drawImage(image,(w-iw)/2+(layer.screenX-w/2)*.25,(h-ih)/2+(layer.screenY-h/2)*.25,iw,ih);
        }else{
          const ih=layer.screenHeight,iw=ih*image.naturalWidth/image.naturalHeight;
          ctx.translate(layer.screenX,layer.screenY);ctx.rotate(layer.angle);
          ctx.drawImage(image,-iw/2,-ih/2,iw,ih);
        }
        ctx.restore();
      });
      this.frames++;return layers;
    }
    render(frame,config){
      const options=frame.reduced?{...config,layerMotion:false,zoom:1}:config;
      this.last=this.draw(this.buffers[0],frame.scene,frame.reduced?0:frame.phase,frame.position,options);
      if(frame.bridge>0)this.draw(this.buffers[1],frame.next,0,frame.next*config.shotSeconds,options);
      return {a:this.buffers[0],b:this.buffers[1]};
    }
    thumbnail(index,config){
      const c=document.createElement('canvas');c.width=480;c.height=270;
      this.draw(c,index,.65,(index+.65)*config.shotSeconds,{...config,cameraX:0,cameraY:0});return c.toDataURL('image/webp',.82);
    }
    getState(){return {frames:this.frames,layers:this.last.map(l=>({id:l.id,visible:l.visible,x:l.screenX,y:l.screenY,height:l.screenHeight,angle:l.angle,opacity:l.opacity})),camera:this.last[0]?.camera};}
    dispose(){this.buffers.forEach(c=>{c.width=c.height=1;});this.last=[];}
  }
  const api={cameraAt,layout,Compositor};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MatrixLayers=Object.freeze(api);
})(typeof globalThis==='object'?globalThis:this);
