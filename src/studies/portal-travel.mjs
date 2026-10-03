import {clamp} from './math.mjs';

// Acceleration and braking use seconds/metres, independent of the display rate.
export function createTravel(initial){
  let z=initial,target=initial,velocity=0;
  return {
    get z(){return z;},get target(){return target;},get velocity(){return velocity;},
    get moving(){return Math.abs(target-z)>.0001;},
    go(next){target=next;},
    seek(next){z=target=next;velocity=0;},
    step(dt){
      if(dt<=0)return;
      // Substeps keep braking stable on slower frames and during deterministic replay.
      const count=Math.ceil(dt/.008),delta=dt/count;
      for(let i=0;i<count;i++){
        const distance=target-z;
        const desired=Math.sign(distance)*Math.min(2.6,Math.sqrt(2*2.2*Math.abs(distance)));
        velocity+=clamp(desired-velocity,-2.2*delta,2.2*delta);
        const step=velocity*delta;
        if(Math.abs(step)>=Math.abs(distance)&&step*distance>=0){z=target;velocity=0;}
        else z+=step;
      }
    },
  };
}
