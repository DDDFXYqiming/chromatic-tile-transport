import {clamp} from './math.mjs';
import {DOOR_OPEN,DOOR_TRIGGER,DOOR_WAIT,DOOR_SECONDS} from './portal-door.mjs';

// Acceleration and braking use seconds/metres, independent of the display rate.
export function createTravel(initial,doors=[]){
  let z=initial,target=initial,velocity=0;
  const leaves=doors.map(z=>({z,angle:0,direction:1}));
  function doorsAtPose(){
    for(const leaf of leaves){
      leaf.angle=Math.abs(z-leaf.z)<DOOR_TRIGGER?DOOR_OPEN:0;
    }
  }
  doorsAtPose();
  return {
    get z(){return z;},get target(){return target;},get velocity(){return velocity;},
    get doors(){return leaves.map(leaf=>({...leaf}));},
    get waiting(){return leaves.some(leaf=>Math.abs(z-leaf.z)<=DOOR_WAIT+.03&&leaf.angle<DOOR_OPEN-.001&&(target-leaf.z)*(z-leaf.z)<0);},
    get moving(){return Math.abs(target-z)>.0001;},
    go(next){target=next;},
    seek(next){z=target=next;velocity=0;doorsAtPose();},
    brake(dt){velocity+=clamp(-velocity,-2.2*dt,2.2*dt);},
    step(dt){
      if(dt<=0)return;
      // Substeps keep braking stable on slower frames and during deterministic replay.
      const count=Math.ceil(dt/.008),delta=dt/count;
      for(let i=0;i<count;i++){
        const distance=target-z;
        let available=Math.abs(distance);
        for(const leaf of leaves){
          const separation=Math.abs(z-leaf.z);
          const crossing=(target-leaf.z)*(z-leaf.z)<=0&&Math.abs(distance)>.001;
          const wanted=(crossing&&separation<DOOR_TRIGGER)||separation<=DOOR_WAIT;
          if(wanted&&leaf.angle===0)leaf.direction=z>=leaf.z?1:-1;
          // A leaf keeps its swing direction until fully closed, including retargets.
          const nextAngle=wanted?DOOR_OPEN:separation>DOOR_TRIGGER?0:leaf.angle;
          leaf.angle+=clamp(nextAngle-leaf.angle,-DOOR_OPEN/DOOR_SECONDS*delta,DOOR_OPEN/DOOR_SECONDS*delta);
          if(crossing&&leaf.angle<DOOR_OPEN-.001)
            available=Math.min(available,Math.max(0,separation-DOOR_WAIT));
        }
        // Ease the walking pace through the deep jamb; keep every intermediate pose.
        const thresholdDistance=Math.min(...doors.map(door=>Math.abs(z-door)));
        const walkingSpeed=1.25+1.35*Math.min(1,thresholdDistance/2.5);
        const desired=Math.sign(distance)*Math.min(walkingSpeed,Math.sqrt(2*2.2*available));
        velocity+=clamp(desired-velocity,-2.2*delta,2.2*delta);
        let step=velocity*delta;
        if(step*distance>=0&&Math.abs(step)>available){step=Math.sign(step)*available;velocity=0;}
        if(Math.abs(distance)<.0001||(Math.abs(step)>=Math.abs(distance)&&step*distance>=0)){z=target;velocity=0;}
        else z+=step;
        if(Math.abs(target-z)<.0001){z=target;velocity=0;}
      }
    },
  };
}
