import * as THREE from 'three';

// An upright optical dock withdraws along the camera ray as the pillar folds.
// Its projected outline stays fixed; the whole solid changes depth smoothly.
export function rampPoseWeight(ramp,angle){
  return ramp.uprightPower?Math.pow(Math.max(0,1-Math.sin(angle)),ramp.uprightPower):1;
}

// A camera-ray offset changes depth without changing the fixed isometric pixel.
// Ramps meet on shared positions, including corners and duplicate face vertices.
export function opticalDepth(level,part,point,angle=0){
  const spec=level.opticalDepths?.[part];
  if(!spec)return 0;
  const weight=(r)=>THREE.MathUtils.clamp((point[r.axis]-r.end)/(r.start-r.end),0,1);
  // A folding landing approaches its final depth continuously as the beam docks.
  const alignment=spec.posePower?Math.pow(Math.max(0,Math.sin(angle)),spec.posePower):1;
  return (spec.offset||0)*alignment+(spec.ramps||[]).reduce((sum,r)=>sum+r.amount*rampPoseWeight(r,angle)*weight(r)*(r.gate?weight(r.gate):1),0);
}

export function opticalPart(level,segment){
  return level.paths.find(path=>segment===path.id||segment.startsWith(path.id+'-'))?.id;
}
