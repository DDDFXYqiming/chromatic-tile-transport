import {foldingPanels,face,imageQuad,camera,renderFaces,mix,clamp,sub,cross,unit,add,mul,dot} from './math.mjs';
import {asset,image,offscreen,range,button,sky,caption} from './core.mjs';
export async function create(stage,controls) {
  const art=await image(asset('studies/paper-world.png'));
  const textures=[0,1,2].map(i=>{const c=offscreen(320,600);c.getContext('2d').drawImage(art,i*art.width/3,0,art.width/3,art.height,0,0,320,600);return c;});
  let open=.76,target=.76,orbit=.36,auto=false;
  const input=range(controls,'展开程度',0,100,76,1,v=>{target=v/100;auto=false;stage.dirty=true;});
  button(controls,'合拢 / 展开',()=>{target=target>.4?0:1;auto=false;stage.dirty=true;});
  const orbitInput=range(controls,'观察角度',-65,65,21,1,v=>{orbit=v*Math.PI/180;stage.dirty=true;});
  button(controls,'自动开合',()=>{auto=!auto;stage.setPlaying(true);});
  function mapPanel(points,u,v){return points[0].map((_,i)=>mix(mix(points[0][i],points[1][i],u),mix(points[3][i],points[2][i],u),v));}
  return {reset(){open=target=.76;orbit=.36;auto=false;input.value=76;orbitInput.value=21;},key(key){if(key==='ArrowUp')target=clamp(target+.05);if(key==='ArrowDown')target=clamp(target-.05);},
    render(dt){if(auto&&dt)target=(1-Math.cos(stage.t*.65))*.5;open=dt?mix(open,target,1-Math.exp(-dt*4)):target;input.value=Math.round(open*100);
      const p=foldingPanels(open),faces=[];const {ctx,width:w,height:h}=stage;const cam=camera([Math.sin(orbit)*6.4,mix(.1,2.8,open),Math.cos(orbit)*6.4],[0,-.65,mix(0,.6,open)],w,h,1.07);
      for(const [key,index] of [['left',0],['center',1],['right',2]]){
        
        const normal=unit(cross(sub(p[key][1],p[key][0]),sub(p[key][2],p[key][0])));
        const back=p[key].map(v=>add(v,mul(normal,-.009)));
        if(dot(normal,sub(cam.eye,p[key][0]))>0)faces.push(...imageQuad([p[key][3],p[key][2],p[key][1],p[key][0]],textures[index],8,7));else faces.push(face(back,'#bda987')); 
        for(let i=0;i<4;i++)faces.push(face([p[key][i],p[key][(i+1)%4],back[(i+1)%4],back[i]],'#dfd1ad'));
      }
      for(let y=0;y<16;y++)for(let x=0;x<8;x++){const q=[[x/8,y/16],[(x+1)/8,y/16],[(x+1)/8,(y+1)/16],[x/8,(y+1)/16]].map(uv=>mapPanel(p.floor,...uv));faces.push(face(q,'#cec8ab',{seamless:true}));}
      // Fold lines and an attached popup arch lie on / hinge from the floor.
      for(let i=1;i<8;i++){const v=i/8,a=mapPanel(p.floor,0,v),b=mapPanel(p.floor,1,v),c=mapPanel(p.floor,1,v+.005),d=mapPanel(p.floor,0,v+.005);faces.push(face([a,b,c,d],'#aaa98f'));}
      const archAt=(u,v)=>mapPanel(p.popup,u,v);
      for(const [u0,u1] of [[0,.13],[.87,1]])faces.push(face([archAt(u0,0),archAt(u1,0),archAt(u1,.55),archAt(u0,.55)],'#ead6a5',{stroke:'#baa47a'}));
      for(let i=0;i<18;i++){
        const a=i/18*Math.PI,b=(i+1)/18*Math.PI;
        const outer=t=>archAt(.5+.5*Math.cos(t),.55+.45*Math.sin(t));
        const inner=t=>archAt(.5+.37*Math.cos(t),.55+.33*Math.sin(t));
        faces.push(face([outer(a),outer(b),inner(b),inner(a)],'#ead6a5',{stroke:'#baa47a'}));
      }
      sky(ctx,w,h,'#294044','#10212a');
      const glow=ctx.createRadialGradient(w/2,h*.48,20,w/2,h*.48,h*.6);glow.addColorStop(0,'#d9b67f1c');glow.addColorStop(1,'#d9b67f00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
      
      renderFaces(ctx,faces,cam);
      caption(ctx,'PAPER KINEMATICS / 边缘相连的折叠结构',22,h-24);
      stage.status(`展开 ${Math.round(open*100)}% · 连续三联画 + 铰接地板 + 立体拱门 · 非 PNG 分层平移`);
    },inspect:()=>({open,target,panels:foldingPanels(open),model:'connected-hinge-net'})};
}
