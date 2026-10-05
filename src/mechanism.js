import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {mechanismQuaternion} from './levels.js';

export function applyMechanismPose(level,stage,value){
  stage.mechanism.quaternion.copy(mechanismQuaternion(level,value));
  stage.mechanism.updateWorldMatrix(true,true);
  stage.shade?.();
  // Mating end faces become internal at an optical joint. Rendering those faces
  // would cover the adjoining floor because its true camera depth is different.
  const turn=Math.round(value/(Math.PI/2)),orientation=((turn%4)+4)%4,settled=Math.abs(value-turn*Math.PI/2)<.001;
  for(const cap of stage.caps||[])cap.mesh.material[cap.index].visible=!(settled&&cap.states.includes(orientation));
}
export function prepareColliders(stage){
  stage.group.updateWorldMatrix(true,true);
  const collider=mesh=>{
    mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
    // Allow touching mating faces while rejecting actual interpenetration.
    const local=new OBB(box.getCenter(new THREE.Vector3()),box.getSize(new THREE.Vector3()).multiplyScalar(.5).addScalar(-.002));
    return {mesh,local,world:local.clone().applyMatrix4(mesh.matrixWorld)};
  };
  stage.fixedColliders=stage.fixedSolids.map(collider);stage.movingColliders=stage.movingSolids.map(collider);
}
export function collisionPairs(stage){
  stage.mechanism.updateWorldMatrix(true,true);
  const pairs=[];
  for(const moving of stage.movingColliders){
    moving.world.copy(moving.local).applyMatrix4(moving.mesh.matrixWorld);
    for(const fixed of stage.fixedColliders)if(moving.world.intersectsOBB(fixed.world,0))pairs.push([moving.mesh,fixed.mesh]);
  }
  return pairs;
}
export function safeMechanismValue(level,stage,from,to){
  if(level.tilt)to=THREE.MathUtils.clamp(to,0,Math.PI/2);
  const span=Math.abs(to-from)/.015;
  const steps=Math.max(1,Math.ceil(span));let safe=from;
  for(let i=1;i<=steps;i++){
    const value=THREE.MathUtils.lerp(from,to,i/steps);applyMechanismPose(level,stage,value);
    if(collisionPairs(stage).length){applyMechanismPose(level,stage,safe);return safe;}
    safe=value;
  }
  return safe;
}
