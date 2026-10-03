import {clamp} from './math.mjs';

// Acceleration and braking use seconds/metres, independent of the display rate.
export function createTravel(initial,doors=[]){
  let z=initial,target=initial,velocity=0;
  return {
    get z(){return z;},get target(){return target;},get velocity(){return velocity;},
    get moving(){return Math.abs(target-z)>.0001;},
    go(next){target=next;},
    seek(next){z=target=next;velocity=0;},
    brake(dt){velocity+=clamp(-velocity,-2.2*dt,2.2*dt);},
    step(dt){
      if(dt<=0)return;
      // Substeps keep braking stable on slower frames and during deterministic replay.
      const count=Math.ceil(dt/.008),delta=dt/count;
      for(let i=0;i<count;i++){
        const distance=target-z;
        // Ease the walking pace through the deep jamb; keep every intermediate pose.
        const thresholdDistance=Math.min(...doors.map(door=>Math.abs(z-door)));
        const walkingSpeed=1.25+1.35*Math.min(1,thresholdDistance/2.5);
        const desired=Math.sign(distance)*Math.min(walkingSpeed,Math.sqrt(2*2.2*Math.abs(distance)));
        velocity+=clamp(desired-velocity,-2.2*delta,2.2*delta);
        const step=velocity*delta;
        if(Math.abs(step)>=Math.abs(distance)&&step*distance>=0){z=target;velocity=0;}
        else z+=step;
      }
    },
  };
}
