import * as THREE from 'three';
import {PAVILION} from './levels.js';
export function buildArchitecture(level,p,materials,glow,onMechanism,onView){
  const group=new THREE.Group(),staticGroup=new THREE.Group();group.add(staticGroup);
  const add=(geo,mat,pos,parent=staticGroup)=>{const m=new THREE.Mesh(geo,typeof mat==='string'?materials[mat]:mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const box=(w,h,d,x,y,z,mat='stone',parent=staticGroup)=>add(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],parent);
  const cylinder=(r1,r2,h,x,y,z,mat='stone',parent=staticGroup)=>add(new THREE.CylinderGeometry(r1,r2,h,32),mat,[x,y,z],parent);
  const ring=(r,t,x,y,z,mat='gold',parent=staticGroup)=>{const m=add(new THREE.TorusGeometry(r,t,8,48),mat,[x,y,z],parent);m.rotation.x=-Math.PI/2;return m;};
  const arch=(w,h,opening,depth,x,y,z)=>{
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h);shape.lineTo(-w/2,h);shape.closePath();
    const hole=new THREE.Path(),hh=h-.3;hole.moveTo(-opening/2,0);hole.lineTo(-opening/2,hh-opening/2);hole.absarc(0,hh-opening/2,opening/2,Math.PI,0,true);hole.lineTo(opening/2,0);hole.closePath();shape.holes.push(hole);
    return add(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:20}),'stone',[x,y,z-depth/2]);
  };
  const island=(x,z,w=2.35,d=2.2)=>{box(w,.2,d,x,.05,z,'stone');box(w+.12,.26,d+.12,x,-.18,z,'mint');box(w*.86,.25,d*.86,x,-.43,z,'mint');box(w*.65,.3,d*.65,x,-.7,z,'shadow');};
  const tree=(x,y,z,scale=1)=>{cylinder(.035,.045,.45*scale,x,y+.22*scale,z,'gold');const m=add(new THREE.IcosahedronGeometry(.32*scale,1),'green',[x,y+.68*scale,z]);m.scale.set(.85,1.7,.85);};
  function roof(x,y,z,size=.85){
    const apex=new THREE.Vector3(x,y+.58,z),corners=[[-size,-size],[size,-size],[size,size],[-size,size]].map(([a,b])=>new THREE.Vector3(x+a,y,z+b));
    const data=[];for(let i=0;i<4;i++)for(const v of [apex,corners[i],corners[(i+1)%4]])data.push(...v.toArray());
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data,3));geo.computeVertexNormals();
    add(geo,new THREE.MeshStandardMaterial({color:level.variant==='mirror'?'#899fb0':level.variant==='cloud'?'#b7a688':'#94b6a6',side:THREE.DoubleSide,roughness:1}),[0,0,0]);
    const ribMat=new THREE.MeshStandardMaterial({color:level.variant==='mirror'?'#6f879b':'#789484',roughness:1});
    const rib=(a,b)=>{const m=add(new THREE.TubeGeometry(new THREE.LineCurve3(a,b),1,.009,5,false),ribMat,[0,0,0]);m.castShadow=false;};
    for(let i=0;i<4;i++){
      const a=corners[i],b=corners[(i+1)%4],normal=new THREE.Vector3().crossVectors(a.clone().sub(apex),b.clone().sub(apex)).normalize();if(normal.y<0)normal.negate();normal.multiplyScalar(.014);
      for(let j=0;j<=6;j++)rib(apex.clone().lerp(a.clone().lerp(b,j/6),.06).add(normal),a.clone().lerp(b,j/6).add(normal));
      for(const t of [.48,.76])rib(apex.clone().lerp(a,t).add(normal),apex.clone().lerp(b,t).add(normal));rib(a,b);
    }
    cylinder(.02,.02,.22,x,y+.69,z,'gold');add(new THREE.SphereGeometry(.045,12,10),'gold',[x,y+.83,z]);
  }
  function platform(center,isGoal){
    const [x,y,z]=center.toArray();const depth=isGoal?2.8:2.05,back=isGoal?-.35:-.12;island(x,z+back,2.35,depth+.15);
    arch(1.68,y-.28,.87,1.42,x,.15,z);
    box(2.08,.14,depth,x,y-.15,z+back,'trim');
    const floor=box(1.98,.08,depth-.09,x,y-.04,z+back);floor.userData.roads=[isGoal?'goal-road':'west-road'];
    if(!isGoal){tree(x-.5,y,z-.68,.7);return;}
    // All four posts are behind the walking centreline, with explicit body clearance.
    const rz=z+PAVILION.rearOffset;
    for(const dx of [-PAVILION.postX,PAVILION.postX])for(const dz of [-PAVILION.postZ,PAVILION.postZ]){
      cylinder(PAVILION.postRadius,PAVILION.postRadius,1.57,x+dx,y+.785,rz+dz,'trim');
      cylinder(.081,.081,.06,x+dx,y+.12,rz+dz,'gold');
    }
    box(1.58,.09,1.37,x,y+1.57,rz,'trim');box(1.77,.08,1.55,x,y+1.65,rz,'stone');roof(x,y+1.69,rz);
    ring(.25,.018,x,y+.012,z);
  }
  const startCenter=p.start.clone();startCenter.x=-3.05;platform(startCenter,false);platform(p.goal,true);
  const road=(a,b,id)=>{const m=box(a.distanceTo(b)+.04,.2,.74,(a.x+b.x)/2,a.y-.1,(a.z+b.z)/2);m.userData.roads=[id];return m;};
  road(new THREE.Vector3(-2.08,p.start.y,p.start.z),p.dock,'west-road');
  road(p.entry,p.goal.clone().add(new THREE.Vector3(-.98,0,0)),'goal-road');
  const mechanism=new THREE.Group();mechanism.position.copy(p.near);group.add(mechanism);
  const action=m=>{m.userData.activate=onMechanism;return m;};
  const rotates=level.mechanic==='rotate';
  const floor=box(rotates?1.5:1.3,.18,.78,rotates?-.94:0,-.09,0,'stone',mechanism);floor.userData.roads=['deck'];
  if(rotates){const hub=box(.8,.18,.8,0,-.09,0,'trim',mechanism);hub.userData.roads=['deck'];}
  ring(rotates?.22:.17,.015,0,.012,0,'gold',mechanism);
  action(mechanism);
  let controlAnchor;
  if(rotates){
    island(p.near.x,p.near.z,1.55,1.55);
    action(cylinder(.4,.5,1.86,p.near.x,1.1,p.near.z,'control'));
    cylinder(.58,.57,.15,p.near.x,2.22,p.near.z,'trim');
    controlAnchor=p.near.clone().add(new THREE.Vector3(0,-.9,.78));
    const axle=action(cylinder(.07,.07,.55,controlAnchor.x,controlAnchor.y,controlAnchor.z-.28,'gold'));axle.rotation.x=Math.PI/2;
  }else{
    island(p.near.x,p.near.z,1.55,1.55);
    action(cylinder(.3,.35,1.25,0,-.77,0,'control',mechanism));
    cylinder(.45,.45,.12,0,-1.46,0,'mint',mechanism);
    cylinder(.46,.43,.12,0,-.22,0,'trim',mechanism);
    controlAnchor=new THREE.Vector3(0,-.75,.53);
    if(level.mechanic==='slide'){
      for(const z of [-.45,.45]){const rail=box(p.far.x-p.near.x+.9,.035,.025,(p.far.x+p.near.x)/2,.16,z,'gold');rail.castShadow=false;}
      island(p.far.x,p.far.z,1.45,1.45);
    }else{
      for(const x of [-.39,.39])cylinder(.025,.025,p.far.y+.08,x,p.far.y/2,-.46,'gold');
      for(let i=0;i<4;i++)box(.7,.025,.035,0,.9+i*.75,-.46,'gold');
    }
    const pin=action(cylinder(.06,.06,.37,0,-.75,.36,'gold',mechanism));pin.rotation.x=Math.PI/2;
  }
  let viewAnchor,moon;
  if(level.orbit){
    const x=-2.2,z=2.25;island(x,z,1.15,1.15);
    const eye=new THREE.Group();staticGroup.add(eye);eye.userData.activate=onView;
    cylinder(.2,.28,.6,x,.4,z,'control',eye);ring(.27,.015,x,.73,z,'gold',eye);
    add(new THREE.SphereGeometry(.21,24,16),'mint',[x,1.01,z],eye);viewAnchor=new THREE.Vector3(x,1.03,z);
  }else{
    island(-2.3,2.3,1.1,1.1);tree(-2.3,.16,2.3,.8);
  }
  if(['fold','cloister'].includes(level.variant)){
    const height=level.variant==='fold'?2.9:3.5;
    for(let i=0;i<3;i++){const x=-1.3+i*1.8,z=-1.75-(i%2)*.4;island(x,z,1.15,1.1);arch(1.06,height,.7,.25,x,.15,z);box(1.15,.09,.47,x,height+.18,z,'mint');}
    box(4.8,.12,.22,.5,height+.31,-1.75,'mint');
  }
  if(level.variant==='cloud'){
    for(let i=0;i<5;i++){
      const x=-1.2+i*.53,y=.65+i*.6,z=-1.6;box(.55,.15,.85,x,y,z,'mint');cylinder(.09,.1,y,x,y/2,z,'stone');
    }
    tree(p.goal.x+.63,p.goal.y,p.goal.z-.75,.65);
    ring(.55,.017,1.2,.14,1.8,'gold');island(1.2,1.8,1.2,1.15);
  }
  if(level.variant==='water'||level.variant==='mirror'){
    for(const [x,z]of[[.4,1.55],[1.8,1.8],[3,-1.9]]){
      const leaf=cylinder(.21,.21,.025,x,-.91,z,'mint');leaf.castShadow=false;
      ring(.4,.008,x,-.94,z,'mint');
      const petal=add(new THREE.SphereGeometry(.08,12,8),'roseLight',[x,-.85,z]);petal.scale.set(1,.6,1);
    }
    if(level.variant==='mirror'){
      for(let i=0;i<3;i++){const z=-1.8-i*.48;arch(1.2,3.05,.85,.15,1.2+i*.68,.15,z);box(1.3,.09,.35,1.2+i*.68,3.24,z,'mint');}
      moon=add(new THREE.TorusGeometry(.76,.025,8,64),'gold',[4.1,5.65,-1.55]);moon.rotation.y=Math.PI/4;moon.castShadow=false;
    }
  }
  const portal=add(new THREE.OctahedronGeometry(.13),glow,[p.goal.x,p.goal.y+.8,p.goal.z-.73]);
  const halo=add(new THREE.TorusGeometry(.25,.009,8,48),glow,[p.goal.x,p.goal.y+.8,p.goal.z-.73]);halo.castShadow=false;
  // Cache actual architecture corners, including both platform stations, for framing.
  const framePoints=[];
  function collect(root){root.updateWorldMatrix(true,true);root.traverse(m=>{if(!m.geometry)return;m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])framePoints.push(new THREE.Vector3(x,y,z).applyMatrix4(m.matrixWorld));});}
  collect(staticGroup);
  if(rotates){for(let i=0;i<4;i++){mechanism.rotation.y=i*Math.PI/2;collect(mechanism);}mechanism.rotation.y=0;}
  else{collect(mechanism);mechanism.position.copy(p.far);collect(mechanism);mechanism.position.copy(p.near);}
  if(level.variant==='mirror'){
    const reflection=staticGroup.clone(true);reflection.position.y=-1.8;reflection.scale.y=-.25;
    reflection.traverse(m=>{m.userData={};if(m.isMesh){m.material=m.material.clone();m.material.transparent=true;m.material.opacity=.12;m.material.depthWrite=false;m.castShadow=false;m.receiveShadow=false;}});group.add(reflection);
  }
  const water=add(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:level.bottom,transparent:true,opacity:.18,depthWrite:false}),[0,-1.03,0],group);water.rotation.x=-Math.PI/2;water.castShadow=false;
  const shadow=add(new THREE.PlaneGeometry(45,45),new THREE.ShadowMaterial({opacity:.065}),[0,-1.02,0],group);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  return {group,mechanism,controlAnchor,viewAnchor,portal,halo,moon,framePoints,controlInMotion:!rotates};
}
