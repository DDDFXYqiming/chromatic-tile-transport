import {box,cross,sub,unit} from './math.mjs';

// One continuous world: chapters change only when the eye crosses an aperture.
export const STOPS=[5.8,-5.4,-15.4,-25.4];
export const DOORS=[0,-10,-20];
export const routeX=z=>.42*Math.sin((5.8-z)*.16);
export const roomAt=z=>DOORS.filter(door=>z<door).length;
export const APERTURE={halfWidth:2.9,height:5.8};

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
uniform float textured,time,roomZ,horizon;
uniform vec4 crop;
uniform vec3 eye;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){
  vec3 p=vPosition,n=normalize(vNormal);
  float light=.60+.38*abs(dot(n,normalize(vec3(-.45,.8,.3))));
  vec3 c=vColor*light;
  if(textured>.5){
    vec2 uv=vUV;
    if(vMaterial<.5){
      // Shared angular coordinates keep the sky and the surrounding wings continuous.
      vec3 d=p-vec3(0.,2.65,roomZ);
      float depth=sqrt(d.z*d.z+64.);
      vec2 angle=vec2(atan(d.x,depth),atan(d.y,sqrt(d.x*d.x+depth*depth)));
      uv=mix(crop.xy,crop.zw,clamp(vec2(.5+angle.x*.39,horizon-angle.y*.59),0.,1.));
    }
    if(vMaterial>1.5&&vMaterial<2.5){
      uv+=vec2(sin(p.z*3.+time*.3),cos(p.x*3.-time*.22))*.0018;
    }
    if(vMaterial>.5&&vMaterial<1.5){
      uv=abs(n.y)>.5?p.xz*.48:abs(n.x)>.5?p.zy*.48:p.xy*.48;
    }
    c=texture2D(artwork,uv).rgb;
    if(vMaterial<.5)c*=.96;
    if(vMaterial>.5&&vMaterial<1.5){
      vec3 view=normalize(eye-p);
      float spec=pow(max(0.,dot(reflect(-normalize(vec3(-.45,.8,.3)),n),view)),20.);
      c=c*(light*1.24)+vec3(.56,.36,.15)*spec*.6;
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

export function createArchitecture(art,patina){
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:false});
  if(!gl)throw new Error('此浏览器需要开启 WebGL 才能游览展室');
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram(),shaders=[shader(gl.VERTEX_SHADER,vertex),shader(gl.FRAGMENT_SHADER,fragment)];
  shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.clearColor(.035,.064,.075,1);
  const uniforms=Object.fromEntries(['eye','yaw','aspect','lens','offset','artwork','textured','time','roomZ','horizon','crop'].map(n=>[n,gl.getUniformLocation(program,n)]));
  const attributes=Object.fromEntries(['position','normal','color','uv','material'].map(n=>[n,gl.getAttribLocation(program,n)]));
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
    const front=10-i*10,back=-i*10,mid=(front+back)/2,p=palettes[i],tex=art[i],crop=crops[i];
    const panoramaUV=([x,y])=>[crop[0]+(x+12)/24*(crop[2]-crop[0]),crop[1]+(6.8-y)/7*(crop[3]-crop[1])];
    function landscape(points){quad(points,'#ffffff',0,tex,points.map(panoramaUV));}
    function endWall(z,opening){
      const x=routeX(z),left=x-APERTURE.halfWidth,right=x+APERTURE.halfWidth;
      if(!opening){landscape([[-12,6.8,z],[12,6.8,z],[12,-.2,z],[-12,-.2,z]]);return;}
      landscape([[-12,6.8,z],[left,6.8,z],[left,-.2,z],[-12,-.2,z]]);
      landscape([[right,6.8,z],[12,6.8,z],[12,-.2,z],[right,-.2,z]]);
      landscape([[left,6.8,z],[right,6.8,z],[right,APERTURE.height,z],[left,APERTURE.height,z]]);
    }
    endWall(back+.025,i<3);endWall(front-.025,i>0);
    // Bent wings and overhead imagery surround the walking space, including on a turn.
    for(const side of [-1,1]){
      const x=side*12;
      quad([[x,6.8,front],[x,6.8,back],[x,-.2,back],[x,-.2,front]],'#ffffff',0,tex,
        [[crop[0],crop[1]],[crop[2],crop[1]],[crop[2],crop[3]],[crop[0],crop[3]]]);
    }
    quad([[-12,6.8,front],[12,6.8,front],[12,6.8,back],[-12,6.8,back]],'#ffffff',0,tex,
      [[crop[0],crop[1]],[crop[2],crop[1]],[crop[2],crop[1]+.22],[crop[0],crop[1]+.22]]);
    // The scenic floor continues beneath the raised walkway, with restrained ripples.
    quad([[-12,-.04,front],[12,-.04,front],[12,-.04,back],[-12,-.04,back]],p.floor,2,tex,
      [[crop[0],crop[3]],[crop[2],crop[3]],[crop[2],.48],[crop[0],.48]]);
    for(let z=back;z<front;z+=.8){
      const x=routeX(z+.4);
      cuboid([x,.065,z+.4],[2.25,.13,.785],p.stone);
      for(const side of [-1,1])cuboid([x+side*1.13,.09,z+.4],[.025,.025,.785],p.accent,3);
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
  // Copper portals occupy real depth. Both the forward face and return face are modeled.
  for(const z of DOORS){
    const x=routeX(z),edge=APERTURE.halfWidth,h=APERTURE.height;
    for(const side of [-1,1]){
      cuboid([x+side*(edge+.25),h/2,z],[.50,h+.5,1.0],'#b7a177',1,patina);
      cuboid([x+side*(edge+.55),h/2,z],[.085,h+.75,1.1],'#b7a177',1,patina);
      for(const face of [-1,1]){
        cuboid([x+side*(edge+.055),h/2,z+face*.515],[.032,h,.03],'#e9c99b',3);
        cuboid([x+side*(edge+.32),h/2,z+face*.52],[.016,h-.15,.028],'#c4aa75',3);
        for(let y=.35;y<h;y+=.75)cuboid([x+side*(edge+.43),y,z+face*.54],[.045,.045,.025],'#cfb58c',3);
      }
      cuboid([x+side*(edge+.25),.11,z],[.7,.22,1.28],'#ae9670',1,patina);
    }
    cuboid([x,h+.25,z],[edge*2+1,.5,1.0],'#b7a177',1,patina);
    for(const face of [-1,1])cuboid([x,h+.045,z+face*.515],[edge*2,.03,.03],'#e9c99b',3);
    cuboid([x,.025,z],[edge*2,.05,1.0],'#ac996f',1,patina);
  }
  for(const batch of batches){
    const sceneIndex=art.indexOf(batch.texture);
    batch.roomZ=STOPS[sceneIndex]||0;batch.crop=crops[sceneIndex]||[0,0,1,1];
    batch.horizon=[.40,.47,.41,.43][sceneIndex]||.5;
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
      gl.uniform1f(uniforms.lens,width/height<1?.82:1.58);gl.uniform1f(uniforms.offset,width/height>1.2?.15:0);
      gl.uniform1f(uniforms.time,time);gl.uniform1i(uniforms.artwork,0);
      for(const b of batches){
        gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);
        for(const [name,size,offset] of [['position',3,0],['normal',3,3],['color',3,6],['uv',2,9],['material',1,11]]){
          gl.enableVertexAttribArray(attributes[name]);gl.vertexAttribPointer(attributes[name],size,gl.FLOAT,false,48,offset*4);
        }
        gl.uniform1f(uniforms.textured,b.texture?1:0);
        gl.uniform1f(uniforms.roomZ,b.roomZ);gl.uniform1f(uniforms.horizon,b.horizon);gl.uniform4fv(uniforms.crop,b.crop);
        if(b.texture)gl.bindTexture(gl.TEXTURE_2D,b.texture);
        gl.drawArrays(gl.TRIANGLES,0,b.count);
      }
    },
    dispose(){for(const b of batches){gl.deleteBuffer(b.buffer);if(b.texture)gl.deleteTexture(b.texture);}shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();},
  };
}
