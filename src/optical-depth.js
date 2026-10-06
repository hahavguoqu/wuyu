import * as THREE from 'three';

// Camera-space depth can change along (1,1,1) without moving a screen pixel.
// The first puzzle's far end is six units along this direction from the low
// road. Warp the whole fold towards that road, rather than hiding its end cap.
// Floors and the traveller share this field, so an optical joint has one depth.
export function foldDepth(localY, angle) {
  return -6 * THREE.MathUtils.clamp(-localY / 4, 0, 1) * Math.sin(angle);
}

export function travellerDepth(level, anchor, angle) {
  if (level.id !== 'folded-frame' || anchor.segment !== 'deck-fold') return 0;
  return foldDepth(-4 * anchor.t, angle);
}

// Extend the fold's floor depth through the character's height. Translating only
// the feet would leave the head behind this impossible floor. The gradient is
// perpendicular to (1,1,1), so this shear preserves every projected pixel.
export function travellerShear(level, anchor, angle) {
  if (level.id !== 'folded-frame') return new THREE.Vector3();
  let weight = 0;
  if (anchor.segment === 'deck-fold') weight = 1;
  if (anchor.segment === 'west-road-1' || anchor.segment === 'deck-upper')
    weight = THREE.MathUtils.smoothstep(anchor.t, .55, 1);
  const sin = Math.sin(angle), cos = Math.cos(angle);
  const k = weight * 1.5 * sin / (sin + cos || 1);
  return new THREE.Vector3(0, k, -k);
}

export function installTravellerShear(root) {
  const gradient = {value:new THREE.Vector3()}, origin = {value:new THREE.Vector3()};
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.onBeforeCompile = shader => {
        shader.uniforms.opticalGradient = gradient;
        shader.uniforms.opticalOrigin = origin;
        shader.vertexShader = 'uniform vec3 opticalGradient;\nuniform vec3 opticalOrigin;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\nvec3 opticalWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nmvPosition.z += max(0.0, dot(opticalWorld - opticalOrigin, opticalGradient)) * 1.7320508075688772;\ngl_Position = projectionMatrix * mvPosition;');
      };
      material.customProgramCacheKey = () => 'traveller-floor-depth-shear-v1';
      material.needsUpdate = true;
    }
    mesh.userData.opticalShear = {gradient,origin};
  });
  return (level, anchor, angle) => {
    origin.value.copy(root.position);
    gradient.value.copy(travellerShear(level, anchor, angle));
  };
}

export function displayAnchor(level, network, anchor, angle) {
  const segment = network.segments.find(s => s.id === anchor.segment);
  if (!segment) return null;
  return segment.p0.clone().lerp(segment.p1, THREE.MathUtils.clamp(anchor.t, 0, 1))
    .addScalar(travellerDepth(level, anchor, angle));
}
