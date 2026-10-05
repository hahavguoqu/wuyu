import * as THREE from 'three';

export const BUILDING_LAYER=0,CONTROL_LAYER=1,TRAVELLER_LAYER=2;
export function setLayer(root,layer){root.traverse(object=>object.layers.set(layer));}

// In a fixed isometric view, (d,d,d) changes depth without moving a pixel.
// Optical end caps sit behind the adjacent floors throughout a turn. They remain
// visible wherever the projection is uncovered; no face disappears at a detent.
// Picking uses the same displayed depth; collision geometry stays real.
export function setDepthProfile(mesh,profile){
  const position=mesh.geometry.attributes.position,depth=new Float32Array(position.count);
  for(let i=0;i<position.count;i++)depth[i]=profile(new THREE.Vector3().fromBufferAttribute(position,i),i);
  mesh.geometry.setAttribute('isometricDepth',new THREE.BufferAttribute(depth,1));
  mesh.userData.depthProfile=profile;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float isometricDepth;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nmvPosition.z += isometricDepth * 1.7320508075688772;\ngl_Position = projectionMatrix * mvPosition;');
    };
    material.customProgramCacheKey=()=> 'continuous-isometric-depth-v1';
    material.needsUpdate=true;
  }
}

export function visibleHitPoint(hit){
  const mesh=hit.object,depth=mesh.geometry?.attributes.isometricDepth;
  if(!depth||!hit.face)return hit.point.clone();
  const vertices=mesh.geometry.attributes.position,triangle=new THREE.Triangle(...[hit.face.a,hit.face.b,hit.face.c].map(i=>new THREE.Vector3().fromBufferAttribute(vertices,i)));
  const weights=triangle.getBarycoord(mesh.worldToLocal(hit.point.clone()),new THREE.Vector3());
  const offset=weights.x*depth.getX(hit.face.a)+weights.y*depth.getX(hit.face.b)+weights.z*depth.getX(hit.face.c);
  return hit.point.clone().addScalar(offset);
}
export function renderLayers(renderer,scene,camera){
  renderer.clear();
  for(const layer of [BUILDING_LAYER,CONTROL_LAYER,TRAVELLER_LAYER]){
    if(layer!==BUILDING_LAYER)renderer.clearDepth();
    camera.layers.set(layer);renderer.render(scene,camera);
  }
  camera.layers.set(BUILDING_LAYER);
}
