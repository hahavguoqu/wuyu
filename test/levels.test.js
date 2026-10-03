import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LEVELS,levelPoints,deckPoints,centerAnchor,overlapError,PAVILION} from '../src/levels.js';
import {buildNavigation,anchorPoint,planRoute,closestAnchor} from '../src/navigation.js';
import {createTraveller} from '../src/character.js';
function cameraAt(angle){const c=new THREE.OrthographicCamera(-6,6,6,-6,.1,100);c.position.set(Math.sin(angle)*Math.sqrt(128),7,Math.cos(angle)*Math.sqrt(128));c.lookAt(0,0,0);c.updateMatrixWorld();return c;}
const good=cameraAt(Math.PI/4),bad=cameraAt(-Math.PI/4),start={segment:'west-road',t:0},goal={segment:'goal-road',t:1};
const idle={orientation:0,travel:0};
test('six chapters contain exactly two teaching levels and both fixed and orbit illusions',()=>{
  assert.equal(LEVELS.length,6);assert.equal(LEVELS.filter(l=>l.lesson).length,2);assert.ok(LEVELS.slice(0,2).every(l=>l.lesson));
  assert.equal(LEVELS.filter(l=>l.illusion&&!l.orbit).length,1);assert.equal(LEVELS.filter(l=>l.orbit).length,2);
  assert.ok(LEVELS.some(l=>l.mechanic==='lift'));assert.ok(LEVELS.some(l=>l.mechanic==='slide'));
});
test('every chapter is solvable after operating its real mechanism',()=>{
  for(const level of LEVELS){
    const before=buildNavigation(level,idle,level.orbit?bad:good);assert.ok(planRoute(before,start,centerAnchor(level)),level.id);assert.equal(planRoute(before,start,goal),null);
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
test('orbit levels require actual projection agreement, independently of screen size',()=>{
  for(const level of LEVELS.filter(l=>l.orbit))for(const size of [5,10,20]){
    const c=cameraAt(Math.PI/4);c.left=-size;c.right=size;c.updateProjectionMatrix();assert.equal(buildNavigation(level,{orientation:2,travel:1},c).outgoing,true);assert.equal(buildNavigation(level,{orientation:2,travel:1},bad).outgoing,false);
  }
});
test('a mid-road destination can stop before the goal and reverse without visiting a waypoint',()=>{
  const net=buildNavigation(LEVELS[0],idle,good),source={segment:'west-road',t:.6},target={segment:'west-road',t:.2},route=planRoute(net,source,target);
  assert.equal(route.length,1);assert.equal(route[0].fromT,.6);assert.equal(route[0].toT,.2);
  const snap=closestAnchor(net,anchorPoint(net,source).add(new THREE.Vector3(0,.02,.2)),['west-road']);assert.ok(Math.abs(snap.t-.6)<1e-8);
});
test('pavilion posts stay clear of the full walking body along the path',()=>{
  for(const level of LEVELS){const p=levelPoints(level);for(const dx of [-PAVILION.postX,PAVILION.postX])for(const dz of [-PAVILION.postZ,PAVILION.postZ]){
    const post=new THREE.Vector3(p.goal.x+dx,p.goal.y,p.goal.z+PAVILION.rearOffset+dz);
    const nearest=new THREE.Line3(p.entry,p.goal).closestPointToPoint(post,true,new THREE.Vector3());assert.ok(post.distanceTo(nearest)-PAVILION.postRadius>PAVILION.clearance,level.id);
  }}
});
test('two visible legs step alternately and return to rest without lowering feet through the floor',()=>{
  const actor=createTraveller(),legs=actor.root.children.slice(1);assert.equal(legs.length,2);
  actor.pose(.12,true,false);assert.ok(Math.abs(legs[0].rotation.x)>.2);assert.equal(legs[0].rotation.x,-legs[1].rotation.x);
  actor.root.updateMatrixWorld(true);for(const leg of legs){const shoe=leg.children[1];assert.ok(shoe.getWorldPosition(new THREE.Vector3()).y>.03);}
  actor.pose(.12,false,false);assert.ok(Math.abs(legs[0].rotation.x)<1e-8);assert.ok(Math.abs(legs[1].rotation.x)<1e-8);
  actor.pose(.12,true,true);assert.equal(legs[0].rotation.x,0);
});
