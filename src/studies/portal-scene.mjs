import {box,cross,sub,unit} from './math.mjs';
import {doorBatches,doorPose} from './portal-door.mjs';

// One continuous world: chapters change only when the eye crosses an aperture.
export const STOPS=[4.6,-5.4,-15.4,-25.4];
export const DOORS=[0,-10,-20];
export const routeX=z=>.72*Math.sin((STOPS[0]-z)*.26);
export const roomAt=z=>DOORS.filter(door=>z<door).length;
export const APERTURE={halfWidth:1.18,height:3.25,depth:2.4};
export const EYE_HEIGHT=1.72;
export const ROOM={halfWidth:5.6,height:4.6};
export const SCENE_REVISION='hinged-bronze-r10';
// Keep the whole doorway visible at rest, including in a portrait viewport.
export const lensForAspect=aspect=>Math.min(1.42,aspect*1.42);

const vertex=`
attribute vec3 position,normal,color;
attribute vec2 uv;
attribute float material;
uniform vec3 eye;
uniform float yaw,aspect,lens,offset;
uniform vec3 pivot,origin;
uniform float hingeAngle;
varying vec3 vPosition,vNormal,vColor;
varying vec2 vUV;
varying float vMaterial,vDepth;
void main(){
  float c=cos(hingeAngle),s=sin(hingeAngle);
  mat3 rotation=mat3(c,0.,-s,0.,1.,0.,s,0.,c);
  vec3 world=rotation*(position-pivot)+pivot+origin;
  vec3 p=world-eye;
  float x=cos(yaw)*p.x+sin(yaw)*p.z;
  float z=sin(yaw)*p.x-cos(yaw)*p.z;
  gl_Position=vec4(x*lens/aspect+offset*z,p.y*lens,1.002*z-.1001,z);
  vPosition=world;vNormal=rotation*normal;vColor=color;vUV=uv;vMaterial=material;vDepth=z;
}`;
const fragment=`
precision highp float;
varying vec3 vPosition,vNormal,vColor;
varying vec2 vUV;
varying float vMaterial,vDepth;
uniform sampler2D artwork;
uniform float textured;
uniform vec3 eye;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){
  vec3 p=vPosition,n=normalize(vNormal);
  float light=.54+.44*abs(dot(n,normalize(vec3(-.45,.8,.3))));
  vec3 c=vColor*light;
  if(textured>.5){
    vec2 uv=vUV;
    c=texture2D(artwork,uv).rgb;
    // Artwork belongs to recessed exhibition walls; architecture has its own material.
    if(vMaterial<.5)c*=.90+.08*abs(n.z);
    if(vMaterial>.5&&vMaterial<1.5){
      vec3 view=normalize(eye-p);
      float spec=pow(max(0.,dot(reflect(-normalize(vec3(-.45,.8,.3)),n),view)),20.);
      c=c*vColor*(light*1.48)+vec3(.56,.36,.15)*spec*.6;
    }
  }else if(vMaterial>2.5&&vMaterial<3.5)c=vColor;
  else {
    c*=.91+hash(floor(p*95.))*.14;
    // World-space joints make the floor and masonry scale readable during a walk.
    vec2 grid=abs(n.y)>.5?p.xz:abs(n.x)>.5?p.zy:p.xy;
    vec2 cell=fract(grid/vec2(1.2,.6));
    float seam=step(.976,cell.x)+step(.96,cell.y);
    c*=1.-min(1.,seam)*.22;
    if(vMaterial>3.5)c*=.85+.15*step(.018,fract(p.z*.5));
  }
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
    {wall:'#52706b',floor:'#304b47',accent:'#e6c998',stone:'#7c9183'},
    {wall:'#65725a',floor:'#354439',accent:'#dce2b0',stone:'#829178'},
    {wall:'#566079',floor:'#303b50',accent:'#c9c5e9',stone:'#7d8a9d'},
    {wall:'#68818a',floor:'#3b545e',accent:'#c9e0dc',stone:'#98aaa6'},
  ];
  // Use the original scenic crops as monumental wall works in a solid stone gallery.
  const crops=[[.285,.055,.740,.77],[.245,.03,.780,.94],[.205,.06,.80,.84],[.245,.045,.765,.79]];
  for(let i=0;i<4;i++){
    const front=10-i*10,back=-i*10,p=palettes[i],tex=art[i],crop=crops[i];
    const {halfWidth:wide,height:ceiling}=ROOM;
    const panoramaUV=([x,y])=>[crop[0]+(x+wide)/(wide*2)*(crop[2]-crop[0]),crop[1]+(ceiling-y)/ceiling*(crop[3]-crop[1])];
    function masonry(points){quad(points,p.wall,2);}
    function mural(left,right,z,inward){
      const low=.48,high=3.95;
      // A deep stone backing and wide surround keep the art distinct from the aperture.
      cuboid([(left+right)/2,(low+high)/2,z],[right-left+.20,high-low+.20,.12],p.floor,2);
      const at=z+inward*.071;
      const points=[[left,high,at],[right,high,at],[right,low,at],[left,low,at]];
      quad(points,'#ffffff',0,tex,points.map(panoramaUV));
      cuboid([(left+right)/2,low-.055,z+inward*.1],[right-left+.22,.07,.18],p.stone,2);
    }
    function endWall(boundary,opening,inward){
      const z=boundary+(opening?inward*APERTURE.depth/2:0);
      const x=routeX(boundary),left=x-APERTURE.halfWidth,right=x+APERTURE.halfWidth;
      if(!opening){
        masonry([[-wide,ceiling,z],[wide,ceiling,z],[wide,0,z],[-wide,0,z]]);
        mural(-wide+.4,wide-.4,z+inward*.09,inward);return;
      }
      masonry([[-wide,ceiling,z],[left,ceiling,z],[left,0,z],[-wide,0,z]]);
      masonry([[right,ceiling,z],[wide,ceiling,z],[wide,0,z],[right,0,z]]);
      masonry([[left,ceiling,z],[right,ceiling,z],[right,APERTURE.height,z],[left,APERTURE.height,z]]);
      mural(-wide+.4,left-.94,z+inward*.09,inward);
      mural(right+.94,wide-.4,z+inward*.09,inward);
    }
    endWall(back,i<3,1);endWall(front,i>0,-1);
    // The structural shell remains stone at every camera position.
    for(const side of [-1,1]){
      const x=side*wide;
      masonry([[x,ceiling,front],[x,ceiling,back],[x,0,back],[x,0,front]]);
      // Side-wall panoramas are bounded exhibits, visible in perspective on arrival/return.
      const at=x-side*.07,start=back+2,end=front-2;
      cuboid([x-side*.035,2.22,(start+end)/2],[.06,3.38,end-start+.20],p.floor,2);
      quad([[at,3.85,start],[at,3.85,end],[at,.6,end],[at,.6,start]],'#ffffff',0,tex,
        [[crop[0],crop[1]],[crop[2],crop[1]],[crop[2],crop[3]],[crop[0],crop[3]]]);
      cuboid([x-side*.16,.48,(start+end)/2],[.32,.16,end-start+.24],p.stone,2);
    }
    quad([[-wide,ceiling,front],[wide,ceiling,front],[wide,ceiling,back],[-wide,ceiling,back]],p.floor,2);
    quad([[-wide,0,front],[wide,0,front],[wide,0,back],[-wide,0,back]],p.floor,4);
    const clearBack=back+(i<3?APERTURE.depth/2:0),clearFront=front-(i>0?APERTURE.depth/2:0);
    for(let z=clearBack+.01;z<clearFront-.02;z+=.6){
      const end=Math.min(z+.59,clearFront-.01),x=routeX((z+end)/2);
      cuboid([x,.065,(z+end)/2],[1.92,.13,end-z],p.stone,4);
      for(const side of [-1,1])cuboid([x+side*.97,.08,(z+end)/2],[.032,.025,end-z],p.accent,3);
    }
    // Repeated ceiling beams and piers cross the field of view at different depths.
    for(const distance of [2,5,8]){
      const z=front-distance;
      cuboid([0,ceiling-.16,z],[wide*2,.32,.3],p.stone,2);
      for(const side of [-1,1]){
        cuboid([side*(wide-.14),ceiling/2,z],[.28,ceiling,.36],p.stone,2);
        cuboid([side*(wide-.3),ceiling-.4,z],[.055,.05,.6],p.accent,3);
      }
    }
    for(const side of [-1,1]){
      const z=front-5.8,x=routeX(z)+side*2.3;
      cuboid([x,.38,z],[.65,.76,1.15],p.floor,2);
      cuboid([x,.79,z],[.75,.06,1.25],p.stone,2);
      cuboid([x,1.13,z],[.22,.62,.32],p.accent,1,patina);
    }
  }
  // Broad 2.4 m deep bronze piers fill the aperture surround, including both returns.
  for(const z of DOORS){
    const x=routeX(z),edge=APERTURE.halfWidth,h=APERTURE.height,depth=APERTURE.depth;
    for(const side of [-1,1]){
      cuboid([x+side*(edge+.38),h/2,z],[.76,h,depth+.04],'#dbc098',1,patina);
      cuboid([x+side*(edge+.83),h/2,z],[.14,h+.8,depth+.16],'#8d9c87',2);
      for(const face of [-1,1]){
        cuboid([x+side*(edge+.065),h/2,z+face*(depth/2+.06)],[.10,h,.09],'#e9c78f',1,patina);
        cuboid([x+side*(edge+.64),h/2,z+face*(depth/2+.05)],[.055,h-.12,.045],'#c4aa75',3);
        for(let y=.3;y<h;y+=.6)cuboid([x+side*(edge+.48),y,z+face*(depth/2+.06)],[.07,.07,.05],'#cfb58c',3);
      }
      // Three transverse ribs remain beside/above the eye while it is inside the passage.
      for(const inset of [-.85,0,.85]){
        cuboid([x+side*(edge+.003),h/2,z+inset],[.04,h,.055],'#d5b980',3);
      }
      cuboid([x+side*(edge+.38),.11,z],[.76,.22,depth+.22],'#ae9670',1,patina);
    }
    cuboid([x,h+.32,z],[edge*2+1.52,.64,depth+.04],'#dbc098',1,patina);
    for(const inset of [-.85,0,.85])cuboid([x,h-.005,z+inset],[edge*2,.04,.055],'#d5b980',3);
    for(const face of [-1,1]){
      cuboid([x,h+.065,z+face*(depth/2+.06)],[edge*2,.10,.09],'#e9c78f',1,patina);
      cuboid([x,.17,z+face*(depth/2+.07)],[edge*2,.035,.09],'#e9c99b',3);
    }
    cuboid([x,.08,z],[edge*2,.16,depth],'#ac996f',1,patina);
  }
  return batches;
}

export function createArchitecture(art,patina,doorAsset){
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:false});
  if(!gl)throw new Error('此浏览器需要开启 WebGL 才能游览展室');
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram(),shaders=[shader(gl.VERTEX_SHADER,vertex),shader(gl.FRAGMENT_SHADER,fragment)];
  shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(true);gl.clearColor(.035,.064,.075,1);
  const uniforms=Object.fromEntries(['eye','yaw','aspect','lens','offset','artwork','textured','pivot','origin','hingeAngle'].map(n=>[n,gl.getUniformLocation(program,n)]));
  const attributes=Object.fromEntries(['position','normal','color','uv','material'].map(n=>[n,gl.getAttribLocation(program,n)]));
  const batches=[...buildPortalGeometry(art,patina),...doorBatches(doorAsset,patina,DOORS,routeX)];
  const textures=new Map();
  for(const batch of batches){
    batch.count=batch.vertices.length/12;
    batch.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,batch.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(batch.vertices),gl.STATIC_DRAW);
    delete batch.vertices;
    if(batch.texture){
      if(textures.has(batch.texture)){batch.texture=textures.get(batch.texture);continue;}
      const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
      let source=batch.texture;
      // WebGL 1 repeating materials require a power-of-two upload; originals are untouched.
      if(source===patina){const tile=document.createElement('canvas');tile.width=tile.height=1024;tile.getContext('2d').drawImage(source,0,0,1024,1024);source=tile;}
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      const wrap=batch.texture===patina?gl.REPEAT:gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
      textures.set(batch.texture,tex);batch.texture=tex;
      if(source.width===1024&&source.height===1024){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
    }
  }
  return {
    canvas,triangles:batches.reduce((sum,b)=>sum+b.count/3,0),
    render(width,height,eye,yaw,doors){
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      gl.uniform3fv(uniforms.eye,eye);gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.aspect,width/height);
      gl.uniform1f(uniforms.lens,lensForAspect(width/height));gl.uniform1f(uniforms.offset,width/height>1.2?.12:0);
      gl.uniform1i(uniforms.artwork,0);
      for(const b of batches){
        const pose=doorPose(b,doors);
        gl.uniform3fv(uniforms.pivot,pose.pivot);gl.uniform3fv(uniforms.origin,pose.origin);gl.uniform1f(uniforms.hingeAngle,pose.angle);
        gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);
        for(const [name,size,offset] of [['position',3,0],['normal',3,3],['color',3,6],['uv',2,9],['material',1,11]]){
          gl.enableVertexAttribArray(attributes[name]);gl.vertexAttribPointer(attributes[name],size,gl.FLOAT,false,48,offset*4);
        }
        gl.uniform1f(uniforms.textured,b.texture?1:0);
        if(b.texture)gl.bindTexture(gl.TEXTURE_2D,b.texture);
        gl.drawArrays(gl.TRIANGLES,0,b.count);
      }
    },
    dispose(){for(const b of batches)gl.deleteBuffer(b.buffer);for(const tex of textures.values())gl.deleteTexture(tex);shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();},
  };
}
