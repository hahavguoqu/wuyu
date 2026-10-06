import * as THREE from 'three';

export const BUILDING_LAYER=0,CONTROL_LAYER=1,TRAVELLER_LAYER=2;
export const LOWER_BACK_LAYER=3,LOWER_FRONT_LAYER=4;
export function setLayer(root,layer){root.traverse(object=>object.layers.set(layer));}

// The lower C frame wraps around B's projected sweep. Its long transverse leg
// is behind B, while its left return is in front. Splitting C at the corner
// makes the handoff spatial: no angle threshold, vanished face, or layer pop.
export function renderPasses(stage){
  return stage?.foldedOcclusion
    ?[LOWER_BACK_LAYER,BUILDING_LAYER,LOWER_FRONT_LAYER,CONTROL_LAYER,TRAVELLER_LAYER]
    :[BUILDING_LAYER,CONTROL_LAYER,TRAVELLER_LAYER];
}
export function pickingLayers(stage){return renderPasses(stage).slice().reverse();}

export function sortVisibleHits(hits,stage,origin){
  const order=pickingLayers(stage),rank=mesh=>order.findIndex(layer=>mesh.layers.isEnabled(layer));
  let visible=hits;
  if(stage?.foldedOcclusion){
    const backDepth=Math.min(...hits.filter(h=>h.object.layers.isEnabled(LOWER_BACK_LAYER)).map(h=>h.distance));
    visible=hits.filter(h=>!h.object.layers.isEnabled(LOWER_FRONT_LAYER)||h.distance<=backDepth+1e-5);
  }
  return visible.slice().sort((a,b)=>rank(a.object)-rank(b.object)||visibleHitPoint(a).distanceToSquared(origin)-visibleHitPoint(b).distanceToSquared(origin));
}

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
const lowerDepthMaterial=new THREE.MeshBasicMaterial({colorWrite:false});
export function renderLayers(renderer,scene,camera,stage){
  renderer.clear();
  const passes=renderPasses(stage);
  for(const [i,layer]of passes.entries()){
    if(i)renderer.clearDepth();
    if(stage?.foldedOcclusion&&layer===LOWER_FRONT_LAYER){
      // Restore C's own depth before its foreground part is painted over B.
      // This suppresses C's buried corner faces and keeps both legs flush.
      const material=scene.overrideMaterial;
      scene.overrideMaterial=lowerDepthMaterial;camera.layers.set(LOWER_BACK_LAYER);
      try{renderer.render(scene,camera);}finally{scene.overrideMaterial=material;}
    }
    camera.layers.set(layer);renderer.render(scene,camera);
  }
  camera.layers.set(BUILDING_LAYER);
}
