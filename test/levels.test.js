import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LEVELS,levelPoints,deckPoints,centerAnchor,overlapError} from '../src/levels.js';
import {buildNavigation,anchorPoint,planRoute,closestAnchor} from '../src/navigation.js';
import {createTraveller} from '../src/character.js';
import {rotationDetent,travelFromDrag,angularDelta} from '../src/interaction.js';
import {buildArchitecture} from '../src/architecture.js';
import {applyMechanismPose,collisionPairs,safeMechanismValue,prepareColliders} from '../src/mechanism.js';
function cameraAt(angle){const c=new THREE.OrthographicCamera(-6,6,6,-6,.1,100);c.position.set(Math.sin(angle)*Math.sqrt(128),7,Math.cos(angle)*Math.sqrt(128));c.lookAt(0,0,0);c.updateMatrixWorld();return c;}
const good=cameraAt(Math.PI/4),bad=cameraAt(-Math.PI/4),start={segment:'west-road',t:0},goal={segment:'goal-road',t:1};
const idle={orientation:0,travel:0};
test('six chapters keep two tutorials and explore illusions from a fixed camera',()=>{
  assert.equal(LEVELS.length,6);assert.equal(LEVELS.filter(l=>l.lesson).length,2);assert.ok(LEVELS.slice(0,2).every(l=>l.lesson));
  assert.equal(LEVELS.filter(l=>l.illusion&&!l.orbit).length,3);assert.ok(LEVELS.every(l=>!l.orbit));assert.ok(LEVELS.some(l=>l.elbow));
  assert.ok(LEVELS.some(l=>l.mechanic==='lift'));assert.ok(LEVELS.some(l=>l.mechanic==='slide'));
});
test('every chapter is solvable after operating its real mechanism',()=>{
  for(const level of LEVELS){
    const before=buildNavigation(level,idle,good);assert.ok(planRoute(before,start,centerAnchor(level)),level.id);assert.equal(planRoute(before,start,goal),null);
    const after=buildNavigation(level,{orientation:2,travel:1},good);assert.ok(planRoute(after,centerAnchor(level),goal),level.id);assert.ok(planRoute(after,goal,centerAnchor(level)),level.id);
    assert.equal(planRoute(after,start,goal),null,'disconnected start must not stay reachable');
  }
});
test('turning bridge carries a mid-road anchor and blocks both disconnected shores',()=>{
  const level=LEVELS[0],anchor={segment:'deck',t:.55};
  const before=buildNavigation(level,idle,good),quarter=buildNavigation(level,{...idle,orientation:1},good),after=buildNavigation(level,{...idle,orientation:2},good);
  assert.ok(Math.abs(anchorPoint(before,anchor).length()-anchorPoint(quarter,anchor).length())<1e-8);
  assert.equal(planRoute(quarter,anchor,start),null);assert.equal(planRoute(quarter,anchor,goal),null);assert.ok(planRoute(after,anchor,goal));
});
test('sliding platform and lift preserve rider position and only dock at station endpoints',()=>{
  for(const level of LEVELS.filter(l=>l.mechanic!=='rotate')){
    const anchor={segment:'deck',t:.37},before=buildNavigation(level,idle,good),half=buildNavigation(level,{...idle,travel:.5},good),after=buildNavigation(level,{...idle,travel:1},good);
    const p=levelPoints(level),carried=anchorPoint(after,anchor).sub(anchorPoint(before,anchor));assert.ok(carried.distanceTo(p.far.clone().sub(p.near))<1e-8);
    assert.equal(planRoute(half,anchor,start),null);assert.equal(planRoute(half,anchor,goal),null);assert.ok(planRoute(after,anchor,goal));
  }
});
test('fixed illusion joins endpoints with a real depth and height gap',()=>{
  const level=LEVELS[2],p=levelPoints(level),deck=deckPoints(level,{orientation:2});assert.ok(deck.p1.distanceTo(p.entry)>1.9);assert.ok(overlapError(deck.p1,p.entry,good)<.001);
  assert.equal(buildNavigation(level,{orientation:2},bad).outgoing,false);assert.equal(buildNavigation(level,{orientation:2},good).outgoing,true);
});
test('fixed illusions require actual projection agreement, independently of screen size',()=>{
  for(const level of LEVELS.filter(l=>l.illusion))for(const size of [5,10,20]){
    const c=cameraAt(Math.PI/4);c.left=-size;c.right=size;c.updateProjectionMatrix();assert.equal(buildNavigation(level,{orientation:2,travel:1},c).outgoing,true);assert.equal(buildNavigation(level,{orientation:2,travel:1},bad).outgoing,false);
  }
});

test('the folded cloister changes two optical joints and carries riders around its real corner',()=>{
  const level=LEVELS.find(l=>l.elbow),before=buildNavigation(level,idle,good),after=buildNavigation(level,{orientation:2},good);
  assert.ok(planRoute(before,start,centerAnchor(level)).some(step=>step.segment==='deck-elbow'));
  assert.ok(planRoute(after,centerAnchor(level),goal).some(step=>step.segment==='deck-elbow'));
  assert.equal(buildNavigation(level,idle,bad).links.length,0);
  const onElbow={segment:'deck-elbow',t:.6},p=levelPoints(level);
  const initial=anchorPoint(before,onElbow).sub(p.near),turned=anchorPoint(after,onElbow).sub(p.near);
  assert.ok(initial.clone().applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI).distanceTo(turned)<1e-8);
});

test('all structural sweeps stay clear of fixed pillars, roads and guide rails',()=>{
  const material=new THREE.MeshStandardMaterial(),materials=new Proxy({}, {get:()=>material});
  for(const level of LEVELS){
    const stage=buildArchitecture(level,levelPoints(level),materials,material,()=>{},()=>{});
    for(let i=0;i<=240;i++){
      const value=i/240*(level.mechanic==='rotate'?Math.PI*2:1);applyMechanismPose(level,stage,value);
      const pairs=collisionPairs(stage);
      assert.equal(pairs.length,0,level.id+' sweep '+i+' '+pairs.map(([a,b])=>a.position.toArray()+' / '+b.position.toArray()).join(';'));
    }
    assert.equal(safeMechanismValue(level,stage,0,level.mechanic==='rotate'?Math.PI*2:1),level.mechanic==='rotate'?Math.PI*2:1);
    stage.group.traverse(mesh=>mesh.geometry?.dispose());
  }material.dispose();
});

test('collision guard stops a large drag before passing through an obstruction',()=>{
  const level=LEVELS[1],material=new THREE.MeshStandardMaterial(),materials=new Proxy({}, {get:()=>material}),stage=buildArchitecture(level,levelPoints(level),materials,material,()=>{},()=>{});
  const blocker=new THREE.Mesh(new THREE.BoxGeometry(.09,1,1),material);blocker.position.set(.65,1.8,0);stage.group.add(blocker);stage.fixedSolids.push(blocker);
  // Rebuild after inserting a deliberately thin obstacle into the rail corridor.
  prepareColliders(stage);
  const safe=safeMechanismValue(level,stage,0,1);assert.ok(safe<.5);assert.equal(collisionPairs(stage).length,0);
  stage.group.traverse(mesh=>mesh.geometry?.dispose());material.dispose();
});
test('a mid-road destination can stop before the goal and reverse without visiting a waypoint',()=>{
  const net=buildNavigation(LEVELS[0],idle,good),source={segment:'west-road',t:.6},target={segment:'west-road',t:.2},route=planRoute(net,source,target);
  assert.equal(route.length,1);assert.equal(route[0].fromT,.6);assert.equal(route[0].toT,.2);
  const snap=closestAnchor(net,anchorPoint(net,source).add(new THREE.Vector3(.2,.02,0)),['west-road']);assert.ok(Math.abs(snap.t-.6)<1e-8);
});
test('bent paths route through their corners instead of walking through the empty centre',()=>{
  for(const level of LEVELS){
    const network=buildNavigation(level,idle,good),route=planRoute(network,start,centerAnchor(level));
    assert.ok(route.some(step=>step.segment==='west-bend'),level.id);
    const after=buildNavigation(level,{orientation:2,travel:1},good),exit=planRoute(after,centerAnchor(level),goal);
    assert.ok(exit.some(step=>step.segment==='goal-bend'),level.id);
  }
});
test('two visible legs step alternately and return to rest without lowering feet through the floor',()=>{
  const actor=createTraveller(),legs=actor.root.children.slice(1);assert.equal(legs.length,2);
  actor.pose(.12,true,false);assert.ok(Math.abs(legs[0].rotation.x)>.2);assert.equal(legs[0].rotation.x,-legs[1].rotation.x);
  actor.root.updateMatrixWorld(true);for(const leg of legs){const shoe=leg.children[1];assert.ok(shoe.getWorldPosition(new THREE.Vector3()).y>.03);}
  actor.pose(.12,false,false);assert.ok(Math.abs(legs[0].rotation.x)<1e-8);assert.ok(Math.abs(legs[1].rotation.x)<1e-8);
  actor.pose(.12,true,true);assert.equal(legs[0].rotation.x,0);
});
test('rotation detents wrap both directions and preserve the nearest turn',()=>{
  assert.equal(rotationDetent(-Math.PI/2+.03).orientation,3);
  assert.equal(rotationDetent(Math.PI*2+.06).orientation,0);
  assert.equal(rotationDetent(Math.PI-.1).angle,Math.PI);
  assert.ok(Math.abs(angularDelta(Math.PI-.02,-Math.PI+.02)-.04)<1e-8);
});
test('dragging follows horizontal and vertical rails, clamps ends, and supports reverse travel',()=>{
  assert.equal(travelFromDrag(0,{x:100,y:0},{x:200,y:0}),.5);
  assert.equal(travelFromDrag(0,{x:0,y:-60},{x:0,y:-120}),.5);
  assert.equal(travelFromDrag(1,{x:-200,y:0},{x:200,y:0}),0);
  assert.equal(travelFromDrag(0,{x:400,y:0},{x:200,y:0}),1);
  assert.equal(travelFromDrag(.5,{x:0,y:90},{x:200,y:0}),.5);
});
test('all path centre lines have walkable meshes and the goal seal stays on the floor',()=>{
  const material=new THREE.MeshStandardMaterial(),materials=new Proxy({}, {get:()=>material});
  for(const level of LEVELS){
    const p=levelPoints(level),stage=buildArchitecture(level,p,materials,material,()=>{},()=>{});stage.group.updateMatrixWorld(true);
    assert.ok(Math.abs(stage.seal.position.y-p.goal.y)<.02);
    const network=buildNavigation(level,idle,good),caster=new THREE.Raycaster();
    for(const segment of network.segments)for(const t of [.1,.5,.9]){
      const point=anchorPoint(network,{segment:segment.id,t});caster.set(point.clone().add(new THREE.Vector3(0,.05,0)),new THREE.Vector3(0,-1,0));
      assert.ok(caster.intersectObjects(stage.group.children,true).some(hit=>hit.distance<.06&&hit.object.userData.roads?.includes(segment.id)),level.id+' '+segment.id+' '+t);
    }
    stage.group.traverse(mesh=>{mesh.geometry?.dispose();});
  }material.dispose();
});
test('mechanism handles face the actual initial camera and are not hidden behind supports',()=>{
  const material=new THREE.MeshStandardMaterial(),materials=new Proxy({}, {get:()=>material});
  for(const level of LEVELS){
    const stage=buildArchitecture(level,levelPoints(level),materials,material,()=>{},()=>{});stage.group.updateMatrixWorld(true);
    const point=stage.controlInMotion?stage.controlAnchor.clone().applyMatrix4(stage.mechanism.matrixWorld):stage.controlAnchor.clone();
    const direction=new THREE.Vector3(Math.sin(level.initialView)*Math.sqrt(128),7,Math.cos(level.initialView)*Math.sqrt(128)).normalize();
    const caster=new THREE.Raycaster(point.clone().addScaledVector(direction,20),direction.clone().negate());
    let object=caster.intersectObjects(stage.group.children,true)[0]?.object;while(object&&!object.userData.control)object=object.parent;
    assert.equal(object?.userData.control,'mechanism',level.id);
    stage.group.traverse(mesh=>mesh.geometry?.dispose());
  }material.dispose();
});
