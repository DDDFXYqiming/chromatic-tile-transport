import {box,cross,sub,unit} from './math.mjs';

// One continuous world: chapters change only when the eye crosses an aperture.
export const STOPS=[4.6,-5.4,-15.4,-25.4];
export const DOORS=[0,-10,-20];
export const routeX=z=>.72*Math.sin((STOPS[0]-z)*.26);
export const roomAt=z=>DOORS.filter(door=>z<door).length;
export const APERTURE={halfWidth:1.45,height:3.6,depth:1.4};
export const EYE_HEIGHT=1.72;
export const ROOM={halfWidth:6.8,height:4.8};
// Keep the whole doorway visible at rest, including in a portrait viewport.
export const lensForAspect=aspect=>Math.min(1.75,aspect*1.55);

const vertex=`
attribute vec3 position,normal,color;
attribute vec2 uv;
attribute float material;
uniform vec3 eye;
uniform float yaw,aspect,lens,offset;
varying vec3 vPosition,vNormal,vColor;
varying vec2 vUV;
varying float vMaterial,vDepth;
void main(){
  vec3 p=position-eye;
  float x=cos(yaw)*p.x+sin(yaw)*p.z;
  float z=sin(yaw)*p.x-cos(yaw)*p.z;
  gl_Position=vec4(x*lens/aspect+offset*z,p.y*lens,1.002*z-.1001,z);
  vPosition=position;vNormal=normal;vColor=color;vUV=uv;vMaterial=material;vDepth=z;
}`;
const fragment=`
precision highp float;
varying vec3 vPosition,vNormal,vColor;
varying vec2 vUV;
varying float vMaterial,vDepth;
uniform sampler2D artwork;
uniform float textured,time;
uniform vec3 eye;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){
  vec3 p=vPosition,n=normalize(vNormal);
  float light=.60+.38*abs(dot(n,normalize(vec3(-.45,.8,.3))));
  vec3 c=vColor*light;
  if(textured>.5){
    vec2 uv=vUV;
    if(vMaterial>1.5&&vMaterial<2.5){
      uv+=vec2(sin(p.z*3.+time*.3),cos(p.x*3.-time*.22))*.0018;
    }
    if(vMaterial>.5&&vMaterial<1.5){
      uv=abs(n.y)>.5?p.xz*.48:abs(n.x)>.5?p.zy*.48:p.xy*.48;
    }
    c=texture2D(artwork,uv).rgb;
    // Scenery is fixed to world surfaces, so each wall has its own parallax.
    if(vMaterial<.5)c*=.78+.20*abs(n.z);
    if(vMaterial>.5&&vMaterial<1.5){
      vec3 view=normalize(eye-p);
      float spec=pow(max(0.,dot(reflect(-normalize(vec3(-.45,.8,.3)),n),view)),20.);
      c=c*vColor*(light*1.48)+vec3(.56,.36,.15)*spec*.6;
    }
    if(vMaterial>1.5&&vMaterial<2.5){
      float wave=pow(.5+.5*sin(p.z*19.+sin(p.x*5.+time*.35)*2.-time*.5),20.);
      c=c*.66+vColor*.13+vec3(.36,.42,.35)*wave*.11;
    }
    if(vMaterial>3.5)c*=light*.66;
  }else if(vMaterial>2.5&&vMaterial<3.5)c=vColor;
  else c*=.84+hash(floor(p*150.))*.22;
  float fog=1.-exp(-max(0.,vDepth)*.004);
  c=mix(c,vec3(.09,.14,.15),fog);
  gl_FragColor=vec4(c,1.);
}`;

// The same world-space triangles feed WebGL and the aperture/occlusion checks.
export function buildPortalGeometry(art,patina){
  const batches=[],byTexture=new Map();
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  function batchFor(texture){
    if(!byTexture.has(texture)){const b={vertices:[],texture};byTexture.set(texture,b);batches.push(b);}
    return byTexture.get(texture).vertices;
  }
  function quad(points,color,material=0,texture=null,uv=[[0,0],[1,0],[1,1],[0,1]]){
    const vertices=batchFor(texture),normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0]))),c=rgb(color);
    for(const i of [0,1,2,0,2,3])vertices.push(...points[i],...normal,...c,...uv[i],material);
  }
  function cuboid(center,size,color,material=0,texture=null){
    for(const side of box(center,size,color)){
      const n=unit(cross(sub(side.points[1],side.points[0]),sub(side.points[2],side.points[0])));
      // World-scale patina gives jamb faces and their deep reveals the same grain.
      const uv=side.points.map(p=>Math.abs(n.y)>.5?[p[0]*.22,p[2]*.22]:Math.abs(n.x)>.5?[p[2]*.22,p[1]*.22]:[p[0]*.22,p[1]*.22]);
      quad(side.points,color,material,texture,texture?uv:undefined);
    }
  }
  const palettes=[
    {floor:'#467975',accent:'#f4d59e',stone:'#1c3836'},
    {floor:'#344e38',accent:'#dae6a9',stone:'#1d3025'},
    {floor:'#333e60',accent:'#c8c6f2',stone:'#252d42'},
    {floor:'#578b99',accent:'#d4e9e8',stone:'#355459'},
  ];
  // Sample the scenery inside the original image's doorway. The originals stay intact.
  const crops=[[.285,.055,.740,.77],[.245,.03,.780,.94],[.205,.06,.80,.84],[.245,.045,.765,.79]];
  for(let i=0;i<4;i++){
    const front=10-i*10,back=-i*10,p=palettes[i],tex=art[i],crop=crops[i];
    const {halfWidth:wide,height:ceiling}=ROOM;
    const panoramaUV=([x,y])=>[crop[0]+(x+wide)/(wide*2)*(crop[2]-crop[0]),crop[1]+(ceiling-y)/ceiling*(crop[3]-crop[1])];
    function landscape(points){quad(points,'#ffffff',0,tex,points.map(panoramaUV));}
    function endWall(boundary,opening,inward){
      const z=boundary+(opening?inward*APERTURE.depth/2:0);
      const x=routeX(boundary),left=x-APERTURE.halfWidth,right=x+APERTURE.halfWidth;
      if(!opening){landscape([[-wide,ceiling,z],[wide,ceiling,z],[wide,0,z],[-wide,0,z]]);return;}
      landscape([[-wide,ceiling,z],[left,ceiling,z],[left,0,z],[-wide,0,z]]);
      landscape([[right,ceiling,z],[wide,ceiling,z],[wide,0,z],[right,0,z]]);
      landscape([[left,ceiling,z],[right,ceiling,z],[right,APERTURE.height,z],[left,APERTURE.height,z]]);
    }
    endWall(back,i<3,1);endWall(front,i>0,-1);
    // Separate image-clad volumes surround the path, including during a return turn.
    for(const side of [-1,1]){
      const x=side*wide;
      quad([[x,ceiling,front],[x,ceiling,back],[x,0,back],[x,0,front]],'#ffffff',0,tex,
        [[crop[0],crop[1]],[crop[2],crop[1]],[crop[2],crop[3]],[crop[0],crop[3]]]);
    }
    quad([[-wide,ceiling,front],[wide,ceiling,front],[wide,ceiling,back],[-wide,ceiling,back]],'#ffffff',0,tex,
      [[crop[0],crop[1]],[crop[2],crop[1]],[crop[2],crop[1]+.22],[crop[0],crop[1]+.22]]);
    // The scenic floor continues beneath the raised walkway, with restrained ripples.
    quad([[-wide,-.04,front],[wide,-.04,front],[wide,-.04,back],[-wide,-.04,back]],p.floor,2,tex,
      [[crop[0],crop[3]],[crop[2],crop[3]],[crop[2],.48],[crop[0],.48]]);
    for(let z=back;z<front-.01;z+=.5){
      const x=routeX(z+.25);
      cuboid([x,.065,z+.25],[1.9,.13,.488],p.stone);
      for(const side of [-1,1])cuboid([x+side*.96,.09,z+.25],[.025,.025,.49],p.accent,3);
    }
    // Low stone markers at different depths establish scale beside the walkway.
    for(const distance of [2.1,5,7.8])for(const side of [-1,1]){
      const z=front-distance,x=routeX(z)+side*2.05;
      cuboid([x,.38,z],[.25,.76,.25],p.stone);
      cuboid([x,.775,z],[.27,.025,.27],p.accent,3);
    }
    // Irregular textured outcrops sit at several depths and visibly pass the eye.
    for(const side of [-1,1])for(let j=0;j<8;j++){
      const z=back+.65+j*1.16,x=side*(3.7+(j%3)*1.05),h=.42+(j%4)*.32;
      const points=[[-.8,0,-.6],[.8,0,-.6],[.65,h,-.38],[-.4,h*1.2,-.4],[-.75,0,.6],[.65,0,.6],[.46,h*.8,.45],[-.55,h*.9,.32]].map(q=>[q[0]+x,q[1],q[2]+z]);
      for(const ids of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2]]){
        quad(ids.map(k=>points[k]),p.stone,4,tex,[[.01,.46],[.18,.46],[.18,.77],[.01,.77]]);
      }
    }
  }
  // A 1.4 m deep reveal joins the two wall faces. All faces are opaque and depth-tested.
  for(const z of DOORS){
    const x=routeX(z),edge=APERTURE.halfWidth,h=APERTURE.height,depth=APERTURE.depth;
    for(const side of [-1,1]){
      cuboid([x+side*(edge+.22),h/2,z],[.44,h,depth+.04],'#dbc098',1,patina);
      cuboid([x+side*(edge+.5),h/2,z],[.10,h+.6,depth+.10],'#978268',1,patina);
      for(const face of [-1,1]){
        cuboid([x+side*(edge+.035),h/2,z+face*(depth/2+.04)],[.038,h,.035],'#f2d8ac',3);
        cuboid([x+side*(edge+.3),h/2,z+face*(depth/2+.045)],[.018,h-.12,.03],'#c4aa75',3);
        for(let y=.3;y<h;y+=.6)cuboid([x+side*(edge+.36),y,z+face*(depth/2+.06)],[.045,.045,.025],'#cfb58c',3);
      }
      // Bands across the inner jambs show the distance between entrance and exit.
      for(const inset of [-.42,0,.42])cuboid([x+side*(edge+.012),h/2,z+inset],[.024,h,.025],'#b9a07a',3);
      cuboid([x+side*(edge+.22),.11,z],[.44,.22,depth+.22],'#ae9670',1,patina);
    }
    cuboid([x,h+.22,z],[edge*2+.88,.44,depth+.04],'#dbc098',1,patina);
    for(const face of [-1,1]){
      cuboid([x,h+.035,z+face*(depth/2+.04)],[edge*2,.038,.035],'#f2d8ac',3);
      cuboid([x,.15,z+face*(depth/2+.06)],[edge*2,.03,.045],'#e9c99b',3);
    }
    cuboid([x,.07,z],[edge*2,.14,depth],'#ac996f',1,patina);
  }
  return batches;
}

export function createArchitecture(art,patina){
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:false});
  if(!gl)throw new Error('此浏览器需要开启 WebGL 才能游览展室');
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram(),shaders=[shader(gl.VERTEX_SHADER,vertex),shader(gl.FRAGMENT_SHADER,fragment)];
  shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(true);gl.clearColor(.035,.064,.075,1);
  const uniforms=Object.fromEntries(['eye','yaw','aspect','lens','offset','artwork','textured','time'].map(n=>[n,gl.getUniformLocation(program,n)]));
  const attributes=Object.fromEntries(['position','normal','color','uv','material'].map(n=>[n,gl.getAttribLocation(program,n)]));
  const batches=buildPortalGeometry(art,patina);
  for(const batch of batches){
    batch.count=batch.vertices.length/12;
    batch.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,batch.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(batch.vertices),gl.STATIC_DRAW);
    delete batch.vertices;
    if(batch.texture){
      const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
      let source=batch.texture;
      // WebGL 1 repeating materials require a power-of-two upload; originals are untouched.
      if(source===patina){const tile=document.createElement('canvas');tile.width=tile.height=1024;tile.getContext('2d').drawImage(source,0,0,1024,1024);source=tile;}
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      const wrap=batch.texture===patina?gl.REPEAT:gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);batch.texture=tex;
      if(source.width===1024&&source.height===1024){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
    }
  }
  return {
    canvas,triangles:batches.reduce((sum,b)=>sum+b.count/3,0),
    render(width,height,eye,yaw,time=0){
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      gl.uniform3fv(uniforms.eye,eye);gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.aspect,width/height);
      gl.uniform1f(uniforms.lens,lensForAspect(width/height));gl.uniform1f(uniforms.offset,width/height>1.2?.12:0);
      gl.uniform1f(uniforms.time,time);gl.uniform1i(uniforms.artwork,0);
      for(const b of batches){
        gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);
        for(const [name,size,offset] of [['position',3,0],['normal',3,3],['color',3,6],['uv',2,9],['material',1,11]]){
          gl.enableVertexAttribArray(attributes[name]);gl.vertexAttribPointer(attributes[name],size,gl.FLOAT,false,48,offset*4);
        }
        gl.uniform1f(uniforms.textured,b.texture?1:0);
        if(b.texture)gl.bindTexture(gl.TEXTURE_2D,b.texture);
        gl.drawArrays(gl.TRIANGLES,0,b.count);
      }
    },
    dispose(){for(const b of batches){gl.deleteBuffer(b.buffer);if(b.texture)gl.deleteTexture(b.texture);}shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();},
  };
}
