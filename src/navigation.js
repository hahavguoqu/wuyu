import * as THREE from 'three';
import {levelPoints,deckPoints,overlapError} from './levels.js';
export function buildNavigation(level,state,camera){
  const p=levelPoints(level),deck=deckPoints(level,state),segments=[
    {id:'west-road',a:'start',b:'dock',p0:p.start,p1:p.dock},
    {id:'deck',a:'deck-left',b:'deck-right',...deck},
    {id:'goal-road',a:'entry',b:'goal',p0:p.entry,p1:p.goal},
  ],links=[];
  const nearEnd=level.mechanic==='rotate'?'deck-right':'deck-left';
  const nearPoint=level.mechanic==='rotate'?deck.p1:deck.p0;
  if(nearPoint.distanceTo(p.dock)<.035)links.push({a:'dock',b:nearEnd});
  const ready=level.mechanic==='rotate'?state.orientation===2:(state.travel??0)>.999;
  const outgoing=ready&&(deck.p1.distanceTo(p.entry)<.035||(level.illusion&&overlapError(deck.p1,p.entry,camera)<.035));
  if(outgoing)links.push({a:'deck-right',b:'entry'});
  return {segments,links,outgoing};
}
export function anchorPoint(network,anchor){
  const segment=network.segments.find(s=>s.id===anchor.segment);
  return segment?segment.p0.clone().lerp(segment.p1,THREE.MathUtils.clamp(anchor.t,0,1)):null;
}
export function closestAnchor(network,point,ids){
  let best=null;
  for(const segment of network.segments){
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
