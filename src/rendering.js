import * as THREE from 'three';

export const BUILDING_LAYER=0,CONTROL_LAYER=1,TRAVELLER_LAYER=2;
export function setLayer(root,layer){root.traverse(object=>object.layers.set(layer));}

// In a fixed isometric view, (d,d,d) changes depth without moving a pixel.
// The profile belongs to the displayed surface, including its picking depth.
// Collision geometry stays real. Existing buffers can be updated during motion.
export function setDepthProfile(mesh,profile){
  const position=mesh.geometry.attributes.position,existing=mesh.geometry.attributes.isometricDepth;
  const depth=existing||new THREE.BufferAttribute(new Float32Array(position.count),1);
  for(let i=0;i<position.count;i++)depth.setX(i,profile(new THREE.Vector3().fromBufferAttribute(position,i),i));
  if(!existing)mesh.geometry.setAttribute('isometricDepth',depth);
  depth.needsUpdate=true;
  mesh.userData.depthProfile=profile;
  if(existing)return;
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
  const mesh=hit.object,shear=mesh.userData.opticalShear,depth=mesh.geometry?.attributes.isometricDepth;
  if((!depth&&!shear)||!hit.face)return hit.point.clone();
  const vertices=mesh.geometry.attributes.position,triangle=new THREE.Triangle(...[hit.face.a,hit.face.b,hit.face.c].map(i=>new THREE.Vector3().fromBufferAttribute(vertices,i)));
  const weights=triangle.getBarycoord(mesh.worldToLocal(hit.point.clone()),new THREE.Vector3());
  const vertexDepth=i=>shear?Math.max(0,new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld).sub(shear.origin.value).dot(shear.gradient.value)):depth.getX(i);
  const offset=weights.x*vertexDepth(hit.face.a)+weights.y*vertexDepth(hit.face.b)+weights.z*vertexDepth(hit.face.c);
  return hit.point.clone().addScalar(offset);
}
export function renderLayers(renderer,scene,camera,sharedDepth=false){
  renderer.clear();
  if(sharedDepth){
    camera.layers.set(BUILDING_LAYER);camera.layers.enable(CONTROL_LAYER);camera.layers.enable(TRAVELLER_LAYER);
    renderer.render(scene,camera);camera.layers.set(BUILDING_LAYER);return;
  }
  for(const layer of [BUILDING_LAYER,CONTROL_LAYER,TRAVELLER_LAYER]){
    if(layer!==BUILDING_LAYER)renderer.clearDepth();
    camera.layers.set(layer);renderer.render(scene,camera);
  }
  camera.layers.set(BUILDING_LAYER);
}
