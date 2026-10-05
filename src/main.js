import * as THREE from 'three';
import {LEVELS,CHAPTER_NAMES,levelPoints,centerAnchor} from './levels.js';
import {buildNavigation,anchorPoint,closestAnchor,planRoute} from './navigation.js';
import {buildArchitecture} from './architecture.js';
import {createTraveller} from './character.js';
import {rotationDetent,travelFromDrag,angularDelta} from './interaction.js';
import {applyMechanismPose,safeMechanismValue} from './mechanism.js';
import {setLayer,renderLayers,visibleHitPoint,TRAVELLER_LAYER,CONTROL_LAYER,BUILDING_LAYER} from './rendering.js';
import './style.css';
const $=id=>document.getElementById(id),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const walkingSpeed=(reducedMotion?5:1.45)*1.5;
const palette={stone:'#e0dfcc',trim:'#fff4d7',rose:'#c98d82',control:'#b98554',roseLight:'#e4b0a0',mint:'#65af9c',green:'#397d70',gold:'#dfb45c',shadow:'#89958c'};
const materials=Object.fromEntries(Object.entries(palette).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:.9})]));
const glow=new THREE.MeshBasicMaterial({color:'#ffe4a0'}),shared=new Set([...Object.values(materials),glow]);
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-10,10,6,-6,.1,100);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch(error){$('fallback').hidden=false;throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);renderer.autoClear=false;$('scene').append(renderer.domElement);
scene.add(new THREE.HemisphereLight('#fff8e8','#9ab9ad',1.5));
const sun=new THREE.DirectionalLight('#fff6df',2.2);sun.position.set(-5,12,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.5,far:40});sun.shadow.bias=-.0007;sun.shadow.normalBias=.03;scene.add(sun);
const fill=new THREE.DirectionalLight('#d4e9e5',.75);fill.position.set(8,5,-8);scene.add(fill);
scene.children.filter(object=>object.isLight).forEach(light=>light.layers.enableAll());
const world=new THREE.Group();scene.add(world);
let levelIndex=0,unlocked=LEVELS.length-1,level,points,architecture,actor,location={segment:'west-road',t:0};
let orientation=0,travel=0,bridgeAngle=0,viewAngle=Math.PI/4,mechanismMotion=null,walking=null,gesture=null;
let won=false,menuOpen=false,hasStarted=false,elapsed=0,desiredHeading=Math.PI/4,completionTimer,soundEnabled=false,audioContext;
const completed=new Set(),soundTimers=new Set();
try{
  const stored=JSON.parse(localStorage.getItem('mist-isles-reference-v1')||'{}');
  if(Number.isInteger(stored.level))levelIndex=THREE.MathUtils.clamp(stored.level,0,unlocked);
  for(const id of stored.completed||[])if(LEVELS.some(l=>l.id===id))completed.add(id);
}catch{}
function saveProgress(){try{localStorage.setItem('mist-isles-reference-v1',JSON.stringify({unlocked,level:levelIndex,completed:[...completed]}));}catch{}}
function navigation(){return buildNavigation(level,{orientation,travel,bridgeAngle},camera);}
function namedAnchor(name){return name==='start'?level.startAnchor:name==='center'?centerAnchor(level):level.goalAnchor;}
function reachable(name){return !!planRoute(navigation(),location,namedAnchor(name));}
function busy(){return !!(walking||mechanismMotion||gesture||won||menuOpen);}
function clearStage(){
  const geos=new Set(),mats=new Set();world.traverse(m=>{if(m.geometry)geos.add(m.geometry);if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material])if(!shared.has(mat))mats.add(mat);});world.clear();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
}
function tone(freq=440,length=.25){
  if(!soundEnabled)return;audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,audioContext.currentTime);gain.gain.linearRampToValueAtTime(.045,audioContext.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+length);osc.connect(gain).connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+length);
}
function updateLocation(){
  actor.root.position.copy(anchorPoint(navigation(),location));
  $('start-marker').classList.toggle('current',location.segment==='west-road'&&location.t<.01);
  const center=centerAnchor(level);$('center-marker').classList.toggle('current',location.segment===center.segment&&Math.abs(location.t-center.t)<.025);
  Object.assign($('game').dataset,{segment:location.segment,position:String(location.t)});
}
function hint(){
  if(!level.lesson||won||mechanismMotion||walking)return '';
  if(reachable('goal'))return '点击路径，走向纹章';
  if(level.tilt)return '按住转柄，转动折臂';
  if(location.segment==='deck-upper')return '转动横梁，走向纹章';
  if(location.segment.startsWith('middle'))return '走上上层横梁，再转动';
  return '点击路径，沿下层走向回廊';
}
function updateUI(message){
  const blocked=!!(mechanismMotion||won||menuOpen);
  for(const [id,name]of [['start-marker','start'],['center-marker','center'],['goal-marker','goal']]){$(id).disabled=blocked;$(id).classList.toggle('blocked',!reachable(name));$(id).classList.toggle('active',reachable(name));}
  $('bridge-control').disabled=blocked;
  $('bridge-control').classList.toggle('active',location.segment.startsWith('deck')&&!won);
  for(const button of $('landing-markers').children){button.disabled=blocked;button.classList.toggle('blocked',!planRoute(navigation(),location,level.landmarks[Number(button.dataset.landmark)]));}
  $('stop').hidden=!walking;$('move-target').hidden=!walking;if(walking){const p=screenPoint(anchorPoint(navigation(),walking.destination));$('move-target').style.left=p.x+'px';$('move-target').style.top=p.y+'px';}
  $('hint').textContent=level.lesson?(message??hint()):'';$('hint').hidden=!$('hint').textContent;
  Object.assign($('game').dataset,{level:String(levelIndex+1),orientation:String(orientation),angle:String(bridgeAngle),travel:String(travel),view:String(viewAngle),busy:String(busy()),connected:String(navigation().outgoing),menu:String(menuOpen),mechanic:level.mechanic,viewMode:'fixed',dragging:gesture?.kind||'',lesson:String(!!level.lesson)});
}
const mechanicNames={rotate:'旋转桥梁',slide:'移动平台',lift:'升降平台'};
const iconPaths={rotate:'<path d="M17 8a7 7 0 1 0 2 7M17 3v5h-5"/>',slide:'<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',lift:'<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>'};
function updateLevelMenu(){
  $('chapter-name').textContent=CHAPTER_NAMES[levelIndex];$('chapters').setAttribute('aria-label','第'+CHAPTER_NAMES[levelIndex]+'关 '+level.name);$('level-panel').replaceChildren();$('menu-levels').replaceChildren();$('menu-progress').textContent=completed.size+' / '+LEVELS.length;
  LEVELS.forEach((item,index)=>{
    const label='第'+CHAPTER_NAMES[index]+'关 '+item.name;
    const button=document.createElement('button');button.className='level-option';button.textContent=CHAPTER_NAMES[index]+' · '+item.name;button.disabled=index>unlocked;button.setAttribute('aria-label',label);if(index===levelIndex)button.setAttribute('aria-current','step');button.addEventListener('click',()=>loadLevel(index,true));$('level-panel').append(button);
    const row=document.createElement('button');row.className='menu-level';row.disabled=index>unlocked;row.setAttribute('aria-label',label);if(index===levelIndex)row.setAttribute('aria-current','step');
    const svg=iconPaths[item.mechanic];
    row.innerHTML='<span class="level-art" data-art="'+item.variant+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none">'+svg+'</svg></span><span class="level-number">0'+(index+1)+'</span><span class="level-name">'+item.name+'</span><span class="level-status">'+(index>unlocked?'未解锁':completed.has(item.id)?'✓':'')+'</span>';
    row.addEventListener('click',()=>{hasStarted=true;if(index===levelIndex&&!won)closeMenu();else loadLevel(index,true);});$('menu-levels').append(row);
  });
}
function loadLevel(index,focus=false){
  const oldGesture=gesture;gesture=null;if(oldGesture?.owner.hasPointerCapture(oldGesture.id))oldGesture.owner.releasePointerCapture(oldGesture.id);
  clearTimeout(completionTimer);soundTimers.forEach(clearTimeout);soundTimers.clear();menuOpen=false;$('game-menu').hidden=true;$('completion').hidden=true;$('completion').inert=false;
  for(const selector of ['.topbar','#markers','.controls'])document.querySelector(selector).inert=false;
  for(const id of ['help-panel','level-panel'])$(id).hidden=true;for(const id of ['help','chapters'])$(id).setAttribute('aria-expanded','false');
  levelIndex=THREE.MathUtils.clamp(index,0,unlocked);level=LEVELS[levelIndex];points=levelPoints(level);location={segment:'west-road',t:0};orientation=0;travel=0;bridgeAngle=0;viewAngle=level.initialView;mechanismMotion=null;walking=null;won=false;desiredHeading=level.initialView;
  clearStage();architecture=buildArchitecture(level,points,materials,glow);world.add(architecture.group);actor=createTraveller();actor.root.scale.setScalar(.65);setLayer(actor.root,TRAVELLER_LAYER);world.add(actor.root);actor.root.rotation.y=desiredHeading;applyMechanism();updateLocation();
  $('game').style.background='linear-gradient(180deg,'+level.top+' 0%,'+level.bottom+' 100%)';
  $('sky-disc').hidden=!level.disc;$('sky-disc').style.background=level.disc||'transparent';$('game').style.setProperty('--ink',level.id==='blue-gate'?'#e0e8e5':'#496562');$('game').style.setProperty('--muted',level.id==='blue-gate'?'#cfdfdf':'#647b79');
  $('landing-markers').replaceChildren();level.landmarks.forEach((target,i)=>{const button=document.createElement('button');button.className='world-marker';button.setAttribute('aria-label',target.label);button.dataset.landmark=i;button.innerHTML='<span></span>';button.addEventListener('click',()=>walkToAnchor(target));$('landing-markers').append(button);});
  $('center-marker').hidden=true;
  $('bridge-control').setAttribute('aria-label',mechanicNames[level.mechanic]);$('bridge-control').title=mechanicNames[level.mechanic];$('bridge-control').innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'+iconPaths[level.mechanic]+'</svg>';
  const instructions='点击路径移动；拖动转柄旋转，松手对齐。看似相接的道路可以通行。';
  $('help-copy').textContent=instructions;$('scene').setAttribute('aria-label',instructions);document.title='雾屿 · '+level.name;updateLevelMenu();resize();updateUI();saveProgress();if(focus)$('center-marker').focus({preventScroll:true});
}
function walkTo(name){walkToAnchor(namedAnchor(name));}
function walkToAnchor(destination){
  if(mechanismMotion||gesture||won||menuOpen)return;
  const route=planRoute(navigation(),location,destination);if(!route){updateUI(hint());tone(220);return;}
  walking={steps:route,destination:{segment:destination.segment,t:destination.t},index:0,time:0};hasStarted=true;tone(523.25);updateUI();
}
function stopWalking(){if(!walking)return;walking=null;actor.pose(elapsed,false,reducedMotion);updateLocation();updateUI();}
function activateMechanism(direction=1){
  if(busy())return;
  if(level.mechanic==='rotate'){
    const to=level.tilt?(bridgeAngle<Math.PI/4?Math.PI/2:0):bridgeAngle+direction*Math.PI/2;
    mechanismMotion={type:'rotate',from:bridgeAngle,to,time:0,duration:reducedMotion?.15:.85};
  }else mechanismMotion={type:'travel',from:travel,to:travel>.5?0:1,time:0,duration:reducedMotion?.2:level.mechanic==='lift'?1.65:2.1};
  tone(349.23,.5);updateUI();
}
function applyMechanism(){
  applyMechanismPose(level,architecture,level.mechanic==='rotate'?bridgeAngle:travel);
  architecture.mechanism.updateWorldMatrix(true,true);
}
function finish(){
  won=true;completed.add(level.id);unlocked=Math.max(unlocked,Math.min(levelIndex+1,LEVELS.length-1));saveProgress();updateLevelMenu();updateUI();tone(659.25,.65);
  architecture.completionRing.visible=true;
  for(const [delay,freq]of [[170,783.99],[360,1046.5]]){const timer=setTimeout(()=>{soundTimers.delete(timer);tone(freq,1);},delay);soundTimers.add(timer);}
  completionTimer=setTimeout(()=>{$('complete-title').textContent=levelIndex===LEVELS.length-1?'漫游完成':'抵达';$('next').textContent=levelIndex===LEVELS.length-1?'再出发':'下一关';$('completion').hidden=false;for(const selector of ['.topbar','#markers','.controls'])document.querySelector(selector).inert=true;if(!menuOpen)$('next').focus();},reducedMotion?50:800);
}
function advanceWalking(delta){
  let budget=delta;
  while(walking){
    const step=walking.steps[walking.index];
    if(!step){location={...walking.destination};walking=null;updateLocation();updateUI();if(location.segment===level.goalAnchor.segment&&location.t>.999)finish();break;}
    if(step.teleport){location={...step.end};walking.index++;walking.time=0;updateLocation();continue;}
    const duration=step.from.distanceTo(step.to)/walkingSpeed,consumed=Math.min(budget,Math.max(0,duration-walking.time));walking.time+=consumed;budget-=consumed;
    const t=duration>0?Math.min(walking.time/duration,1):1;location={segment:step.segment,t:THREE.MathUtils.lerp(step.fromT,step.toT,t)};updateLocation();
    if(Math.hypot(step.to.x-step.from.x,step.to.z-step.from.z)>.001)desiredHeading=Math.atan2(step.to.x-step.from.x,step.to.z-step.from.z);
    if(t<1)break;walking.index++;walking.time=0;if(budget<=0)break;
  }
}
function screenPoint(point){const p=point.clone().project(camera);return {x:(p.x*.5+.5)*$('game').clientWidth,y:(-.5*p.y+.5)*$('game').clientHeight};}
function applyView(){
  const width=$('game').clientWidth,height=$('game').clientHeight,aspect=width/height;
  const direction=new THREE.Vector3(18,18,18),target=new THREE.Vector3(0,2,0);
  camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld();
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of architecture.framePoints){const d=p.clone().sub(target),x=d.dot(right),y=d.dot(up);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  target.addScaledVector(right,(minX+maxX)/2).addScaledVector(up,(minY+maxY)/2);
  const availableH=Math.max(.7,(height-(width<600?130:110))/height),availableW=Math.max(.8,(width-48)/width);
  const viewHeight=Math.max((maxY-minY+.75)/availableH,(maxX-minX+.65)/aspect/availableW,6.4);
  camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();
  // Shift the composition slightly below centre to make room for the title on mobile.
  target.addScaledVector(up,-viewHeight*(width<600?.035:.015));camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld();
}
function positionMarkers(){
  const control=architecture.controlInMotion?architecture.controlAnchor.clone().applyMatrix4(architecture.mechanism.matrixWorld):architecture.controlAnchor;
  const anchors=[['start-marker',points.start],['center-marker',anchorPoint(navigation(),centerAnchor(level))],['goal-marker',points.goal],['bridge-control',control]];
  for(const [id,point]of anchors){const p=screenPoint(point.clone().add(new THREE.Vector3(0,.025,0)));$(id).style.left=p.x+'px';$(id).style.top=p.y+'px';}
  for(const button of $('landing-markers').children){const p=screenPoint(anchorPoint(navigation(),level.landmarks[Number(button.dataset.landmark)]));button.style.left=p.x+'px';button.style.top=p.y+'px';}
  if(walking){const p=screenPoint(anchorPoint(navigation(),walking.destination));$('move-target').style.left=p.x+'px';$('move-target').style.top=p.y+'px';}
}
function resize(){if(!architecture)return;renderer.setSize($('game').clientWidth,$('game').clientHeight);applyView();positionMarkers();updateUI();}
function openMenu(){if(gesture)endGesture(true);menuOpen=true;$('game-menu').hidden=false;$('completion').inert=true;updateLevelMenu();$('continue').textContent=won?(levelIndex===LEVELS.length-1?'再出发':'下一关'):hasStarted?'继续':'开始';for(const selector of ['.topbar','#markers','.controls'])document.querySelector(selector).inert=true;for(const id of ['help-panel','level-panel'])$(id).hidden=true;for(const id of ['help','chapters'])$(id).setAttribute('aria-expanded','false');updateUI();$('continue').focus();}
function closeMenu(){menuOpen=false;hasStarted=true;$('game-menu').hidden=true;$('completion').inert=false;for(const selector of ['.topbar','#markers','.controls'])document.querySelector(selector).inert=won;updateUI();(won?$('next'):$('menu')).focus({preventScroll:true});}
for(const id of ['menu','complete-menu'])$(id).addEventListener('click',openMenu);$('menu-close').addEventListener('click',closeMenu);$('continue').addEventListener('click',()=>{if(won)loadLevel(levelIndex===LEVELS.length-1?0:levelIndex+1,true);else closeMenu();});
$('stop').addEventListener('click',stopWalking);for(const [id,name]of [['start-marker','start'],['center-marker','center'],['goal-marker','goal']])$(id).addEventListener('click',()=>walkTo(name));
$('bridge-control').addEventListener('click',event=>{if(event.detail===0)activateMechanism();});$('reset').addEventListener('click',()=>loadLevel(levelIndex));$('again').addEventListener('click',()=>loadLevel(levelIndex,true));$('next').addEventListener('click',()=>loadLevel(levelIndex===LEVELS.length-1?0:levelIndex+1,true));
$('help').addEventListener('click',()=>{const open=$('help-panel').hidden;$('help-panel').hidden=!open;$('help').setAttribute('aria-expanded',String(open));$('level-panel').hidden=true;$('chapters').setAttribute('aria-expanded','false');});
$('chapters').addEventListener('click',()=>{const open=$('level-panel').hidden;$('level-panel').hidden=!open;$('chapters').setAttribute('aria-expanded',String(open));$('help-panel').hidden=true;$('help').setAttribute('aria-expanded','false');});
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'关闭声音':'开启声音');$('sound').title=soundEnabled?'关闭声音':'开启声音';tone(523.25,.6);});
window.addEventListener('keydown',event=>{
  const dialog=menuOpen?$('game-menu'):!$('completion').hidden?$('completion'):null;
  if(dialog){if(event.key==='Escape'&&menuOpen){closeMenu();return;}if(event.key==='Tab'){const buttons=[...dialog.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}return;}
  if(event.code==='Space'&&walking&&event.target===document.body){event.preventDefault();stopWalking();}
  if(event.key==='Escape'){for(const id of ['help-panel','level-panel'])$(id).hidden=true;for(const id of ['help','chapters'])$(id).setAttribute('aria-expanded','false');}
  if(event.key==='ArrowLeft'){event.preventDefault();activateMechanism(-1);}if(event.key==='ArrowRight'){event.preventDefault();activateMechanism(1);}
});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function pickInteraction(event){
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  let hit;
  // Pick the same foreground layers that are visible on screen.
  for(const layer of [TRAVELLER_LAYER,CONTROL_LAYER,BUILDING_LAYER]){
    raycaster.layers.set(layer);
    const hits=raycaster.intersectObjects(world.children,true);
    hits.sort((a,b)=>visibleHitPoint(a).distanceToSquared(camera.position)-visibleHitPoint(b).distanceToSquared(camera.position));
    if(hits.length){hit=hits[0];break;}
  }
  raycaster.layers.set(BUILDING_LAYER);if(!hit)return null;
  if(hit.object.userData.roads&&hit.face&&hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y>.5){const anchor=closestAnchor(navigation(),hit.point,hit.object.userData.roads);if(anchor)return {kind:'road',anchor};}
  let object=hit.object;while(object){if(object===actor.root)return {kind:'actor'};if(object.userData.control)return {kind:object.userData.control};object=object.parent;}return null;
}
let pointerDown;
function startGesture(event,forcedKind){
  if(event.button!==0||event.isPrimary===false||gesture||mechanismMotion||won||menuOpen)return;
  const hit=forcedKind?{kind:forcedKind}:pickInteraction(event);
  pointerDown={id:event.pointerId,x:event.clientX,y:event.clientY,hit};
  if(hit?.kind!=='mechanism')return;
  stopWalking();event.preventDefault();
  const anchor=architecture.controlInMotion?architecture.controlAnchor.clone().applyMatrix4(architecture.mechanism.matrixWorld):architecture.controlAnchor;
  const center=screenPoint(anchor),dx=event.clientX-center.x,dy=event.clientY-center.y;
  const near=screenPoint(points.near),far=screenPoint(points.far);
  gesture={kind:hit.kind,id:event.pointerId,owner:event.currentTarget,x:event.clientX,y:event.clientY,center,initialAngle:bridgeAngle,initialTravel:travel,rail:{x:far.x-near.x,y:far.y-near.y},lastAngle:Math.atan2(dy,dx),circular:Math.hypot(dx,dy)>16,angleDelta:0,moved:false};
  gesture.owner.setPointerCapture(gesture.id);hasStarted=true;updateUI();
}
function carryRotation(next){
  next=safeMechanismValue(level,architecture,bridgeAngle,next);
  if(location.segment.startsWith('deck')&&level.axis==='y'){const delta=next-bridgeAngle;desiredHeading+=delta;actor.root.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),delta));}
  bridgeAngle=next;
}
function moveGesture(event){
  const g=gesture;if(!g||g.id!==event.pointerId)return;
  event.preventDefault();const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(Math.hypot(dx,dy)>5)g.moved=true;if(!g.moved)return;
  if(level.mechanic==='rotate'){
    if(g.circular){const a=Math.atan2(event.clientY-g.center.y,event.clientX-g.center.x);g.angleDelta+=angularDelta(g.lastAngle,a);g.lastAngle=a;carryRotation(g.initialAngle-g.angleDelta);}
    else carryRotation(g.initialAngle+(dx-dy*.45)*Math.PI/160);
    orientation=rotationDetent(bridgeAngle).orientation;applyMechanism();updateLocation();
  }else{travel=safeMechanismValue(level,architecture,travel,travelFromDrag(g.initialTravel,{x:dx,y:dy},g.rail));applyMechanism();updateLocation();}
  positionMarkers();updateUI();
}
function endGesture(cancel=false){
  const g=gesture;if(!g)return;gesture=null;pointerDown=null;
  if(g.owner.hasPointerCapture(g.id))g.owner.releasePointerCapture(g.id);
  if(!g.moved&&!cancel){activateMechanism();updateUI();return;}
  if(level.mechanic==='rotate'){
    const snap=rotationDetent(cancel?g.initialAngle:bridgeAngle);orientation=snap.orientation;mechanismMotion={type:'rotate',from:bridgeAngle,to:snap.angle,time:0,duration:reducedMotion?.1:.32};
  }else mechanismMotion={type:'travel',from:travel,to:cancel?g.initialTravel:travel>=.5?1:0,time:0,duration:reducedMotion?.1:.4};
  tone(392,.2);updateUI();
}
function pointerUp(event){
  if(gesture?.id===event.pointerId){endGesture();return;}
  const down=pointerDown;pointerDown=null;if(!down||down.id!==event.pointerId||Math.hypot(event.clientX-down.x,event.clientY-down.y)>8||mechanismMotion||won||menuOpen)return;
  const hit=pickInteraction(event);if(hit?.kind==='road')walkToAnchor(hit.anchor);else if(hit?.kind==='actor'||walking)stopWalking();
}
for(const [owner,kind]of[[renderer.domElement,null],[$('bridge-control'),'mechanism']]){
  owner.addEventListener('pointerdown',event=>startGesture(event,kind));owner.addEventListener('pointermove',moveGesture);owner.addEventListener('pointerup',pointerUp);
  owner.addEventListener('pointercancel',()=>{if(gesture)endGesture(true);pointerDown=null;});owner.addEventListener('lostpointercapture',()=>{if(gesture?.owner===owner)endGesture(true);});
}
renderer.domElement.addEventListener('pointermove',event=>{if(gesture){renderer.domElement.style.cursor='grabbing';return;}const hit=pickInteraction(event);renderer.domElement.style.cursor=!(mechanismMotion||won||menuOpen)&&hit?(hit.kind==='mechanism'?'grab':'pointer'):'default';});
window.addEventListener('blur',()=>{if(gesture)endGesture(true);pointerDown=null;});
window.addEventListener('resize',()=>{if(gesture)endGesture(true);resize();});loadLevel(levelIndex);let previous=performance.now();
document.addEventListener('visibilitychange',()=>{previous=performance.now();});
renderer.setAnimationLoop(time=>{
  const delta=menuOpen||document.hidden?0:Math.max((time-previous)/1000,0);previous=time;elapsed+=delta;
  if(mechanismMotion){
    const m=mechanismMotion;m.time+=delta;const t=Math.min(m.time/m.duration,1),ease=t*t*(3-2*t);
    if(m.type==='rotate'){
      carryRotation(THREE.MathUtils.lerp(m.from,m.to,ease));
    }else travel=safeMechanismValue(level,architecture,travel,THREE.MathUtils.lerp(m.from,m.to,ease));
    applyMechanism();updateLocation();positionMarkers();if(t===1){if(level.mechanic==='rotate')orientation=rotationDetent(bridgeAngle).orientation;mechanismMotion=null;updateUI();}
  }
  if(walking&&!menuOpen)advanceWalking(delta);
  const up=navigation().segments.find(s=>s.id===location.segment)?.up||new THREE.Vector3(0,1,0);
  const targetPose=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),desiredHeading));
  actor.root.quaternion.slerp(targetPose,Math.min(delta*12,1));actor.pose(elapsed*1.5,!!walking,reducedMotion);
  if(won&&!reducedMotion)architecture.completionRing.scale.setScalar(1+Math.sin(elapsed*2)*.025);renderLayers(renderer,scene,camera);
});
