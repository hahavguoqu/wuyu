import * as THREE from 'three';

export function buildArchitecture(level,p,materials,glow,onMechanism,onView){
  const group=new THREE.Group(),staticGroup=new THREE.Group();group.add(staticGroup);
  const add=(geometry,mat,pos,parent=staticGroup)=>{const mesh=new THREE.Mesh(geometry,typeof mat==='string'?materials[mat]:mat);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const box=(w,h,d,x,y,z,mat='stone',parent=staticGroup)=>add(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],parent);
  const ring=(r,t,pos,mat='gold',parent=staticGroup)=>{const mesh=add(new THREE.TorusGeometry(r,t,6,64),mat,pos,parent);mesh.rotation.x=-Math.PI/2;mesh.castShadow=false;return mesh;};
  function road(a,b,id,mat='stone',parent=staticGroup){
    const mid=a.clone().lerp(b,.5),mesh=box(a.distanceTo(b)+.62,.32,.62,mid.x,mid.y-.16,mid.z,mat,parent);mesh.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);mesh.userData.roads=[id];return mesh;
  }
  function column(at,width=.62,mat='stone'){const bottom=-.55,top=at.y-.32;return box(width,top-bottom,width,at.x,(top+bottom)/2,at.z,mat);}
  road(p.start,p.westCorner,'west-road');road(p.westCorner,p.dock,'west-bend');
  road(p.entry,p.goalCorner,'goal-bend');road(p.goalCorner,p.goal,'goal-road');
  column(p.start);column(p.goal);
  for(const z of [p.westCorner.z-.22,p.westCorner.z+.22])column(new THREE.Vector3(p.westCorner.x,p.westCorner.y,z),.075,'shadow');
  if(level.illusion){column(p.goalCorner,.62,'mint');box(.1,p.goalCorner.y+.3,.1,p.goalCorner.x-.23,(p.goalCorner.y-.3)/2,p.goalCorner.z-.22,'shadow');}
  const mechanism=new THREE.Group();mechanism.position.copy(p.near);group.add(mechanism);
  const rotates=level.mechanic==='rotate';
  const floor=box(rotates?1.8:1.3,.32,.64,rotates?-.6:0,-.16,0,'mint',mechanism);floor.userData.roads=['deck'];
  if(rotates){
    const hub=box(.64,.32,.64,0,-.16,0,'mint',mechanism);hub.userData.roads=['deck'];
    box(.64,1.18,.64,-1.18,-.88,0,'mint',mechanism);column(p.near,.64,'mint');
  }else{
    box(.56,.84,.56,0,-.74,0,'mint',mechanism);
    if(level.mechanic==='slide'){
      for(const z of [-.21,.21])box(p.far.x-p.near.x+1.3,.045,.035,(p.far.x+p.near.x)/2,p.near.y-1.17,z,'shadow');column(p.far,.1,'shadow');
    }else for(const x of [-.23,.23])box(.05,p.far.y+.35,.05,x,(p.far.y-.35)/2,-.26,'shadow');
  }
  const front=Math.cos(level.initialView)<0?-1:1;
  const controlAnchor=rotates?p.near.clone().add(new THREE.Vector3(0,-.66,front*.55)):new THREE.Vector3(0,-.69,front*.5);
  const knob=new THREE.Group();knob.position.copy(controlAnchor);(rotates?staticGroup:mechanism).add(knob);knob.userData.control='mechanism';knob.userData.activate=onMechanism;
  knob.rotation.y=front<0?Math.PI:0;
  box(.09,.09,.27,0,0,-.13,'green',knob);
  box(.57,.105,.105,0,0,0,'control',knob);box(.105,.57,.105,0,0,0,'control',knob);
  for(const [x,y]of[[-.24,0],[.24,0],[0,-.24],[0,.24]])box(.12,.12,.13,x,y,.018,'gold',knob);
  let viewAnchor,viewKnob;
  if(level.orbit){
    viewAnchor=p.start.clone().add(new THREE.Vector3(0,-.66,.55));viewKnob=new THREE.Group();viewKnob.position.copy(viewAnchor);staticGroup.add(viewKnob);viewKnob.userData.control='view';viewKnob.userData.activate=onView;
    const wheel=add(new THREE.TorusGeometry(.23,.04,8,40),'gold',[0,0,0],viewKnob);wheel.castShadow=false;
    box(.39,.065,.08,0,0,0,'green',viewKnob);box(.065,.39,.08,0,0,0,'green',viewKnob);
  }
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
  if(rotates){for(let i=0;i<4;i++){mechanism.rotation.y=i*Math.PI/2;collect(mechanism);}mechanism.rotation.y=0;}
  else{collect(mechanism);mechanism.position.copy(p.far);collect(mechanism);mechanism.position.copy(p.near);}
  for(const point of [p.start,p.goal,p.near,p.far])framePoints.push(point.clone().add(new THREE.Vector3(0,1,0)));
  if(level.variant==='mirror'){
    const reflection=staticGroup.clone(true);reflection.position.y=-1.2;reflection.scale.y=-.23;
    reflection.traverse(mesh=>{mesh.userData={};if(mesh.isMesh){mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.material.opacity=.1;mesh.material.depthWrite=false;mesh.castShadow=false;mesh.receiveShadow=false;}});group.add(reflection);
  }
  const shadow=add(new THREE.PlaneGeometry(50,50),new THREE.ShadowMaterial({opacity:.025}),[0,-.57,0],group);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  return {group,mechanism,controlAnchor,viewAnchor,knob,viewKnob,seal,completionRing,framePoints,controlInMotion:!rotates};
}
