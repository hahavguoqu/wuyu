import * as THREE from 'three';
import {opticalDepth} from './optics.js';

export const BUILDING_LAYER=0,CONTROL_LAYER=1,TRAVELLER_LAYER=2;
export const LOWER_BACK_LAYER=3,LOWER_FRONT_LAYER=4;
export function setLayer(root,layer){root.traverse(object=>object.layers.set(layer));}

// The lower C frame wraps around B's projected sweep. Its long transverse leg
// is behind B, while its left return is in front. Splitting C at the corner
// makes the handoff spatial: no angle threshold, vanished face, or layer pop.
export function renderPasses(stage){
  return stage?.foldedOcclusion
    ?[LOWER_BACK_LAYER,BUILDING_LAYER,LOWER_FRONT_LAYER,CONTROL_LAYER,TRAVELLER_LAYER]
    :stage?.unifiedDepth?[BUILDING_LAYER,CONTROL_LAYER]:[BUILDING_LAYER,CONTROL_LAYER,TRAVELLER_LAYER];
}
export function pickingLayers(stage){return renderPasses(stage).slice().reverse();}

export function sortVisibleHits(hits,stage,origin){
  const order=pickingLayers(stage),rank=mesh=>order.findIndex(layer=>mesh.layers.isEnabled(layer));
  const interiors=new Map();
  for(const hit of hits){const group=hit.object.userData.opticalSelfGroup;if(group)interiors.set(group,Math.min(interiors.get(group)??Infinity,hit.distance));}
  let visible=hits.filter(hit=>!hit.object.userData.opticalSelfGroup||hit.distance<=interiors.get(hit.object.userData.opticalSelfGroup)+.0001);
  if(stage?.foldedOcclusion){
    const backDepth=Math.min(...hits.filter(h=>h.object.layers.isEnabled(LOWER_BACK_LAYER)).map(h=>h.distance));
    visible=visible.filter(h=>!h.object.layers.isEnabled(LOWER_FRONT_LAYER)||h.distance<=backDepth+1e-5);
  }
  return visible.slice().sort((a,b)=>rank(a.object)-rank(b.object)||visibleHitPoint(a).distanceToSquared(origin)-visibleHitPoint(b).distanceToSquared(origin));
}

// In a fixed isometric view, (d,d,d) changes depth without moving a pixel.
// Continuous profiles apply to entire solids, rather than isolated end faces.
// Picking uses the same displayed depth; collision geometry stays real.
export function setDepthProfile(mesh,profile,self){
  const position=mesh.geometry.attributes.position,depth=new Float32Array(position.count);
  for(let i=0;i<position.count;i++)depth[i]=profile(new THREE.Vector3().fromBufferAttribute(position,i),i);
  mesh.geometry.setAttribute('isometricDepth',new THREE.BufferAttribute(depth,1));
  mesh.userData.depthProfile=profile;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float isometricDepth;\n'+shader.vertexShader;
      if(self){
        shader.uniforms.selfDepth=self.texture;shader.uniforms.selfSize=self.size;
        shader.vertexShader='varying float originalDepth;\n'+shader.vertexShader;
        shader.fragmentShader='uniform sampler2D selfDepth;\nuniform vec2 selfSize;\nvarying float originalDepth;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(originalDepth > texture2D(selfDepth, gl_FragCoord.xy / selfSize).x + 0.000001) discard;');
      }
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n'+(self?'originalDepth = gl_Position.z / gl_Position.w * .5 + .5;\n':'')+'mvPosition.z += isometricDepth * 1.7320508075688772;\ngl_Position = projectionMatrix * mvPosition;');
    };
    material.customProgramCacheKey=()=> 'continuous-isometric-depth-v2'+(self?'-self':'');
    material.needsUpdate=true;
  }
}

export function setTravellerSurface(root,level,part,foot,angle=0,self){
  let surface=root.userData.travellerSurface;
  if(!surface){
    surface={floor:{value:foot.y},offset:{value:0},ramps:{value:[new THREE.Vector4(0,1,0,0),new THREE.Vector4(0,1,0,0)]},gates:{value:[new THREE.Vector4(0,1,0,-1),new THREE.Vector4(0,1,0,-1)]}};
    root.userData.travellerSurface=surface;
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;mesh.userData.travellerSurface=surface;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        material.onBeforeCompile=shader=>{
          shader.uniforms.carrierFloor=surface.floor;shader.uniforms.carrierOffset=surface.offset;shader.uniforms.carrierRamps=surface.ramps;shader.uniforms.carrierGates=surface.gates;
          shader.vertexShader=`uniform float carrierFloor; uniform float carrierOffset; uniform vec4 carrierRamps[2]; uniform vec4 carrierGates[2];
float carrierRamp(vec3 p,vec4 r){float v=r.x<.5?p.x:r.x<1.5?p.y:p.z;return r.w*clamp((v-r.z)/(r.y-r.z),0.,1.);}
`+shader.vertexShader;
          // Sample the floor along the vertex's camera ray. The head and feet
          // then stay ahead of their own floor while nearer pillars still hide them.
          shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
vec3 carrierPoint=(modelMatrix*vec4(transformed,1.)).xyz;
carrierPoint-=vec3(carrierPoint.y-carrierFloor);
float carrierDepth=carrierOffset;
for(int i=0;i<2;i++){carrierDepth+=carrierRamp(carrierPoint,carrierRamps[i])*(carrierGates[i].w<0.?1.:carrierRamp(carrierPoint,carrierGates[i]));}
mvPosition.z+=carrierDepth*1.7320508075688772;
gl_Position=projectionMatrix*mvPosition;`);
        };
        material.customProgramCacheKey=()=> 'traveller-carrier-depth-v1';material.needsUpdate=true;
      }
    });
  }
  surface.level=level;surface.part=part;surface.angle=angle;surface.floor.value=foot.y;
  if(surface.self!==self){
    surface.self=self;
    // Keep the traveller and its own cloister's internal surfaces in one depth
    // prepass. The cloister cannot reveal a buried wall through the character.
    root.traverse(object=>{object.layers.set(BUILDING_LAYER);if(self)object.layers.enable(self.layer);if(object.isMesh)object.userData.opticalSelfGroup=self;});
  }
  const spec=level.opticalDepths?.[part];
  // Offset and ramps have separate uniforms; animated offsets apply to the whole figure.
  surface.offset.value=(spec?.offset||0)*(spec?.posePower?Math.pow(Math.max(0,Math.sin(angle)),spec.posePower):1);
  const encode=(target,r,amount)=>target.set(r.axis==='x'?0:r.axis==='y'?1:2,r.start,r.end,amount);
  for(let i=0;i<2;i++){
    const ramp=spec?.ramps?.[i];surface.ramps.value[i].set(0,1,0,0);surface.gates.value[i].set(0,1,0,-1);
    if(ramp){encode(surface.ramps.value[i],ramp,ramp.amount);if(ramp.gate)encode(surface.gates.value[i],ramp.gate,1);}
  }
}

export function visibleHitPoint(hit){
  const surface=hit.object.userData.travellerSurface;
  if(surface){const floor=hit.point.clone().addScalar(surface.floor.value-hit.point.y);return hit.point.clone().addScalar(opticalDepth(surface.level,surface.part,floor,surface.angle));}
  const mesh=hit.object,depth=mesh.geometry?.attributes.isometricDepth;
  if(!depth||!hit.face)return hit.point.clone();
  const vertices=mesh.geometry.attributes.position,triangle=new THREE.Triangle(...[hit.face.a,hit.face.b,hit.face.c].map(i=>new THREE.Vector3().fromBufferAttribute(vertices,i)));
  const weights=triangle.getBarycoord(mesh.worldToLocal(hit.point.clone()),new THREE.Vector3());
  const offset=weights.x*depth.getX(hit.face.a)+weights.y*depth.getX(hit.face.b)+weights.z*depth.getX(hit.face.c);
  return hit.point.clone().addScalar(offset);
}
const lowerDepthMaterial=new THREE.MeshBasicMaterial({colorWrite:false});
function renderOpticalInteriors(renderer,scene,camera,stage){
  if(!stage?.opticalGroups?.length)return;
  const size=renderer.getDrawingBufferSize(new THREE.Vector2()),previousTarget=renderer.getRenderTarget(),previousMaterial=scene.overrideMaterial,previousMask=camera.layers.mask;
  try{
    scene.overrideMaterial=lowerDepthMaterial;
    for(const group of stage.opticalGroups){
      if(!group.target){
        group.target=new THREE.WebGLRenderTarget(size.x,size.y);
        group.target.depthTexture=new THREE.DepthTexture(size.x,size.y,THREE.UnsignedIntType);
        group.texture.value=group.target.depthTexture;
      }
      if(group.target.width!==size.x||group.target.height!==size.y)group.target.setSize(size.x,size.y);
      group.size.value.copy(size);camera.layers.set(group.layer);renderer.setRenderTarget(group.target);renderer.clear();renderer.render(scene,camera);
    }
  }finally{renderer.setRenderTarget(previousTarget);scene.overrideMaterial=previousMaterial;camera.layers.mask=previousMask;}
}
export function renderLayers(renderer,scene,camera,stage){
  renderOpticalInteriors(renderer,scene,camera,stage);
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
