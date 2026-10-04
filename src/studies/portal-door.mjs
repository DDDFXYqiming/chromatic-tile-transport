import {ry,sub,add} from './math.mjs';

// Evaluated Blender geometry. The renderer uses these same groups and hinge poses.
export const DOOR_ASSET=new URL('../../assets/studies/portal-door/door.mesh.json?v=bronze-leaves-r10',import.meta.url);
export const DOOR_OPEN=88*Math.PI/180;
export const DOOR_TRIGGER=3.8;
export const DOOR_WAIT=2.5;
export const DOOR_SECONDS=1.8;

export async function loadDoorAsset(){
  const response=await fetch(DOOR_ASSET);
  if(!response.ok)throw new Error('铜门模型读取失败');
  const asset=await response.json();
  if(asset.revision!=='bronze-leaves-r10'||asset.groups?.length!==3||Math.abs(asset.openingRadians-DOOR_OPEN)>1e-8)
    throw new Error('铜门模型版本不匹配');
  return asset;
}

export function doorBatches(asset,patina,doors,routeX){
  return doors.flatMap((z,index)=>asset.groups.map(group=>({
    vertices:group.vertices,texture:patina,door:index,side:group.side,
    pivot:[group.side*asset.hingeX,0,0],origin:[routeX(z),0,z],
  })));
}

export function doorPose(batch,states=[]){
  const state=states[batch.door];
  return {angle:batch.side&&state?-batch.side*state.direction*state.angle:0,
    pivot:batch.pivot||[0,0,0],origin:batch.origin||[0,0,0]};
}

// Used by offline mesh checks and Blender review exports; matches the vertex shader.
export function posedVertices(batch,states=[]){
  const {angle,pivot,origin}=doorPose(batch,states),out=[];
  for(let i=0;i<batch.vertices.length;i+=12){
    const v=batch.vertices.slice(i,i+12);
    out.push(...add(add(ry(sub(v.slice(0,3),pivot),angle),pivot),origin),
      ...ry(v.slice(3,6),angle),...v.slice(6));
  }
  return out;
}
