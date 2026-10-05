import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';

export function applyMechanismPose(level,stage,value){
  if(level.mechanic==='rotate')stage.mechanism.rotation.y=value;
  else stage.mechanism.position.lerpVectors(new THREE.Vector3(...level.near),new THREE.Vector3(...level.far),value);
  stage.mechanism.updateWorldMatrix(true,true);
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
  const span=level.mechanic==='rotate'?Math.abs(to-from)/.015:Math.abs(to-from)*new THREE.Vector3(...level.near).distanceTo(new THREE.Vector3(...level.far))/.03;
  const steps=Math.max(1,Math.ceil(span));let safe=from;
  for(let i=1;i<=steps;i++){
    const value=THREE.MathUtils.lerp(from,to,i/steps);applyMechanismPose(level,stage,value);
    if(collisionPairs(stage).length){applyMechanismPose(level,stage,safe);return safe;}
    safe=value;
  }
  return safe;
}
