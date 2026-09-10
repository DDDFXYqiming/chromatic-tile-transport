/* Uses the official PixiJS MeshPlane / MeshRope skill patterns. */
(function(root){
  'use strict';
  const P=root.PIXI,D=root.MatrixDeformation;
  class Surface{
    constructor(canvas,images,layers){this.canvas=canvas;this.images=images;this.layers=layers;this.entries=[];}
    async init(){
      if(!P)throw new Error('Bundled PixiJS is unavailable');
      this.app=new P.Application();
      await this.app.init({canvas:this.canvas,width:1,height:1,background:0xf2f6f2,backgroundAlpha:1,preference:['webgl'],
        autoStart:false,sharedTicker:false,resolution:1,autoDensity:false,antialias:false,preserveDrawingBuffer:true,eventMode:'none'});
      this.app.stop();this.app.stage.eventMode='none';
      this.entries=this.layers.map((layer,i)=>{
        // The existing loader has already decoded these HTMLImageElements.
        const texture=P.Texture.from(this.images[i],true),kind=layer.rig||'none';let node,rig,buffer,points;
        if(kind==='fish'){
          points=Array.from({length:25},(_,n)=>new P.Point(n*texture.width/24,0));
          node=new P.MeshRope({texture,points,width:texture.height,textureScale:0});node.autoUpdate=false;
          node.pivot.set(texture.width/2,0);
        }else if(kind==='none'){
          node=new P.Sprite({texture,anchor:.5});
        }else{
          node=new P.MeshPlane({texture,verticesX:kind==='character'?37:29,verticesY:kind==='character'?49:29});
          node.autoResize=false;buffer=node.geometry.getAttribute('aPosition').buffer;
          rig=D.compile(kind,new Float32Array(buffer.data),texture.width,texture.height);
          node.pivot.set(texture.width/2,texture.height/2);
        }
        node.eventMode='none';this.app.stage.addChild(node);return {node,texture,kind,rig,buffer,points};
      });
      if(this.app.renderer.prepare)await this.app.renderer.prepare.upload(this.app.stage);
      this.app.render();return this;
    }
    resize(width,height){if(this.app.screen.width!==width||this.app.screen.height!==height)this.app.renderer.resize(width,height);}
    draw(layers,clock,strength){
      const w=this.canvas.width,h=this.canvas.height;
      layers.forEach((layer,i)=>{
        const e=this.entries[i],node=e.node;node.visible=layer.visible;if(!layer.visible)return;
        const amount=strength*(layer.rigStrength??1),phase=(layer.phase||0)*.7;
        let x=layer.screenX,y=layer.screenY,ih=layer.screenHeight,iw=ih*e.texture.width/e.texture.height,angle=layer.angle;
        if(layer.kind==='background'){
          const cover=Math.max(w/e.texture.width,h/e.texture.height)*1.14;iw=e.texture.width*cover;ih=e.texture.height*cover;
          x=w/2+(layer.screenX-w/2)*.25;y=h/2+(layer.screenY-h/2)*.25;angle=0;
        }
        if(e.points){
          e.points.forEach((p,n)=>{const u=n/(e.points.length-1),tail=Math.max(0,(u-.18)/.82);
            p.x=u*e.texture.width;p.y=Math.sin(clock*8-u*5.7+phase)*tail*tail*e.texture.height*.065*amount;
          });
          node.geometry.update();
        }else if(e.rig){D.update(e.rig,e.buffer.data,clock,amount,phase);e.buffer.update();}
        node.position.set(x,y);node.scale.set(iw/e.texture.width,ih/e.texture.height);node.rotation=angle;node.alpha=layer.opacity;
      });
      this.app.render();
    }
    stats(){return {library:'PixiJS '+P.VERSION,backend:'WebGL',nodes:this.entries.map(e=>({type:e.points?'MeshRope':e.rig?'MeshPlane':'Sprite',rig:e.kind,vertices:e.rig?.vertices||e.points?.length*2||4}))};}
    error(){return this.app?.renderer.gl?.getError()||0;}
    dispose(last=false){
      if(this.app?.renderer)this.app.destroy({removeView:false,releaseGlobalResources:last},{children:true,texture:true,textureSource:true});
      else this.app?.stage?.destroy({children:true,texture:true,textureSource:true});
      this.app=null;this.entries=[];
    }
  }
  root.MatrixMesh=Object.freeze({Surface,version:P?.VERSION||null});
})(globalThis);
