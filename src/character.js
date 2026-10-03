import * as THREE from 'three';
export function createTraveller(){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const colors={coat:'#fff4d8',hat:'#efe0b6',band:'#c48576',skin:'#ddb499',hair:'#776a59',boots:'#566f69',eyes:'#485451',glow:'#ffdfa0'};
  const mats=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,key==='glow'?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,roughness:.92})]));
  const add=(geo,mat,pos,parent=body)=>{const m=new THREE.Mesh(geo,mats[mat]);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const ball=(r,mat,pos,parent=body)=>add(new THREE.SphereGeometry(r,20,16),mat,pos,parent);
  const legs=[];
  for(const x of [-.072,.072]){
    const leg=new THREE.Group();leg.position.set(x,.29,0);root.add(leg);legs.push(leg);
    add(new THREE.CylinderGeometry(.036,.031,.23,12),'boots',[0,-.12,0],leg);
    const shoe=ball(.047,'boots',[0,-.252,.025],leg);shoe.scale.set(.9,.65,1.4);
  }
  const profile=[[.12,.27],[.156,.3],[.158,.34],[.125,.48],[.08,.54],[.06,.55]].map(([r,y])=>new THREE.Vector2(r,y));
  const coat=add(new THREE.LatheGeometry(profile,32),'coat',[0,0,0]);
  ball(.12,'skin',[0,.636,0]);
  add(new THREE.SphereGeometry(.124,20,12,0,Math.PI*2,0,Math.PI*.5),'hair',[0,.643,0]);
  for(const x of [-.038,.038])ball(.012,'eyes',[x,.63,.11]);
  const nose=ball(.021,'skin',[0,.61,.117]);nose.scale.set(.8,.8,.6);
  const hat=new THREE.Group();hat.rotation.z=-.04;body.add(hat);
  add(new THREE.CylinderGeometry(.235,.24,.026,40),'hat',[0,.722,0],hat);
  add(new THREE.SphereGeometry(.157,32,18,0,Math.PI*2,0,Math.PI/2),'hat',[0,.729,0],hat);
  add(new THREE.CylinderGeometry(.159,.159,.035,32),'band',[0,.742,0],hat);
  const bow=ball(.036,'band',[-.167,.745,.025],hat);bow.scale.set(.5,.7,1.5);
  const collar=add(new THREE.TorusGeometry(.087,.018,8,32),'band',[0,.527,0]);collar.rotation.x=Math.PI/2;
  const scarf=add(new THREE.BoxGeometry(.07,.19,.025),'band',[-.04,.429,-.134]);scarf.rotation.z=-.15;
  const arms=[];
  for(const x of [-.162,.162]){
    const arm=new THREE.Group();arm.position.set(x,.48,0);body.add(arm);arms.push(arm);
    arm.rotation.z=x<0?-.12:.12;
    add(new THREE.CapsuleGeometry(.034,.12,4,12),'coat',[0,-.075,0],arm);
    ball(.034,'skin',[0,-.159,0],arm);
  }
  const lantern=ball(.047,'glow',[0,-.212,.026],arms[1]);
  const handle=add(new THREE.TorusGeometry(.027,.006,6,16),'boots',[0,-.17,.026],arms[1]);
  root.userData.actor=true;
  return {root,pose(time,moving,reduced){
    const phase=time*11,stride=moving&&!reduced?Math.sin(phase):0;
    legs[0].rotation.x=stride*.48;legs[1].rotation.x=-stride*.48;
    arms[0].rotation.x=-stride*.23;arms[1].rotation.x=stride*.19;
    body.position.y=moving&&!reduced?Math.abs(Math.cos(phase))*.015:0;
    coat.rotation.z=moving&&!reduced?stride*.022:0;
    scarf.rotation.x=moving&&!reduced?stride*.12:0;
    lantern.scale.setScalar(reduced?1:1+Math.sin(time*2)*.05);
  }};
}
