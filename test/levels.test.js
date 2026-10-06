import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LEVELS,levelPoints,overlapError,mechanismQuaternion} from '../src/levels.js';
import {buildNavigation,anchorPoint,planRoute,closestAnchor} from '../src/navigation.js';
import {buildArchitecture} from '../src/architecture.js';
import {applyMechanismPose,collisionPairs,safeMechanismValue,prepareColliders} from '../src/mechanism.js';
import {createTraveller} from '../src/character.js';
import {rotationDetent,angularDelta} from '../src/interaction.js';
import {setLayer,renderLayers,visibleHitPoint,sortVisibleHits,BUILDING_LAYER,CONTROL_LAYER,TRAVELLER_LAYER,LOWER_BACK_LAYER,LOWER_FRONT_LAYER} from '../src/rendering.js';
const camera=new THREE.OrthographicCamera(-12,12,12,-12,.1,100);camera.position.set(18,18,18);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const net=(level,q)=>buildNavigation(level,{orientation:q,bridgeAngle:q*Math.PI/2},camera);
const stage=level=>buildArchitecture(level,levelPoints(level),{},new THREE.MeshBasicMaterial());
const anchor=(segment,t)=>({segment,t});
function dispose(s){s.group.traverse(m=>{m.geometry?.dispose();for(const mat of Array.isArray(m.material)?m.material:m.material?[m.material]:[])mat.dispose();});}
function displayedHits(s,ray){
  ray.layers.enableAll();
  return sortVisibleHits(ray.intersectObjects(s.group.children,true).filter(h=>!h.object.userData.background),s,ray.ray.origin);
}

test('four reference structures use a fixed camera and distinct rotation axes',()=>{
  assert.equal(LEVELS.length,4);assert.equal(LEVELS.filter(l=>l.lesson).length,2);
  assert.deepEqual(LEVELS.map(l=>l.axis),['x','y','z','y']);assert.equal(LEVELS.filter(l=>l.stairs?.length).length,2);
  for(const l of LEVELS)assert.notEqual(l.fixed.top,l.moving.top);
});
test('folded frame opens a complete S route after its arm becomes horizontal',()=>{
  const l=LEVELS[0];assert.equal(planRoute(net(l,0),l.startAnchor,l.goalAnchor),null);
  const route=planRoute(net(l,1),l.startAnchor,l.goalAnchor);assert.ok(route);
  for(const id of ['west-road-1','deck-fold','deck-upper','upper','upper-1'])assert.ok(route.some(s=>s.segment===id),id);
  const n=net(l,1),a=anchorPoint(n,anchor('deck-fold',1)),b=anchorPoint(n,anchor('west-road-1',1));
  assert.ok(a.distanceTo(b)>10);assert.ok(overlapError(a,b,camera)<1e-8);
});
test('double cloister climbs an optical corner and carries its rider on the upper beam',()=>{
  const l=LEVELS[1],middle=anchor('middle-1',1),upper=anchor('deck-upper',.5);
  assert.ok(planRoute(net(l,0),l.startAnchor,middle));assert.equal(planRoute(net(l,0),l.startAnchor,l.goalAnchor),null);
  assert.ok(planRoute(net(l,0),middle,upper));assert.ok(planRoute(net(l,1),upper,l.goalAnchor));
  assert.equal(planRoute(net(l,1),middle,l.goalAnchor),null);assert.equal(planRoute(net(l,1),l.startAnchor,middle),null);
  assert.equal(planRoute(net(l,2),middle,l.goalAnchor),null);
});
test('blue gate joins both beams to a perimeter of two stair flights',()=>{
  const l=LEVELS[2];assert.equal(planRoute(net(l,0),l.startAnchor,l.goalAnchor),null);
  const route=planRoute(net(l,1),l.startAnchor,l.goalAnchor);assert.ok(route);
  assert.equal(route.filter(s=>s.segment?.includes('-rise-')).length,13);
  for(const id of ['deck-front','deck-back','middle-1'])assert.ok(route.some(s=>s.segment===id));
});
test('cantilever carries the traveller between three different docking orientations',()=>{
  const l=LEVELS[3],lower=anchor('deck-lower',.75),upper=anchor('deck-upper',.7),landing=anchor('middle',1);
  assert.ok(planRoute(net(l,0),l.startAnchor,lower));assert.equal(planRoute(net(l,0),lower,upper),null);
  assert.ok(planRoute(net(l,3),lower,landing));assert.ok(planRoute(net(l,3),landing,upper));
  assert.equal(planRoute(net(l,3),upper,l.goalAnchor),null);assert.ok(planRoute(net(l,1),upper,l.goalAnchor));
});
test('optical joins disappear when actual camera projection no longer agrees',()=>{
  const bad=camera.clone();bad.position.set(-18,18,18);bad.lookAt(0,0,0);bad.updateMatrixWorld();
  for(const l of LEVELS){const q=l.id==='hanging-stair'?3:l.id==='double-cloister'?0:1;assert.ok(net(l,q).links.length>buildNavigation(l,{orientation:q},bad).links.length,l.id);}
});
test('arbitrary road positions can stop, reverse and travel along actual corners',()=>{
  const l=LEVELS[0],n=net(l,1),a=anchor('west-road',.7),b=anchor('west-road',.2),route=planRoute(n,a,b);
  assert.equal(route.length,1);assert.equal(route[0].fromT,.7);assert.equal(route[0].toT,.2);
  const snap=closestAnchor(n,anchorPoint(n,a).add(new THREE.Vector3(0,.03,.1)),['west-road']);assert.ok(Math.abs(snap.t-.7)<1e-8);
  assert.ok(planRoute(n,a,l.goalAnchor).some(s=>s.segment==='west-road-1'));
});
test('rider keeps the same local anchor and follows the rotating surface normal',()=>{
  for(const l of LEVELS){const deck=l.decks[0],a=anchor(deck.id,.37),value=.47,q=mechanismQuaternion(l,value);
    const n=buildNavigation(l,{orientation:0,bridgeAngle:value},camera),actual=anchorPoint(n,a),local=new THREE.Vector3(...deck.p0).lerp(new THREE.Vector3(...deck.p1),a.t).applyQuaternion(q).add(new THREE.Vector3(...l.pivot));
    assert.ok(actual.distanceTo(local)<1e-9);assert.ok(n.segments.find(s=>s.id===deck.id).up.distanceTo(new THREE.Vector3(...deck.up).applyQuaternion(q))<1e-9);
    assert.equal(planRoute(n,a,l.goalAnchor),null,'walking stays blocked between detents');
  }
});
test('all 964 sampled mechanism poses avoid fixed roads, walls, pillars and stairs',()=>{
  for(const l of LEVELS){const s=stage(l),limit=l.tilt?Math.PI/2:Math.PI*2;
    for(let i=0;i<=240;i++){applyMechanismPose(l,s,i/240*limit);assert.equal(collisionPairs(s).length,0,l.id+' pose '+i);}
    assert.equal(safeMechanismValue(l,s,0,limit),limit);assert.equal(safeMechanismValue(l,s,limit,0),0);dispose(s);
  }
});
test('a fast turn stops before a thin obstruction instead of crossing it',()=>{
  const l=LEVELS[1],s=stage(l),blocker=new THREE.Mesh(new THREE.BoxGeometry(.05,.9,.05),new THREE.MeshBasicMaterial());blocker.position.set(2,1,2);s.group.add(blocker);s.fixedSolids.push(blocker);prepareColliders(s);
  const safe=safeMechanismValue(l,s,0,Math.PI/2);assert.ok(safe>0&&safe<Math.PI/2);assert.equal(collisionPairs(s).length,0);dispose(s);
});
test('every active road and stair tread has a visible floor at its navigation height',()=>{
  for(const l of LEVELS){const s=stage(l),caster=new THREE.Raycaster();caster.layers.enableAll();
    for(const q of l.tilt?[1]:[0,1,3]){applyMechanismPose(l,s,q*Math.PI/2);s.group.updateWorldMatrix(true,true);const n=net(l,q);
      for(const segment of n.segments.filter(s=>s.enabled&&!s.riser))for(const t of [.1,.5,.9]){
        const point=anchorPoint(n,anchor(segment.id,t));caster.set(point.clone().addScaledVector(segment.up,.05),segment.up.clone().negate());
        assert.ok(caster.intersectObjects(s.group.children,true).some(h=>h.distance<.06&&h.object.userData.roads?.includes(segment.id)),l.id+' '+segment.id+' '+t);
      }
    }dispose(s);
  }
});
test('architecture uses flat per-face colors and keeps the lit top face after a fold',()=>{
  for(const l of LEVELS){const s=stage(l);applyMechanismPose(l,s,Math.PI/2);
    for(const mesh of [...s.fixedSolids,...s.movingSolids])assert.ok(mesh.material.every(m=>m.isMeshBasicMaterial));
    const mesh=s.movingSolids[0],q=mesh.getWorldQuaternion(new THREE.Quaternion()),normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const top=normals.findIndex(n=>new THREE.Vector3(...n).applyQuaternion(q).y>.99);assert.equal(mesh.material[top].color.getHexString(),new THREE.Color(l.moving.top).getHexString());dispose(s);
  }
});
test('optical end faces retain continuous depth and never switch visibility at detents',()=>{
  for(const l of LEVELS.slice(1)){const s=stage(l);assert.ok(s.opticalCaps.length,l.id);
    const profiles=s.opticalCaps.map(({mesh})=>Array.from(mesh.geometry.attributes.isometricDepth.array));
    for(const value of [0,.31,Math.PI/2-.0011,Math.PI/2-.0009,Math.PI/2,Math.PI/2+.0009]){
      applyMechanismPose(l,s,value);
      s.opticalCaps.forEach(({mesh},i)=>{assert.ok(mesh.material.every(m=>m.visible));assert.deepEqual(Array.from(mesh.geometry.attributes.isometricDepth.array),profiles[i]);});
    }dispose(s);
  }
});
test('walkable surfaces leave room for the feet and stair landings do not swallow a tread',()=>{
  for(const l of LEVELS){const s=stage(l);
    for(const q of l.tilt?[1]:[0,1,3]){applyMechanismPose(l,s,q*Math.PI/2);const n=net(l,q);
      for(const segment of n.segments.filter(s=>s.enabled&&!s.riser))for(const t of [.1,.5,.9]){
        const foot=anchorPoint(n,anchor(segment.id,t)).addScaledVector(segment.up,.06);
        for(const mesh of [...s.fixedSolids,...s.movingSolids]){const local=mesh.worldToLocal(foot.clone()),bbox=mesh.geometry.boundingBox.clone().expandByScalar(-.002);assert.ok(!bbox.containsPoint(local),l.id+' '+segment.id+' feet inside solid '+mesh.position.toArray());}
      }
    }dispose(s);
  }
});
test('each control can be seen and picked directly from the fixed camera',()=>{
  const direction=new THREE.Vector3(1,1,1).normalize();
  for(const l of LEVELS){const s=stage(l),point=s.controlAnchor,caster=new THREE.Raycaster(point.clone().addScaledVector(direction,30),direction.clone().negate());caster.layers.set(l.bearing?BUILDING_LAYER:CONTROL_LAYER);
    for(let i=0;i<8;i++){applyMechanismPose(l,s,i*Math.PI/4);let hit=caster.intersectObjects(s.group.children,true)[0]?.object;while(hit&&!hit.userData.control)hit=hit.parent;assert.equal(hit?.userData.control,'mechanism',l.id+' control pose '+i);}dispose(s);
  }
});
test('the render passes preserve control visibility and draw the traveller last with its own depth',()=>{
  const actor=createTraveller();setLayer(actor.root,TRAVELLER_LAYER);actor.root.traverse(o=>assert.equal(o.layers.mask,1<<TRAVELLER_LAYER));
  const calls=[],renderer={clear:()=>calls.push('clear'),clearDepth:()=>calls.push('depth'),render:(_,c)=>calls.push(c.layers.mask)};
  renderLayers(renderer,new THREE.Scene(),camera);assert.deepEqual(calls,['clear',1<<BUILDING_LAYER,'depth',1<<CONTROL_LAYER,'depth',1<<TRAVELLER_LAYER]);assert.equal(camera.layers.mask,1);
});

test('C wraps around B: the transverse leg is behind B and the left return is in front',()=>{
  const s=stage(LEVELS[0]),calls=[],renderer={clear:()=>calls.push('clear'),clearDepth:()=>calls.push('depth'),render:(_,c)=>calls.push(c.layers.mask)};
  assert.equal(s.opticalCaps.length,0,'B keeps all six normal faces');
  renderLayers(renderer,new THREE.Scene(),camera,s);
  assert.deepEqual(calls,['clear',1<<LOWER_BACK_LAYER,'depth',1<<BUILDING_LAYER,'depth',1<<LOWER_BACK_LAYER,1<<LOWER_FRONT_LAYER,'depth',1<<CONTROL_LAYER,'depth',1<<TRAVELLER_LAYER]);
  assert.equal(camera.layers.mask,1);dispose(s);
});

test('B crosses in front of C transverse leg, then is occluded by the left return',()=>{
  const l=LEVELS[0],s=stage(l),direction=new THREE.Vector3(1,1,1).normalize();
  const transverse=s.fixedSolids.find(m=>m.userData.roads?.length===1&&m.userData.roads[0]==='west-road');
  const left=s.fixedSolids.find(m=>m.userData.roads?.length===1&&m.userData.roads[0]==='west-road-1');
  for(const [degrees,target,winner]of[[25,transverse,'B'],[45,transverse,'B'],[55,transverse,'B'],[70,left,'C'],[85,left,'C'],[90,left,'C']]){
    applyMechanismPose(l,s,degrees*Math.PI/180);s.group.updateWorldMatrix(true,true);const bbox=target.geometry.boundingBox;let checked=0;
    for(const face of ['x','y','z'])for(let i=1;i<20;i++)for(let j=1;j<20;j++){
      const across=['x','y','z'].filter(axis=>axis!==face),point=new THREE.Vector3();point[face]=bbox.max[face];point[across[0]]=THREE.MathUtils.lerp(bbox.min[across[0]],bbox.max[across[0]],i/20);point[across[1]]=THREE.MathUtils.lerp(bbox.min[across[1]],bbox.max[across[1]],j/20);point.applyMatrix4(target.matrixWorld);
      const ray=new THREE.Raycaster(point.clone().addScaledVector(direction,40),direction.clone().negate());ray.layers.enableAll();
      const raw=ray.intersectObjects(s.group.children,true);
      if(!raw.some(h=>s.movingSolids.includes(h.object))||!raw.some(h=>h.object===target))continue;
      if(winner==='C'){
        const targetDepth=Math.min(...raw.filter(h=>h.object===target).map(h=>h.distance)),backDepth=Math.min(...raw.filter(h=>h.object.layers.isEnabled(LOWER_BACK_LAYER)).map(h=>h.distance));
        if(targetDepth>backDepth+1e-5)continue;
      }
      const hit=displayedHits(s,ray)[0];if(winner==='B')assert.ok(s.movingSolids.includes(hit.object),'C transverse incorrectly covers B at '+degrees);else assert.equal(hit.object.layers.mask,1<<LOWER_FRONT_LAYER,'B incorrectly covers C left return at '+degrees);
      checked++;
    }
    assert.ok(checked>0,'missing projected overlap at '+degrees);
  }
  for(let degrees=0;degrees<=90;degrees+=.5){applyMechanismPose(l,s,degrees*Math.PI/180);for(const mesh of s.movingSolids){assert.equal(mesh.layers.mask,1);assert.ok(mesh.material.every(m=>m.visible));assert.equal(mesh.geometry.attributes.isometricDepth,undefined);}}
  dispose(s);
});

test('C retains a flush continuous corner instead of painting its buried side over the transverse floor',()=>{
  const s=stage(LEVELS[0]),lower=s.fixedSolids.filter(m=>m.layers.isEnabled(LOWER_BACK_LAYER)||m.layers.isEnabled(LOWER_FRONT_LAYER)),direction=new THREE.Vector3(1,1,1).normalize();
  let buried=0;
  for(let i=0;i<=24;i++)for(let j=0;j<=24;j++){
    const point=new THREE.Vector3(.5+i*.04,.02,-.35+j*.028),ray=new THREE.Raycaster(point.clone().addScaledVector(direction,30),direction.clone().negate());ray.layers.enableAll();
    const raw=ray.intersectObjects(lower),displayed=sortVisibleHits(raw,s,ray.ray.origin)[0];assert.ok(displayed);
    assert.ok(displayed.face.normal.clone().transformDirection(displayed.object.matrixWorld).y>.99,'internal vertical face appears over C floor');
    const floor=raw[0],front=raw.find(h=>h.object.layers.isEnabled(LOWER_FRONT_LAYER));
    if(front&&front.distance>floor.distance+1e-5)buried++;
  }
  assert.ok(buried>0,'must exercise the previously exposed internal corner');dispose(s);
});
test('all four destinations use the same small gold emblem without extending goal cubes',()=>{
  for(const l of LEVELS){const s=stage(l);assert.equal(s.seal.userData.emblem,'golden-four-petal');assert.equal(s.seal.children.filter(m=>m.geometry.type==='CircleGeometry').length,5);
    if(l.goalBlock){const road=s.fixedSolids.find(m=>m.userData.roads?.includes('goal-road'));assert.ok(Math.abs(road.geometry.boundingBox.getSize(new THREE.Vector3()).x-.45)<1e-6);}dispose(s);
  }
});
test('dock collars cover the safety gaps while leaving swept collision bounds intact',()=>{
  for(const l of LEVELS){const s=stage(l);for(const mesh of s.fixedSolids.filter(m=>m.userData.dockCollar?.start||m.userData.dockCollar?.end)){
    const real=mesh.userData.solidBounds.getSize(new THREE.Vector3()),visible=mesh.geometry.boundingBox.getSize(new THREE.Vector3()),collar=mesh.userData.dockCollar;
    assert.ok(Math.abs(visible.clone().sub(real).length()-collar.start-collar.end)<1e-6);
  }dispose(s);}
});
test('depth-correct picking projects to the same pixel as real geometry',()=>{
  const direction=new THREE.Vector3(1,1,1).normalize();
  for(const l of LEVELS){const s=stage(l);applyMechanismPose(l,s,Math.PI/2);s.group.updateWorldMatrix(true,true);
    for(const mesh of s.depthMeshes){const center=mesh.getWorldPosition(new THREE.Vector3()),ray=new THREE.Raycaster(center.clone().addScaledVector(direction,30),direction.clone().negate());
      for(const hit of ray.intersectObject(mesh)){const rendered=visibleHitPoint(hit);assert.ok(overlapError(rendered,hit.point,camera)<1e-8);}
    }dispose(s);
  }
});
test('optical and docking seams show continuous floors across the road width',()=>{
  const direction=new THREE.Vector3(1,1,1).normalize();
  for(const l of LEVELS){const s=stage(l);
    for(const q of l.tilt?[1]:[0,1,3]){applyMechanismPose(l,s,q*Math.PI/2);s.group.updateWorldMatrix(true,true);const n=net(l,q);
      for(const link of n.links.filter(link=>link.states)){
        const find=id=>{const segment=n.segments.find(segment=>segment.a===id||segment.b===id);return {segment,point:segment.a===id?segment.p0:segment.p1};};
        const a=find(link.a),b=find(link.b),axis=a.segment.p1.clone().sub(a.segment.p0).normalize(),across=axis.clone().cross(a.segment.up).normalize();
        for(const offset of [-.28,0,.28]){
          const point=a.point.clone().lerp(b.point,.5).addScaledVector(across,offset),ray=new THREE.Raycaster(point.clone().addScaledVector(direction,40),direction.clone().negate());
          const hits=displayedHits(s,ray);
          assert.ok(hits.length,l.id+' empty seam '+link.a);
          const normal=hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld);
          assert.ok(normal.y>.99,l.id+' covered floor '+link.a+' -> '+link.b+' at '+offset+' normal '+normal.toArray());
        }
      }
    }dispose(s);
  }
});
test('destination emblems remain visible through the mechanism sweep',()=>{
  const direction=new THREE.Vector3(1,1,1).normalize();
  for(const l of LEVELS){const s=stage(l),limit=l.tilt?Math.PI/2:Math.PI*2;
    for(let i=0;i<=24;i++){applyMechanismPose(l,s,limit*i/24);s.group.updateWorldMatrix(true,true);
      for(const [x,z]of[[0,0],[.22,0],[-.22,0],[0,.22],[0,-.22]]){
        const point=levelPoints(l).goal.add(new THREE.Vector3(x,.025,z)),ray=new THREE.Raycaster(point.clone().addScaledVector(direction,40),direction.clone().negate());
        const hits=displayedHits(s,ray);
        let object=hits[0]?.object;while(object&&object!==s.seal)object=object.parent;
        assert.equal(object,s.seal,l.id+' hidden emblem at pose '+i+' sample '+x+','+z);
      }
    }dispose(s);
  }
});
test('two legs animate in opposite directions and return to their resting pose',()=>{
  const actor=createTraveller(),legs=actor.root.children.slice(1);assert.equal(legs.length,2);actor.pose(.12,true,false);assert.equal(legs[0].rotation.x,-legs[1].rotation.x);assert.ok(Math.abs(legs[0].rotation.x)>.2);
  actor.pose(.12,false,false);assert.ok(Math.abs(legs[0].rotation.x)<1e-9);actor.pose(.12,true,true);assert.ok(Math.abs(legs[1].rotation.x)<1e-9);
});
test('rotation detents allow both yaw directions and circular drags cross the angle seam',()=>{
  assert.equal(rotationDetent(-Math.PI/2+.03).orientation,3);assert.equal(rotationDetent(Math.PI*2+.03).orientation,0);assert.ok(Math.abs(angularDelta(Math.PI-.02,-Math.PI+.02)-.04)<1e-8);
});
