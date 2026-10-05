import * as THREE from 'three';
import {prepareColliders,applyMechanismPose} from './mechanism.js';
import {setDepthProfile,setLayer,CONTROL_LAYER} from './rendering.js';

const normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(n=>new THREE.Vector3(...n));
export function buildArchitecture(level,p,materials,glow){
  const group=new THREE.Group(),staticGroup=new THREE.Group(),mechanism=new THREE.Group();group.add(staticGroup,mechanism);mechanism.position.set(...level.pivot);mechanism.userData.control='mechanism';
  const fixedSolids=[],movingSolids=[],shaded=[],depthMeshes=[],opticalCaps=[];
  function depth(mesh,profile){setDepthProfile(mesh,profile);depthMeshes.push(mesh);return mesh;}
  function backCap(mesh,index){
    const base=mesh.userData.depthProfile||(()=>0),normal=mesh.geometry.attributes.normal;
    depth(mesh,(point,i)=>base(point,i)-(new THREE.Vector3().fromBufferAttribute(normal,i).dot(normals[index])>.99?16:0));
    opticalCaps.push({mesh,index});
  }
  function box(size,at,palette=level.fixed,parent=staticGroup,roads=[],structural=true){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),normals.map(()=>new THREE.MeshBasicMaterial()));mesh.position.set(...at);parent.add(mesh);
    if(roads.length)mesh.userData.roads=roads;
    if(structural){mesh.userData.structure=parent===mechanism?'moving':'fixed';(parent===mechanism?movingSolids:fixedSolids).push(mesh);}
    shaded.push({mesh,colors:['top','x','z'].map(key=>new THREE.Color(palette[key]))});return mesh;
  }
  function road(a,b,id,wall=false,startCap=0,endCap=0,dockStart=0,dockEnd=0,depths=[0,0]){
    a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);const axis=b.clone().sub(a).normalize();a.addScaledVector(axis,-startCap);b.addScaledVector(axis,endCap);const alongX=Math.abs(axis.x)>Math.abs(axis.z),length=alongX?Math.abs(b.x-a.x):Math.abs(b.z-a.z),mid=a.clone().lerp(b,.5);
    const bottom=wall?(level.base??-.9):a.y-.9,height=a.y-bottom;
    const mesh=box(alongX?[length,height,.9]:[.9,height,length],[mid.x,(a.y+bottom)/2,mid.z],level.fixed,staticGroup,[id]);
    // The tiny collar closes the designed safety clearance visually. Its real
    // collision bounds retain that clearance throughout the entire sweep.
    mesh.geometry.computeBoundingBox();mesh.userData.solidBounds=mesh.geometry.boundingBox.clone();
    const position=mesh.geometry.attributes.position,key=alongX?'x':'z',positive=axis[key]>0;
    for(let i=0;i<position.count;i++){
      const value=alongX?position.getX(i):position.getZ(i),extension=value>0?(positive?dockEnd:dockStart):(positive?dockStart:dockEnd);
      if(alongX)position.setX(i,value+Math.sign(value)*extension);else position.setZ(i,value+Math.sign(value)*extension);
    }
    mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
    mesh.userData.dockCollar={start:dockStart,end:dockEnd};
    if(depths[0])depth(mesh,()=>depths[0]);
    if((level.id==='double-cloister'||level.id==='hanging-stair')&&id==='middle')backCap(mesh,4);
    if(level.goalBlock&&id==='goal-road')backCap(mesh,0);
    return mesh;
  }
  for(const path of level.paths){
    for(let i=0;i<path.points.length-1;i++)road(path.points[i],path.points[i+1],i===0?path.id:path.id+'-'+i,path.wall&&(path.solid||i<path.points.length-2),path.id==='west-road'&&i===0?.45:0,(path.id===(level.goalPath||'goal-road')&&!level.goalBlock&&i===path.points.length-2)?.45:0,i===0?path.dockStart||0:0,i===path.points.length-2?path.dockEnd||0:0,[path.depths?.[i]||0,path.depths?.[i+1]||0]);
    for(let i=1;i<path.points.length-1;i++){
      const [x,y,z]=path.points[i],bottom=path.wall?(level.base??-.9):y-.9;
      const mesh=box([.9,y-bottom,.9],[x,(y+bottom)/2,z],level.fixed,staticGroup,[i===1?path.id:path.id+'-'+(i-1),path.id+'-'+i]);
      if(path.depths?.[i])depth(mesh,()=>path.depths[i]);
    }
  }
  for(const stair of level.stairs||[])for(const tread of stair.treads){
    const a=new THREE.Vector3(...tread.p0),b=new THREE.Vector3(...tread.p1),alongX=Math.abs(b.x-a.x)>Math.abs(b.z-a.z),mid=a.clone().lerp(b,.5),bottom=level.base??-.9;
    box(alongX?[Math.abs(b.x-a.x),a.y-bottom,.9]:[.9,a.y-bottom,Math.abs(b.z-a.z)],[mid.x,(a.y+bottom)/2,mid.z],level.fixed,staticGroup,[tread.id]);
  }
  for(const spec of level.fixedBoxes||[]){
    const mesh=box(spec.size,spec.at,spec.support?level.support:level.fixed);
    if(spec.depth)depth(mesh,()=>spec.depth);
    if(level.goalBlock&&spec.size.every(s=>s===.9))backCap(mesh,0);
  }
  for(const spec of level.beams){
    const mesh=box(spec.size,spec.at,spec.support?level.support:level.moving,mechanism,spec.roads);
    if(level.id==='folded-frame'&&spec.roads.includes('deck-fold')&&spec.size[1]===4)backCap(mesh,3);
    if(level.id==='blue-gate'&&spec.roads.includes('deck-back'))backCap(mesh,3);
    if(level.id==='hanging-stair'&&spec.roads.includes('deck-upper')&&spec.size[2]===3)backCap(mesh,5);
  }
  const flat=(color)=>new THREE.MeshBasicMaterial({color});
  function add(geometry,material,at,parent=staticGroup){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...at);parent.add(mesh);return mesh;}
  if(level.bearing){
    const mat=[flat('#bd642c'),flat('#ff9c50'),flat('#b65d28')],base=add(new THREE.CylinderGeometry(.64,.64,1.5,32),mat,[0,1.35,0]);base.userData.control='mechanism';base.userData.structure='fixed';fixedSolids.push(base);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,grip=add(new THREE.BoxGeometry(.09,.45,.1),flat('#ffa549'),[Math.cos(a)*.625,1.3,Math.sin(a)*.625]);grip.rotation.y=-a;grip.userData.control='mechanism';}
  }
  const knob=new THREE.Group();knob.position.set(...level.control);knob.userData.control='mechanism';staticGroup.add(knob);if(level.controlAxis==='x')knob.rotation.y=Math.PI/2;if(level.controlAxis==='y')knob.rotation.x=Math.PI/2;
  const crank=level.controlColor||color('#c59561','#af7951','#946041'),gold=level.controlTips||color('#f4ce83','#e9ac58','#cb9244');
  if(!level.bearing){
    const spindle=level.controlAxis==='y'?.55:.44;box([.11,.11,spindle],[0,0,-spindle/2],level.moving,knob,[],false);
    box([.76,.14,.15],[0,0,0],crank,knob,[],false);box([.14,.76,.15],[0,0,0],crank,knob,[],false);
    for(const [x,y]of[[-.32,0],[.32,0],[0,-.32],[0,.32]])box([.16,.16,.19],[x,y,.015],gold,knob,[],false);
  }
  setLayer(knob,CONTROL_LAYER);
  // A printed emblem on the floor: no floating beacon or oversized destination UI.
  const seal=new THREE.Group();seal.position.copy(p.goal).add(new THREE.Vector3(0,.011,0));staticGroup.add(seal);
  const sealGold=flat('#e6b951'),sealIvory=flat('#fff4d0');
  function ring(radius,tube,y,mat){const mesh=add(new THREE.TorusGeometry(radius,tube,5,64),mat,[0,y,0],seal);mesh.rotation.x=-Math.PI/2;return mesh;}
  const disk=add(new THREE.CircleGeometry(.33,48),sealIvory,[0,0,0],seal);disk.rotation.x=-Math.PI/2;ring(.32,.011,.003,sealGold);ring(.275,.005,.004,sealGold);
  for(let i=0;i<4;i++){const a=i*Math.PI/2,petal=add(new THREE.CircleGeometry(.094,24),sealGold,[Math.cos(a)*.104,.006,Math.sin(a)*.104],seal);petal.rotation.x=-Math.PI/2;}
  const completionRing=ring(.38,.006,.01,glow);completionRing.visible=false;
  const goalDepth=level.paths.find(path=>path.id===(level.goalPath||'goal-road')).depths?.at(-1)||0;
  if(goalDepth)seal.traverse(mesh=>{if(mesh.isMesh)depth(mesh,()=>goalDepth);});
  seal.userData.emblem='golden-four-petal';
  function shade(){
    group.updateWorldMatrix(true,true);
    for(const {mesh,colors}of shaded){
      const q=mesh.getWorldQuaternion(new THREE.Quaternion());
      normals.forEach((n,i)=>{const w=n.clone().applyQuaternion(q),top=Math.max(0,w.y),x=Math.abs(w.x),z=Math.abs(w.z),sum=top+x+z;
        mesh.material[i].color.copy(colors[0]).multiplyScalar(top/(sum||1)).add(colors[1].clone().multiplyScalar(x/(sum||1))).add(colors[2].clone().multiplyScalar(z/(sum||1)));
        if(w.y<-.99)mesh.material[i].color.copy(colors[2]);
      });
    }
  }
  const framePoints=[];
  function collect(root){root.updateWorldMatrix(true,true);root.traverse(mesh=>{if(!mesh.geometry)return;mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])framePoints.push(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));});}
  collect(staticGroup);
  const stage={group,mechanism,knob,controlAnchor:new THREE.Vector3(...level.control),controlInMotion:false,fixedSolids,movingSolids,seal,completionRing,framePoints,shade,depthMeshes,opticalCaps};
  for(let i=0;i<=24;i++){applyMechanismPose(level,stage,i/24*(level.tilt?Math.PI/2:Math.PI*2));collect(mechanism);}applyMechanismPose(level,stage,0);
  for(const point of [p.start,p.goal])framePoints.push(point.clone().add(new THREE.Vector3(0,.65,0)));
  if(level.id!=='folded-frame'){
    const plane=add(new THREE.PlaneGeometry(11,11),new THREE.MeshBasicMaterial({color:level.bottom,transparent:true,opacity:.18,depthWrite:false}),[0,-1.25,0],group);plane.rotation.x=-Math.PI/2;plane.userData.background=true;
  }
  prepareColliders(stage);shade();return stage;
}
function color(top,x,z){return {top,x,z};}
