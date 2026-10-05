import * as THREE from 'three';
import {prepareColliders} from './mechanism.js';

export function buildArchitecture(level,p,materials,glow,onMechanism){
  const group=new THREE.Group(),staticGroup=new THREE.Group(),mechanism=new THREE.Group();group.add(staticGroup);
  const fixedSolids=[],movingSolids=[];
  const add=(geometry,mat,pos,parent=staticGroup)=>{const mesh=new THREE.Mesh(geometry,typeof mat==='string'?materials[mat]:mat);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const box=(w,h,d,x,y,z,mat='stone',parent=staticGroup)=>{const mesh=add(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],parent);if(parent===staticGroup||parent===mechanism){const role=parent===mechanism?'moving':'fixed';mesh.userData.structure=role;(role==='moving'?movingSolids:fixedSolids).push(mesh);}return mesh;};
  const ring=(r,t,pos,mat='gold',parent=staticGroup)=>{const mesh=add(new THREE.TorusGeometry(r,t,6,64),mat,pos,parent);mesh.rotation.x=-Math.PI/2;mesh.castShadow=false;return mesh;};
  function road(a,b,id,mat='stone',parent=staticGroup,startCap=.31,endCap=.31){
    const axis=b.clone().sub(a).normalize(),mid=a.clone().lerp(b,.5).addScaledVector(axis,(endCap-startCap)/2),mesh=box(a.distanceTo(b)+startCap+endCap,.32,.62,mid.x,mid.y-.16,mid.z,mat,parent);mesh.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);mesh.userData.roads=[id];return mesh;
  }
  function column(at,width=.62,mat='stone'){const bottom=-.55,top=at.y-.32;return box(width,top-bottom,width,at.x,(top+bottom)/2,at.z,mat);}
  road(p.start,p.westCorner,'west-road');road(p.westCorner,p.dock,'west-bend','stone',staticGroup,.31,0);
  road(p.entry,p.goalCorner,'goal-bend','stone',staticGroup,0,.31);road(p.goalCorner,p.goal,'goal-road');
  column(p.start);column(p.goal);
  for(const z of [p.westCorner.z-.22,p.westCorner.z+.22])column(new THREE.Vector3(p.westCorner.x,p.westCorner.y,z),.075,'shadow');
  if(level.illusion){column(p.goalCorner);box(.1,p.goalCorner.y+.3,.1,p.goalCorner.x-.23,(p.goalCorner.y-.3)/2,p.goalCorner.z-.22,'shadow');}
  mechanism.position.copy(p.near);group.add(mechanism);
  const rotates=level.mechanic==='rotate';
  if(level.elbow){
    road(new THREE.Vector3(),new THREE.Vector3(-1.3,0,0),'deck','mint',mechanism,0,.31);
    road(new THREE.Vector3(-1.3,0,0),new THREE.Vector3(-1.3,0,-1.3),'deck-elbow','mint',mechanism,.31,0);
  }else{const floor=box(rotates?1.8:1.3,.32,.64,rotates?-.6:0,-.16,0,'mint',mechanism);floor.userData.roads=['deck'];}
  if(rotates){
    const hub=box(.64,.32,.64,0,-.16,0,'mint',mechanism);hub.userData.roads=['deck'];
    if(level.elbow)box(.56,.5,.56,-1.3,-.58,0,'mint',mechanism);
    else box(.64,1.18,.64,-1.18,-.88,0,'mint',mechanism);
    column(p.near,.54);
  }else{
    box(.56,.84,.56,0,-.74,0,'mint',mechanism);
    if(level.mechanic==='slide'){
      const axis=p.far.clone().sub(p.near).normalize(),side=new THREE.Vector3(-axis.z,0,axis.x),mid=p.near.clone().lerp(p.far,.5);
      for(const offset of [-.21,.21]){
        const railPoint=mid.clone().addScaledVector(side,offset),rail=box(p.far.distanceTo(p.near)+1.3,.045,.035,railPoint.x,p.near.y-1.23,railPoint.z,'shadow');rail.rotation.y=-Math.atan2(axis.z,axis.x);
        const foot=p.far.clone().addScaledVector(axis,.5).addScaledVector(side,offset);foot.y=p.near.y-1.23+.32-.025;column(foot,.065,'shadow');
      }
    }else for(const x of [-.23,.23])box(.05,p.far.y+.35,.05,x,(p.far.y-.35)/2,-.39,'shadow');
  }
  const front=Math.cos(level.initialView)<0?-1:1;
  const controlAnchor=rotates?p.near.clone().add(new THREE.Vector3(0,-.66,front*.46)):new THREE.Vector3(0,-.69,front*.5);
  const knob=new THREE.Group();knob.position.copy(controlAnchor);(rotates?staticGroup:mechanism).add(knob);knob.userData.control='mechanism';knob.userData.activate=onMechanism;
  knob.rotation.y=front<0?Math.PI:0;
  box(.09,.09,.2,0,0,-.1,rotates?'stone':'green',knob);
  box(.57,.105,.105,0,0,0,'control',knob);box(.105,.57,.105,0,0,0,'control',knob);
  for(const [x,y]of[[-.24,0],[.24,0],[0,-.24],[0,.24]])box(.12,.12,.13,x,y,.018,'gold',knob);
  const seal=new THREE.Group();seal.position.copy(p.goal).add(new THREE.Vector3(0,.007,0));staticGroup.add(seal);
  const sealGold=new THREE.MeshBasicMaterial({color:'#d7ac4d'}),sealIvory=new THREE.MeshBasicMaterial({color:'#f9f0d3'});
  const disk=add(new THREE.CircleGeometry(.235,48),sealIvory,[0,0,0],seal);disk.rotation.x=-Math.PI/2;disk.castShadow=false;
  ring(.23,.009,[0,.003,0],sealGold,seal);ring(.19,.005,[0,.004,0],sealGold,seal);
  for(let i=0;i<4;i++){const a=i*Math.PI/2,petal=add(new THREE.CircleGeometry(.062,24),sealGold,[Math.cos(a)*.068,.006,Math.sin(a)*.068],seal);petal.rotation.x=-Math.PI/2;petal.castShadow=false;}
  const completionRing=ring(.285,.007,[0,.005,0],glow,seal);completionRing.visible=false;
  if(level.variant==='cloister')for(const z of [-.45,-.75])column(p.goalCorner.clone().add(new THREE.Vector3(-.65,0,z)),.07,'shadow');
  const framePoints=[];
  function collect(root){root.updateWorldMatrix(true,true);root.traverse(mesh=>{if(!mesh.geometry)return;mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])framePoints.push(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));});}
  collect(staticGroup);
  if(rotates){for(let i=0;i<16;i++){mechanism.rotation.y=i*Math.PI/8;collect(mechanism);}mechanism.rotation.y=0;}
  else{collect(mechanism);mechanism.position.copy(p.far);collect(mechanism);mechanism.position.copy(p.near);}
  for(const point of [p.start,p.goal,p.near,p.far])framePoints.push(point.clone().add(new THREE.Vector3(0,1,0)));
  if(level.variant==='mirror'){
    const reflection=staticGroup.clone(true);reflection.position.y=-1.2;reflection.scale.y=-.23;
    reflection.traverse(mesh=>{mesh.userData={};if(mesh.isMesh){mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.material.opacity=.1;mesh.material.depthWrite=false;mesh.castShadow=false;mesh.receiveShadow=false;}});group.add(reflection);
  }
  const shadow=add(new THREE.PlaneGeometry(50,50),new THREE.ShadowMaterial({opacity:.025}),[0,-.57,0],group);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  const stage={group,mechanism,controlAnchor,knob,seal,completionRing,framePoints,controlInMotion:!rotates,fixedSolids,movingSolids};prepareColliders(stage);return stage;
}
