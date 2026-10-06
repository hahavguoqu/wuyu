import * as THREE from 'three';

const path=(id,points,wall=false)=>({id,points,wall});
const stair=(id,from,to,count=10)=>({id,from,to,count});
const beam=(size,at,roads=[])=>({size,at,roads});
const deck=(id,p0,p1,up=[0,1,0],states=null)=>({id,p0,p1,up,states,dynamic:true,a:id+':0',b:id+':1'});
const joint=(a,b,states)=>({a,b,states});
const color=(top,x,z)=>({top,x,z});

// The camera looks exactly along (1,1,1): points separated by (d,d,d)
// share a pixel. These joints are authored, rather than inferred from any overlap.
export const LEVELS=[
  {
    id:'folded-frame',name:'折臂',lesson:true,axis:'x',sign:-1,tilt:true,pivot:[6,5.55,0],
    top:'#b7d5d3',bottom:'#d4e1d2',fixed:color('#dfdfce','#c3c5b5','#86948b'),moving:color('#a0d0c0','#66a997','#3d7b73'),support:color('#a9ad92','#929981','#737e69'),
    paths:[path('west-road',[[4.8,0,0],[0,0,0],[0,0,-2]]),path('upper',[[3,6,0],[0,6,0],[0,6,-4]])],
    goalPath:'upper',goalMark:'petal',
    fixedBoxes:[beam([1.2,.9,.9],[5.4,-.45,0]),{...beam([.9,2.4,.9],[6,.3,0]),dockTop:.053},...[-.32,0,.32].map(z=>({...beam([.085,5.1,.085],[0,2.55,z]),support:true}))],
    beams:[beam([3,.9,.9],[-1.5,0,0],['deck-upper']),beam([.9,4,.9],[0,-2,0],['deck-fold']),beam([.9,.9,.9],[0,0,0],['deck-upper','deck-fold'])],
    decks:[deck('deck-upper',[-3,0,.45],[0,0,.45],[0,0,1],[1]),deck('deck-fold',[0,0,.45],[0,-4,.45],[0,0,1],[1])],
    joints:[joint('west-road:2','deck-fold:1',[1]),joint('deck-fold:0','deck-upper:1',[1]),joint('deck-upper:0','upper:0',[1])],
    control:[6.86,5.55,0],controlAxis:'x',
    landmarks:[{label:'走到折臂',segment:'deck-fold',t:.7}],
  },
  {
    id:'double-cloister',name:'双廊',lesson:true,axis:'y',sign:1,pivot:[0,.55,0],
    top:'#aaa4c7',bottom:'#d0bfce',disc:'#e8a866',fixed:color('#c2a681','#7e6e54','#5c503f'),moving:color('#c0ace4','#8575b5','#6a5a9e'),support:color('#cdc2e4','#a599c4','#82759f'),
    paths:[{...path('west-road',[[0,1,6.3],[0,1,4.13]]),dockEnd:.08},
      {...path('middle',[[6.75,7.75,2.7],[6.75,7.75,0],[4.13,7.75,0]]),dockStart:.003,dockEnd:.08},
      {...path('rear',[[-4.13,7.75,0],[-5.05,7.75,0],[-5.05,7.75,-5.05],[0,7.75,-5.05],[0,7.75,-4.13]]),dockStart:.08,dockEnd:.08},
      {...path('goal-road',[[0,7.75,4.13],[0,7.75,6.3],[-2.7,7.75,6.3]]),dockStart:.08}],
    fixedBoxes:[beam([.9,5.85,5.05],[-5.05,3.925,-2.525]),beam([5.05,5.85,.9],[-2.525,3.925,-5.05]),...[[.28,.28],[-.28,.28],[0,-.28]].map(([x,z])=>({...beam([.075,5.85,.075],[x,3.925,6.3+z]),support:true}))],
    beams:[beam([.9,.9,8.1],[0,0,0],['deck-lower']),beam([8.1,.9,.9],[0,6.75,0],['deck-upper']),beam([.9,.65,.9],[0,-.775,0]),beam([.9,.65,.9],[0,5.975,0]),...[-.28,.28].flatMap(x=>[-.28,.28].map(z=>({...beam([.075,5.2,.075],[x,3.05,z]),support:true})))],
    decks:[deck('deck-lower',[0,.45,4.05],[0,.45,-4.05]),deck('deck-upper',[4.05,7.2,0],[-4.05,7.2,0])],
    joints:[joint('west-road:1','deck-lower:0',[0]),joint('deck-lower:1','middle:0',[0]),joint('middle:2','deck-upper:0',[0]),joint('rear:0','deck-upper:1',[0]),joint('rear:4','deck-upper:0',[1]),joint('deck-upper:1','goal-road:0',[1])],
    control:[0,-1.1,0],controlAxis:'y',controlColor:color('#e3aac9','#b876a3','#914869'),controlTips:color('#f0bbd3','#ce91b8','#a96794'),goalMark:'petal',
    landmarks:[{label:'走到下层横梁',segment:'deck-lower',t:.5},{label:'走到回廊',segment:'middle-1',t:1},{label:'走到上层横梁',segment:'deck-upper',t:.5}],
  },
  {
    id:'blue-gate',name:'门阶',axis:'z',sign:1,tilt:true,pivot:[0,2,0],base:1.55,
    top:'#356d97',bottom:'#9ebdcc',disc:'#e9eee5',fixed:color('#e5e5d7','#b3c9cc','#7894a3'),moving:color('#68b5e5','#4885ac','#2c5d80'),support:color('#dae0ce','#bccbbb','#8da6a2'),
    paths:[{...path('west-road',[[5,2.45,3],[5,2.45,0],[2.33,2.45,0]]),dockEnd:.08},
      {...path('approach',[[-2.33,2.45,0],[-5,2.45,0],[-5,2.45,-3]]),dockStart:.08},
      path('crown',[[-5,4.15,-4.55],[-5,4.15,-5],[-4.55,4.15,-5]],true),
      {...path('middle',[[-3,3.25,-5],[-3,3.25,-6.2],[5,3.25,-6.2],[5,3.25,-2.8],[3.95,3.25,-2.8]],true),solid:true},
      path('goal-road',[[-1.15,4.45,-1.6],[-1.6,4.45,-1.6]])],
    stairs:[stair('up',[-5,2.45,-3],[-5,4.15,-4.55],8),stair('down',[-4.55,4.15,-5],[-3,3.25,-5],5)],
    fixedBoxes:[beam([.9,.9,.9],[-1.6,4,-1.6])],
    beams:[beam([.9,4.5,.9],[0,0,0],['deck-front']),beam([.9,6.3,.9],[0,0,-3.6],['deck-back']),beam([.12,.12,3.6],[0,0,-1.8])],
    decks:[deck('deck-front',[.45,-2.25,0],[.45,2.25,0],[1,0,0],[1]),deck('deck-back',[.45,-3.15,-3.6],[.45,3.15,-3.6],[1,0,0],[1])],
    joints:[joint('west-road:2','deck-front:0',[1]),joint('deck-front:1','approach:0',[1]),joint('approach:2','up:0'),joint('up:16','crown:0'),joint('crown:2','down:0'),joint('down:10','middle:0'),joint('middle:4','deck-back:0',[1]),joint('deck-back:1','goal-road:0',[1])],
    control:[0,2,.8],controlAxis:'z',goalMark:'petal',goalBlock:true,landmarks:[{label:'走到阶梯回廊',segment:'middle',t:0}],
  },
  {
    id:'hanging-stair',name:'悬阶',axis:'y',sign:1,pivot:[0,2.55,0],
    top:'#a3c9c8',bottom:'#dac7ac',fixed:color('#f3c58a','#cf8650','#904d33'),moving:color('#80c7a7','#4d9c98','#2f7377'),support:color('#ffc26c','#e7893b','#b65d28'),
    paths:[path('west-road',[[0,0,4],[-1.5,0,4]]),path('landing',[[-4.05,1.5,4],[-4.5,1.5,4],[-4.5,1.5,2.5]]),{...path('station',[[-4.5,3,.45],[-4.5,3,0],[-3.08,3,0]]),dockEnd:.08},
      {...path('middle',[[2,5,-1],[2,5,-3.6],[-.6,5,-3.6]]),dockStart:.003},
      path('goal-road',[[-1.5,10.1,1.5],[-1.95,10.1,1.5]])],
    stairs:[stair('up-a',[-1.5,0,4],[-4.05,1.5,4],14),stair('up-b',[-4.5,1.5,2.5],[-4.5,3,.45],9)],
    fixedBoxes:[beam([.9,.9,.9],[-1.95,9.65,1.5])],bearing:true,
    beams:[beam([3,.9,.9],[-1.5,0,0],['deck-lower']),beam([.9,5.6,.9],[0,2.8,0]),beam([.9,.9,3],[0,5.6,-1.5],['deck-upper']),beam([.9,.9,.9],[0,0,0],['deck-lower']),beam([.9,.9,.9],[0,5.6,0],['deck-upper'])],
    decks:[deck('deck-lower',[-.65,.45,0],[-3,.45,0]),deck('deck-upper',[0,6.05,0],[0,6.05,-3])],
    joints:[joint('west-road:1','up-a:0'),joint('up-a:28','landing:0'),joint('landing:2','up-b:0'),joint('up-b:18','station:0'),joint('station:2','deck-lower:1',[0]),joint('deck-lower:1','middle:0',[3]),joint('middle:2','deck-upper:1',[3]),joint('deck-upper:1','goal-road:0',[1])],
    control:[.3,1.3,.565],controlAxis:'z',goalMark:'petal',goalBlock:true,
    landmarks:[{label:'走到下层悬臂',segment:'deck-lower',t:.75},{label:'走到折角平台',segment:'middle',t:1},{label:'走到上层悬臂',segment:'deck-upper',t:.7}],
  },
].map(level=>{
  const segments=[];
  for(const path of level.paths)for(let i=0;i<path.points.length-1;i++)segments.push({id:i===0?path.id:path.id+'-'+i,a:path.id+':'+i,b:path.id+':'+(i+1),p0:path.points[i],p1:path.points[i+1],up:[0,1,0]});
  for(const stair of level.stairs||[]){
    stair.treads=[];
    let previous=new THREE.Vector3(...stair.from);
    for(let i=0;i<stair.count;i++){
      const end=new THREE.Vector3(...stair.from).lerp(new THREE.Vector3(...stair.to),(i+1)/stair.count);
      const raised=previous.clone();raised.y=end.y;
      segments.push({id:stair.id+'-rise-'+i,a:stair.id+':'+i*2,b:stair.id+':'+(i*2+1),p0:previous.toArray(),p1:raised.toArray(),up:[0,1,0],riser:true});
      const tread={id:stair.id+'-tread-'+i,a:stair.id+':'+(i*2+1),b:stair.id+':'+(i*2+2),p0:raised.toArray(),p1:end.toArray(),up:[0,1,0]};segments.push(tread);stair.treads.push(tread);previous=end;
    }
  }
  const goalPath=level.paths.find(p=>p.id===(level.goalPath||'goal-road'));
  const goalSegment=goalPath.points.length===2?goalPath.id:goalPath.id+'-'+(goalPath.points.length-2);
  return {...level,mechanic:'rotate',variant:level.id,initialView:Math.PI/4,segments:[...segments,...level.decks],startAnchor:{segment:'west-road',t:0},goalAnchor:{segment:goalSegment,t:1},goal:goalPath.points.at(-1)};
});
export const CHAPTER_NAMES=['一','二','三','四'];
export function levelPoints(level){return {start:new THREE.Vector3(...level.paths[0].points[0]),goal:new THREE.Vector3(...level.goal),near:new THREE.Vector3(...level.pivot),far:new THREE.Vector3(...level.pivot)};}
export function centerAnchor(level){return level.landmarks[0];}
export function mechanismQuaternion(level,angle){return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(level.axis==='x'?1:0,level.axis==='y'?1:0,level.axis==='z'?1:0),angle*(level.sign||1));}
export function overlapError(a,b,camera){
  const x=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),y=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),delta=b.clone().sub(a);
  return Math.hypot(delta.dot(x),delta.dot(y));
}
