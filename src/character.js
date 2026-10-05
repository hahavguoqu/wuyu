import * as THREE from 'three';

export function createTraveller(){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const colors={coat:'#e6bb59',lining:'#ffe0a0',skin:'#f1d4b9',hair:'#edf0e7',hairShade:'#cbd8d1',band:'#404a4b',boots:'#425355',eyes:'#b28946',glow:'#ffe6ae'};
  const mats=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:1})]));
  const add=(geo,mat,pos,parent=body)=>{const mesh=new THREE.Mesh(geo,mats[mat]);mesh.position.set(...pos);mesh.castShadow=true;parent.add(mesh);return mesh;};
  const ball=(r,mat,pos,parent=body)=>add(new THREE.SphereGeometry(r,16,12),mat,pos,parent);
  const legs=[];
  for(const x of [-.064,.064]){
    const leg=new THREE.Group();leg.position.set(x,.29,0);root.add(leg);legs.push(leg);
    add(new THREE.CylinderGeometry(.03,.027,.19,10),'skin',[0,-.093,0],leg);
    const shoe=ball(.044,'boots',[0,-.238,.022],leg);shoe.scale.set(.9,.9,1.5);
    add(new THREE.CylinderGeometry(.035,.035,.075,10),'boots',[0,-.193,0],leg);
  }
  const profile=[[.125,.28],[.16,.32],[.151,.39],[.1,.52],[.073,.55]].map(([r,y])=>new THREE.Vector2(r,y));
  const coat=add(new THREE.LatheGeometry(profile,20),'coat',[0,0,0]);
  const hem=add(new THREE.TorusGeometry(.142,.012,6,24),'lining',[0,.315,0]);hem.rotation.x=Math.PI/2;
  add(new THREE.BoxGeometry(.012,.15,.01),'lining',[0,.432,.127]);
  const collar=add(new THREE.TorusGeometry(.078,.016,6,24),'band',[0,.534,0]);collar.rotation.x=Math.PI/2;
  const head=new THREE.Group();head.position.y=.665;body.add(head);
  const face=ball(.125,'skin',[0,0,0],head);face.scale.set(.93,1,1);
  const hair=add(new THREE.SphereGeometry(.144,24,18,0,Math.PI*2,0,Math.PI*.67),'hair',[0,.013,-.018],head);hair.scale.set(1,1.03,1);
  // A white bob with separate tapered locks stays legible at game scale.
  for(const [x,y,z,lean] of [[-.117,-.045,-.005,-.1],[.117,-.045,-.005,.1],[-.076,.025,.108,-.4],[-.022,.035,.128,-.26],[.038,.036,.123,.25],[.093,.027,.091,.5]]){
    const lock=add(new THREE.ConeGeometry(.045,.135,4),'hair',[x,y,z],head);lock.rotation.z=Math.PI+lean;
  }
  const band=add(new THREE.TorusGeometry(.139,.013,6,32,Math.PI),'band',[0,.015,-.016],head);band.rotation.z=.08;
  for(const x of [-.038,.038]){const eye=ball(.012,'eyes',[x,-.022,.117],head);eye.scale.y=1.3;}
  ball(.012,'skin',[0,-.041,.126],head);
  const star=new THREE.Shape();
  for(let i=0;i<10;i++){const angle=Math.PI/2+i*Math.PI/5,r=i%2?.016:.034,x=Math.cos(angle)*r,y=Math.sin(angle)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
  const clip=add(new THREE.ExtrudeGeometry(star,{depth:.009,bevelEnabled:false}),'coat',[-.123,.045,.064],head);clip.rotation.y=-.6;
  const arms=[];
  for(const x of [-.15,.15]){
    const arm=new THREE.Group();arm.position.set(x,.49,0);body.add(arm);arms.push(arm);arm.rotation.z=x<0?-.14:.14;
    add(new THREE.CapsuleGeometry(.029,.105,3,10),'coat',[0,-.07,0],arm);
    ball(.029,'band',[0,-.147,.004],arm);
  }
  const scarf=add(new THREE.BoxGeometry(.06,.13,.016),'lining',[.055,.452,-.123]);scarf.rotation.z=.18;
  root.userData.actor=true;
  return {root,pose(time,moving,reduced){
    const stride=moving&&!reduced?Math.sin(time*11):0;
    legs[0].rotation.x=stride*.48;legs[1].rotation.x=-stride*.48;
    arms[0].rotation.x=-stride*.22;arms[1].rotation.x=stride*.22;
    body.position.y=moving&&!reduced?Math.abs(Math.cos(time*11))*.014:0;
    coat.rotation.z=stride*.018;scarf.rotation.x=stride*.1;
  }};
}
