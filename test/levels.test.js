import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LEVELS,levelPoints,overlapError,mechanismQuaternion} from '../src/levels.js';
import {buildNavigation,anchorPoint,planRoute,closestAnchor} from '../src/navigation.js';
import {buildArchitecture} from '../src/architecture.js';
import {applyMechanismPose,collisionPairs,safeMechanismValue,prepareColliders} from '../src/mechanism.js';
import {createTraveller} from '../src/character.js';
import {rotationDetent,angularDelta} from '../src/interaction.js';
const camera=new THREE.OrthographicCamera(-12,12,12,-12,.1,100);camera.position.set(18,18,18);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const net=(level,q)=>buildNavigation(level,{orientation:q,bridgeAngle:q*Math.PI/2},camera);
const stage=level=>buildArchitecture(level,levelPoints(level),{},new THREE.MeshBasicMaterial());
const anchor=(segment,t)=>({segment,t});
function dispose(s){s.group.traverse(m=>{m.geometry?.dispose();for(const mat of Array.isArray(m.material)?m.material:m.material?[m.material]:[])mat.dispose();});}

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
test('double cloister requires the lower crossing before the upper crossing',()=>{
  const l=LEVELS[1],middle=anchor('middle-2',1);
  assert.ok(planRoute(net(l,0),l.startAnchor,middle));assert.equal(planRoute(net(l,0),l.startAnchor,l.goalAnchor),null);
  assert.ok(planRoute(net(l,1),middle,l.goalAnchor));assert.equal(planRoute(net(l,1),l.startAnchor,middle),null);
  assert.equal(planRoute(net(l,2),middle,l.goalAnchor),null);
});
test('blue gate joins both beams to a perimeter of two stair flights',()=>{
  const l=LEVELS[2];assert.equal(planRoute(net(l,0),l.startAnchor,l.goalAnchor),null);
  const route=planRoute(net(l,1),l.startAnchor,l.goalAnchor);assert.ok(route);
  assert.equal(route.filter(s=>s.segment?.includes('-rise-')).length,20);
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
  for(const l of LEVELS){const s=stage(l),caster=new THREE.Raycaster();
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
test('optical seams hide mating caps only at their connected detents',()=>{
  for(const l of LEVELS){const s=stage(l);assert.ok(s.caps.length,l.id);
    for(const q of l.tilt?[0,1]:[0,1,2,3]){applyMechanismPose(l,s,q*Math.PI/2);for(const cap of s.caps)assert.equal(cap.mesh.material[cap.index].visible,!cap.states.includes(q),l.id+' cap at '+q);}
    applyMechanismPose(l,s,.31);for(const cap of s.caps)assert.equal(cap.mesh.material[cap.index].visible,true);dispose(s);
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
  for(const l of LEVELS){const s=stage(l),point=s.controlAnchor,caster=new THREE.Raycaster(point.clone().addScaledVector(direction,30),direction.clone().negate());
    let hit=caster.intersectObjects(s.group.children,true)[0]?.object;while(hit&&!hit.userData.control)hit=hit.parent;assert.equal(hit?.userData.control,'mechanism',l.id);dispose(s);
  }
});
test('two legs animate in opposite directions and return to their resting pose',()=>{
  const actor=createTraveller(),legs=actor.root.children.slice(1);assert.equal(legs.length,2);actor.pose(.12,true,false);assert.equal(legs[0].rotation.x,-legs[1].rotation.x);assert.ok(Math.abs(legs[0].rotation.x)>.2);
  actor.pose(.12,false,false);assert.ok(Math.abs(legs[0].rotation.x)<1e-9);actor.pose(.12,true,true);assert.ok(Math.abs(legs[1].rotation.x)<1e-9);
});
test('rotation detents allow both yaw directions and circular drags cross the angle seam',()=>{
  assert.equal(rotationDetent(-Math.PI/2+.03).orientation,3);assert.equal(rotationDetent(Math.PI*2+.03).orientation,0);assert.ok(Math.abs(angularDelta(Math.PI-.02,-Math.PI+.02)-.04)<1e-8);
});
