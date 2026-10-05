import * as THREE from 'three';
import {mechanismQuaternion,overlapError} from './levels.js';
export function buildNavigation(level,state,camera){
  const angle=state.bridgeAngle??(state.orientation??0)*Math.PI/2,q=mechanismQuaternion(level,angle),pivot=new THREE.Vector3(...level.pivot),orientation=state.orientation??0;
  const settled=Math.abs(angle/(Math.PI/2)-Math.round(angle/(Math.PI/2)))<.001;
  const nodes=new Map(),segments=level.segments.map(spec=>{
    const p0=new THREE.Vector3(...spec.p0),p1=new THREE.Vector3(...spec.p1),up=new THREE.Vector3(...spec.up);
    if(spec.dynamic){p0.applyQuaternion(q).add(pivot);p1.applyQuaternion(q).add(pivot);up.applyQuaternion(q);}
    const enabled=!spec.dynamic||(settled&&(!spec.states||spec.states.includes(orientation)));
    nodes.set(spec.a,{point:p0,enabled});nodes.set(spec.b,{point:p1,enabled});return {...spec,p0,p1,up,enabled};
  });
  const links=level.joints.filter(link=>{
    if(link.states&&(!settled||!link.states.includes(orientation)))return false;
    const a=nodes.get(link.a),b=nodes.get(link.b);
    return a?.enabled&&b?.enabled&&(a.point.distanceTo(b.point)<.11||overlapError(a.point,b.point,camera)<.012);
  });
  return {segments,links,outgoing:links.some(link=>link.b.startsWith((level.goalPath||'goal-road')+':'))};
}
export function anchorPoint(network,anchor){
  const segment=network.segments.find(s=>s.id===anchor.segment);
  return segment?segment.p0.clone().lerp(segment.p1,THREE.MathUtils.clamp(anchor.t,0,1)):null;
}
export function closestAnchor(network,point,ids){
  let best=null;
  for(const segment of network.segments){
    if(segment.enabled===false)continue;
    if(ids&&!ids.includes(segment.id))continue;
    const axis=segment.p1.clone().sub(segment.p0),length=axis.lengthSq();
    const t=length?THREE.MathUtils.clamp(point.clone().sub(segment.p0).dot(axis)/length,0,1):0;
    const snapped=segment.p0.clone().lerp(segment.p1,t),distance=point.distanceTo(snapped);
    if(!best||distance<best.distance)best={segment:segment.id,t,point:snapped,distance};
  }
  return best;
}
// Split source/target edges at their exact local position, including mid-platform stops.
export function planRoute(network,source,target){
  if(!anchorPoint(network,source)||!anchorPoint(network,target))return null;
  const graph=new Map(),positions=new Map(),anchors=new Map();
  const add=(a,b,cost,leg)=>{if(!graph.has(a))graph.set(a,[]);graph.get(a).push({to:b,cost,leg});};
  for(const segment of network.segments){
    if(segment.enabled===false)continue;
    const parts=[{t:0,id:segment.a},{t:1,id:segment.b}];
    if(source.segment===segment.id)parts.push({t:THREE.MathUtils.clamp(source.t,0,1),id:'@source'});
    if(target.segment===segment.id)parts.push({t:THREE.MathUtils.clamp(target.t,0,1),id:'@target'});
    parts.sort((a,b)=>a.t-b.t);
    for(const part of parts){positions.set(part.id,segment.p0.clone().lerp(segment.p1,part.t));anchors.set(part.id,{segment:segment.id,t:part.t});}
    for(let i=0;i<parts.length-1;i++){
      const a=parts[i],b=parts[i+1],cost=(b.t-a.t)*segment.p0.distanceTo(segment.p1);
      for(const [from,to]of[[a,b],[b,a]])add(from.id,to.id,cost,{segment:segment.id,fromT:from.t,toT:to.t,from:positions.get(from.id),to:positions.get(to.id)});
    }
  }
  for(const link of network.links)for(const [a,b]of[[link.a,link.b],[link.b,link.a]])add(a,b,0,{teleport:true,from:positions.get(a),to:positions.get(b),end:anchors.get(b)});
  const distances=new Map([['@source',0]]),previous=new Map(),visited=new Set();
  while(true){
    let current=null,min=Infinity;
    for(const [id,distance]of distances)if(!visited.has(id)&&distance<min){min=distance;current=id;}
    if(current===null)return null;if(current==='@target')break;visited.add(current);
    for(const edge of graph.get(current)||[]){const distance=min+edge.cost;if(distance<(distances.get(edge.to)??Infinity)){distances.set(edge.to,distance);previous.set(edge.to,{from:current,leg:edge.leg});}}
  }
  const route=[];let id='@target';
  while(id!=='@source'){const step=previous.get(id);if(!step)return null;route.unshift(step.leg);id=step.from;}
  return route;
}
