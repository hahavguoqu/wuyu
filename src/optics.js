import * as THREE from 'three';

// A camera-ray offset changes depth without changing the fixed isometric pixel.
// Ramps meet on shared positions, including corners and duplicate face vertices.
export function opticalDepth(level,part,point,angle=0){
  const spec=level.opticalDepths?.[part];
  if(!spec)return 0;
  const weight=(r)=>THREE.MathUtils.clamp((point[r.axis]-r.end)/(r.start-r.end),0,1);
  // A folding landing approaches its final depth continuously as the beam docks.
  const alignment=spec.posePower?Math.pow(Math.max(0,Math.sin(angle)),spec.posePower):1;
  return (spec.offset||0)*alignment+(spec.ramps||[]).reduce((sum,r)=>sum+r.amount*weight(r)*(r.gate?weight(r.gate):1),0);
}

export function opticalPart(level,segment){
  return level.paths.find(path=>segment===path.id||segment.startsWith(path.id+'-'))?.id;
}
