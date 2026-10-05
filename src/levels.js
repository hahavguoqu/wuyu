import * as THREE from 'three';
const iso=Math.PI/4;
export const LEVELS=[
  {id:'first-light',name:'初见',lesson:true,mechanic:'rotate',variant:'garden',initialView:iso,orbit:false,illusion:false,start:[-3.15,2.4,0],dock:[-1.5,2.4,0],near:[0,2.4,0],entry:[1.5,2.4,0],goal:[3.05,2.4,0],tint:'#dcebe6',top:'#eef3e9',bottom:'#bfd9d1'},
  {id:'floating-court',name:'浮渡',lesson:true,mechanic:'slide',variant:'water',initialView:iso,orbit:false,illusion:false,start:[-3.15,2.4,0],dock:[-1.5,2.4,0],near:[-.85,2.4,0],far:[2.15,2.4,0],entry:[2.8,2.4,0],goal:[4.2,2.4,0],tint:'#e2e8ed',top:'#eff2f5',bottom:'#c5d9e1'},
  {id:'folded-garden',name:'折庭',mechanic:'rotate',variant:'fold',initialView:iso,orbit:false,illusion:true,start:[-3.15,2.4,0],dock:[-1.5,2.4,0],near:[0,2.4,0],entry:[2.7,3.45,1.2],goal:[4.25,3.45,1.2],tint:'#e7e1e9',top:'#f3edf0',bottom:'#ced8e2'},
  {id:'cloud-steps',name:'云阶',mechanic:'lift',variant:'cloud',initialView:iso,orbit:false,illusion:false,start:[-3.15,2.4,0],dock:[-.65,2.4,0],near:[0,2.4,0],far:[0,4,0],entry:[.65,4,0],goal:[2.65,4,0],tint:'#eee4db',top:'#faf0e5',bottom:'#d8ddd0'},
  {id:'turning-cloister',name:'回廊',mechanic:'rotate',variant:'cloister',initialView:-iso,orbit:true,illusion:true,start:[-3.15,2.4,0],dock:[-1.5,2.4,0],near:[0,2.4,0],entry:[2.7,3.45,1.2],goal:[4.25,3.45,1.2],tint:'#dce7eb',top:'#edf3f2',bottom:'#bfd4dd'},
  {id:'mirror-tide',name:'镜潮',mechanic:'slide',variant:'mirror',initialView:-iso,orbit:true,illusion:true,start:[-3.15,2.4,0],dock:[-.65,2.4,0],near:[0,2.4,0],far:[2,2.4,0],entry:[3.85,3.45,1.2],goal:[5.4,3.45,1.2],tint:'#e3e4ef',top:'#efedf6',bottom:'#c8d6e1'},
].map((level,index)=>({...level,initialView:index<2?iso+Math.PI:level.initialView,start:[level.start[0],level.start[1],level.start[2]-2.35],goal:[level.goal[0],level.goal[1],level.goal[2]+1.75]}));
export const CHAPTER_NAMES=['一','二','三','四','五','六'];
export function levelPoints(level){
  const vector=key=>new THREE.Vector3(...level[key]);
  const start=vector('start'),dock=vector('dock'),entry=vector('entry'),goal=vector('goal');
  return {start,dock,center:vector('near'),near:vector('near'),far:vector(level.far?'far':'near'),entry,goal,westCorner:new THREE.Vector3(start.x,start.y,dock.z),goalCorner:new THREE.Vector3(goal.x,entry.y,entry.z)};
}
export function deckPoints(level,state){
  const p=levelPoints(level);
  if(level.mechanic==='rotate'){
    const angle=state.bridgeAngle??(state.orientation??0)*Math.PI/2;
    return {p0:p.near,p1:p.near.clone().add(new THREE.Vector3(-1.5,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),angle))};
  }
  const center=p.near.clone().lerp(p.far,state.travel??0);
  return {p0:center.clone().add(new THREE.Vector3(-.65,0,0)),p1:center.clone().add(new THREE.Vector3(.65,0,0))};
}
export function centerAnchor(level){return {segment:'deck',t:level.mechanic==='rotate'?0:.5};}
// Compare real endpoints on the camera plane, never CSS pixels.
export function overlapError(a,b,camera){
  const x=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),y=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),delta=b.clone().sub(a);
  return Math.hypot(delta.dot(x),delta.dot(y));
}
