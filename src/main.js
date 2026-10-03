import * as THREE from 'three';
import {LEVELS,CHAPTER_NAMES,levelPoints,centerAnchor} from './levels.js';
import {buildNavigation,anchorPoint,closestAnchor,planRoute} from './navigation.js';
import {buildArchitecture} from './architecture.js';
import {createTraveller} from './character.js';
import './style.css';
const $=id=>document.getElementById(id),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const palette={stone:'#f4f0dd',trim:'#fff7e4',rose:'#c98d82',control:'#c8786b',roseLight:'#e4b0a0',mint:'#94b6a6',green:'#648d7a',gold:'#c9a365',shadow:'#b2c9b8'};
const materials=Object.fromEntries(Object.entries(palette).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:.9})]));
const glow=new THREE.MeshBasicMaterial({color:'#ffe4a0'}),shared=new Set([...Object.values(materials),glow]);
const scene=new THREE.Scene();scene.fog=new THREE.Fog('#dcebe6',28,70);
const camera=new THREE.OrthographicCamera(-10,10,6,-6,.1,100);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch(error){$('fallback').hidden=false;throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);$('scene').append(renderer.domElement);
scene.add(new THREE.HemisphereLight('#fff8e8','#9ab9ad',2.7));
const sun=new THREE.DirectionalLight('#fff6df',3.1);sun.position.set(-5,12,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.5,far:40});sun.shadow.bias=-.0007;sun.shadow.normalBias=.03;scene.add(sun);
const fill=new THREE.DirectionalLight('#d4e9e5',.75);fill.position.set(8,5,-8);scene.add(fill);
const world=new THREE.Group();scene.add(world);
let levelIndex=0,unlocked=0,level,points,architecture,actor,location={segment:'west-road',t:0};
let orientation=0,travel=0,bridgeAngle=0,viewAngle=Math.PI/4,mechanismMotion=null,viewMotion=null,walking=null;
let won=false,menuOpen=false,hasStarted=false,elapsed=0,desiredHeading=Math.PI/4,completionTimer,soundEnabled=false,audioContext;
const completed=new Set(),soundTimers=new Set();
try{
  const stored=JSON.parse(localStorage.getItem('mist-isles-phase3')||'{}');
  if(Number.isInteger(stored.unlocked))unlocked=THREE.MathUtils.clamp(stored.unlocked,0,LEVELS.length-1);
  if(Number.isInteger(stored.level))levelIndex=THREE.MathUtils.clamp(stored.level,0,unlocked);
  for(const id of stored.completed||[])if(LEVELS.some(l=>l.id===id))completed.add(id);
}catch{}
function saveProgress(){try{localStorage.setItem('mist-isles-phase3',JSON.stringify({unlocked,level:levelIndex,completed:[...completed]}));}catch{}}
function navigation(){return buildNavigation(level,{orientation,travel,bridgeAngle},camera);}
function namedAnchor(name){return name==='start'?{segment:'west-road',t:0}:name==='center'?centerAnchor(level):{segment:'goal-road',t:1};}
function reachable(name){return !!planRoute(navigation(),location,namedAnchor(name));}
function busy(){return !!(walking||mechanismMotion||viewMotion||won||menuOpen);}
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
  const center=centerAnchor(level);$('center-marker').classList.toggle('current',location.segment==='deck'&&Math.abs(location.t-center.t)<.025);
  Object.assign($('game').dataset,{segment:location.segment,position:String(location.t)});
}
function hint(){
  if(won||mechanismMotion||viewMotion)return '';
  if(walking)return '点击道路换方向，或停下';
  if(location.segment==='west-road')return reachable('center')?'点击道路，走上平台':'点击红柱，接回平台';
  if(reachable('goal'))return level.illusion?'沿着相接的路，走向终点':'点击终点，走下平台';
  if(level.orbit&&(level.mechanic==='rotate'?orientation===2:travel===1))return '点击眼睛，转动庭院';
  if(level.mechanic==='rotate')return orientation===0?'点击红柱，旋转桥梁':'再点红柱，接向终点';
  return level.mechanic==='lift'?'点击红柱，升起平台':'点击红柱，移动平台';
}
function updateUI(message){
  const blocked=!!(mechanismMotion||viewMotion||won||menuOpen);
  for(const [id,name]of [['start-marker','start'],['center-marker','center'],['goal-marker','goal']]){$(id).disabled=blocked;$(id).classList.toggle('blocked',!reachable(name));$(id).classList.toggle('active',reachable(name));}
  $('bridge-control').disabled=busy();$('view-control').disabled=busy();$('view-control').hidden=!level.orbit;
  $('bridge-control').classList.toggle('active',location.segment==='deck'&&!won);$('view-control').classList.toggle('active',location.segment==='deck'&&!reachable('goal'));
  $('stop').hidden=!walking;$('move-target').hidden=!walking;if(walking){const p=screenPoint(anchorPoint(navigation(),walking.destination));$('move-target').style.left=p.x+'px';$('move-target').style.top=p.y+'px';}
  $('hint').textContent=message??hint();
  Object.assign($('game').dataset,{level:String(levelIndex+1),orientation:String(orientation),travel:String(travel),view:String(viewAngle),busy:String(busy()),connected:String(navigation().outgoing),menu:String(menuOpen),mechanic:level.mechanic,viewMode:level.orbit?'orbit':'fixed'});
}
const mechanicNames={rotate:'旋转桥梁',slide:'移动平台',lift:'升降平台'};
const iconPaths={rotate:'<path d="M17 8a7 7 0 1 0 2 7M17 3v5h-5"/>',slide:'<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',lift:'<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>'};
function updateLevelMenu(){
  $('chapter-name').textContent=CHAPTER_NAMES[levelIndex]+' · '+level.name;$('level-panel').replaceChildren();$('menu-levels').replaceChildren();$('menu-progress').textContent=completed.size+' / '+LEVELS.length;
  LEVELS.forEach((item,index)=>{
    const label='第'+CHAPTER_NAMES[index]+'关 '+item.name;
    const button=document.createElement('button');button.className='level-option';button.textContent=CHAPTER_NAMES[index]+' · '+item.name;button.disabled=index>unlocked;button.setAttribute('aria-label',label);if(index===levelIndex)button.setAttribute('aria-current','step');button.addEventListener('click',()=>loadLevel(index,true));$('level-panel').append(button);
    const row=document.createElement('button');row.className='menu-level';row.disabled=index>unlocked;row.setAttribute('aria-label',label);if(index===levelIndex)row.setAttribute('aria-current','step');
    const svg=item.orbit?'<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>':iconPaths[item.mechanic];
    row.innerHTML='<span class="level-art" data-art="'+item.variant+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none">'+svg+'</svg></span><span class="level-number">0'+(index+1)+'</span><span class="level-name">'+item.name+'</span><span class="level-status">'+(index>unlocked?'未解锁':completed.has(item.id)?'✓':'')+'</span>';
    row.addEventListener('click',()=>{hasStarted=true;if(index===levelIndex&&!won)closeMenu();else loadLevel(index,true);});$('menu-levels').append(row);
  });
}
function loadLevel(index,focus=false){
  clearTimeout(completionTimer);soundTimers.forEach(clearTimeout);soundTimers.clear();menuOpen=false;$('game-menu').hidden=true;$('completion').hidden=true;$('completion').inert=false;
  for(const selector of ['.topbar','#markers','.controls'])document.querySelector(selector).inert=false;
  for(const id of ['help-panel','level-panel'])$(id).hidden=true;for(const id of ['help','chapters'])$(id).setAttribute('aria-expanded','false');
  levelIndex=THREE.MathUtils.clamp(index,0,unlocked);level=LEVELS[levelIndex];points=levelPoints(level);location={segment:'west-road',t:0};orientation=0;travel=0;bridgeAngle=0;viewAngle=level.initialView;mechanismMotion=null;viewMotion=null;walking=null;won=false;desiredHeading=Math.PI/4;
  clearStage();architecture=buildArchitecture(level,points,materials,glow,activateMechanism,changeView);world.add(architecture.group);actor=createTraveller();world.add(actor.root);actor.root.rotation.y=desiredHeading;applyMechanism();updateLocation();
  $('game').style.background='radial-gradient(ellipse at 50% 30%,'+level.top+' 0,'+level.tint+' 52%,'+level.bottom+' 100%)';scene.fog.color.set(level.tint);
  $('bridge-control').setAttribute('aria-label',mechanicNames[level.mechanic]);$('bridge-control').title=mechanicNames[level.mechanic];$('bridge-control').innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'+iconPaths[level.mechanic]+'</svg>';
  const instructions='点击道路选择落点，点击红柱'+(level.mechanic==='rotate'?'旋转桥梁':level.mechanic==='lift'?'升降平台':'移动平台')+'。'+(level.orbit?'点击眼睛转动视角。':'');
  $('help-copy').textContent=instructions;$('scene').setAttribute('aria-label',instructions);document.title='雾屿 · '+level.name;updateLevelMenu();resize();updateUI();saveProgress();if(focus)$('center-marker').focus({preventScroll:true});
}
function walkTo(name){walkToAnchor(namedAnchor(name));}
function walkToAnchor(destination){
  if(mechanismMotion||viewMotion||won||menuOpen)return;
  const route=planRoute(navigation(),location,destination);if(!route){updateUI(hint());tone(220);return;}
  walking={steps:route,destination:{segment:destination.segment,t:destination.t},index:0,time:0};hasStarted=true;tone(523.25);updateUI();
}
function stopWalking(){if(!walking)return;walking=null;actor.pose(elapsed,false,reducedMotion);updateLocation();updateUI();}
function activateMechanism(direction=1){
  if(busy())return;
  if(level.mechanic==='rotate'){
    mechanismMotion={type:'rotate',from:bridgeAngle,to:bridgeAngle+direction*Math.PI/2,time:0,duration:reducedMotion?.15:.85};orientation=(orientation+direction+4)%4;
  }else mechanismMotion={type:'travel',from:travel,to:travel>.5?0:1,time:0,duration:reducedMotion?.2:level.mechanic==='lift'?1.65:2.1};
  tone(349.23,.5);updateUI();
}
function applyMechanism(){
  if(level.mechanic==='rotate')architecture.mechanism.rotation.y=bridgeAngle;
  else architecture.mechanism.position.lerpVectors(points.near,points.far,travel);
  architecture.mechanism.updateWorldMatrix(true,true);
}
function changeView(){if(busy()||!level.orbit)return;viewMotion={from:viewAngle,to:viewAngle>0?-Math.PI/4:Math.PI/4,time:0,duration:reducedMotion?.2:1.5};tone(440,.7);updateUI();}
function finish(){
  won=true;completed.add(level.id);unlocked=Math.max(unlocked,Math.min(levelIndex+1,LEVELS.length-1));saveProgress();updateLevelMenu();updateUI();tone(659.25,.65);
  for(const [delay,freq]of [[170,783.99],[360,1046.5]]){const timer=setTimeout(()=>{soundTimers.delete(timer);tone(freq,1);},delay);soundTimers.add(timer);}
  completionTimer=setTimeout(()=>{$('complete-title').textContent=levelIndex===LEVELS.length-1?'漫游完成':'抵达';$('next').textContent=levelIndex===LEVELS.length-1?'再出发':'下一关';$('completion').hidden=false;for(const selector of ['.topbar','#markers','.controls'])document.querySelector(selector).inert=true;if(!menuOpen)$('next').focus();},reducedMotion?50:800);
}
function advanceWalking(delta){
  let budget=delta;
  while(walking){
    const step=walking.steps[walking.index];
    if(!step){location={...walking.destination};walking=null;updateLocation();updateUI();if(location.segment==='goal-road'&&location.t>.999)finish();break;}
    if(step.teleport){location={...step.end};walking.index++;walking.time=0;updateLocation();continue;}
    const duration=step.from.distanceTo(step.to)/(reducedMotion?5:1.45),consumed=Math.min(budget,Math.max(0,duration-walking.time));walking.time+=consumed;budget-=consumed;
    const t=duration>0?Math.min(walking.time/duration,1):1;location={segment:step.segment,t:THREE.MathUtils.lerp(step.fromT,step.toT,t)};updateLocation();
    if(step.from.distanceToSquared(step.to)>.00001)desiredHeading=Math.atan2(step.to.x-step.from.x,step.to.z-step.from.z);
    if(t<1)break;walking.index++;walking.time=0;if(budget<=0)break;
  }
}
function screenPoint(point){const p=point.clone().project(camera);return {x:(p.x*.5+.5)*$('game').clientWidth,y:(-.5*p.y+.5)*$('game').clientHeight};}
function applyView(){
  const width=$('game').clientWidth,height=$('game').clientHeight,aspect=width/height;
  const direction=new THREE.Vector3(Math.sin(viewAngle)*Math.sqrt(128),7,Math.cos(viewAngle)*Math.sqrt(128)),target=new THREE.Vector3(0,2,0);
  camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld();
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of architecture.framePoints){const d=p.clone().sub(target),x=d.dot(right),y=d.dot(up);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  target.addScaledVector(right,(minX+maxX)/2).addScaledVector(up,(minY+maxY)/2);
  const availableH=Math.max(.55,(height-(width<600?210:180))/height),availableW=Math.max(.76,(width-60)/width);
  const viewHeight=Math.max((maxY-minY+.75)/availableH,(maxX-minX+.75)/aspect/availableW,7.7);
  camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();
  // Shift the composition slightly below centre to make room for the title on mobile.
  target.addScaledVector(up,-viewHeight*(width<600?.035:.015));camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld();
}
function positionMarkers(){
  const control=architecture.controlInMotion?architecture.controlAnchor.clone().applyMatrix4(architecture.mechanism.matrixWorld):architecture.controlAnchor;
  const anchors=[['start-marker',points.start],['center-marker',anchorPoint(navigation(),centerAnchor(level))],['goal-marker',points.goal],['bridge-control',control]];if(architecture.viewAnchor)anchors.push(['view-control',architecture.viewAnchor]);
  for(const [id,point]of anchors){const p=screenPoint(point.clone().add(new THREE.Vector3(0,.025,0)));$(id).style.left=p.x+'px';$(id).style.top=p.y+'px';}
  if(walking){const p=screenPoint(anchorPoint(navigation(),walking.destination));$('move-target').style.left=p.x+'px';$('move-target').style.top=p.y+'px';}
}
function resize(){if(!architecture)return;renderer.setSize($('game').clientWidth,$('game').clientHeight);applyView();positionMarkers();updateUI();}
function openMenu(){menuOpen=true;$('game-menu').hidden=false;$('completion').inert=true;updateLevelMenu();$('continue').textContent=won?(levelIndex===LEVELS.length-1?'再出发':'下一关'):hasStarted?'继续':'开始';for(const selector of ['.topbar','#markers','.controls'])document.querySelector(selector).inert=true;for(const id of ['help-panel','level-panel'])$(id).hidden=true;for(const id of ['help','chapters'])$(id).setAttribute('aria-expanded','false');updateUI();$('continue').focus();}
function closeMenu(){menuOpen=false;hasStarted=true;$('game-menu').hidden=true;$('completion').inert=false;for(const selector of ['.topbar','#markers','.controls'])document.querySelector(selector).inert=won;updateUI();(won?$('next'):$('menu')).focus({preventScroll:true});}
for(const id of ['menu','complete-menu'])$(id).addEventListener('click',openMenu);$('menu-close').addEventListener('click',closeMenu);$('continue').addEventListener('click',()=>{if(won)loadLevel(levelIndex===LEVELS.length-1?0:levelIndex+1,true);else closeMenu();});
$('stop').addEventListener('click',stopWalking);for(const [id,name]of [['start-marker','start'],['center-marker','center'],['goal-marker','goal']])$(id).addEventListener('click',()=>walkTo(name));
$('bridge-control').addEventListener('click',()=>activateMechanism());$('view-control').addEventListener('click',changeView);$('reset').addEventListener('click',()=>loadLevel(levelIndex));$('again').addEventListener('click',()=>loadLevel(levelIndex,true));$('next').addEventListener('click',()=>loadLevel(levelIndex===LEVELS.length-1?0:levelIndex+1,true));
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
  const hit=raycaster.intersectObjects(world.children,true)[0];if(!hit)return null;
  if(hit.object.userData.roads&&hit.face&&hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y>.5){const anchor=closestAnchor(navigation(),hit.point,hit.object.userData.roads);if(anchor)return ()=>walkToAnchor(anchor);}
  let object=hit.object;while(object){if(object===actor.root)return stopWalking;if(object.userData.activate)return ()=>object.userData.activate();object=object.parent;}return null;
}
let pointerDown;
renderer.domElement.addEventListener('pointerdown',event=>{pointerDown={x:event.clientX,y:event.clientY};});renderer.domElement.addEventListener('pointercancel',()=>{pointerDown=null;});
renderer.domElement.addEventListener('pointerup',event=>{const down=pointerDown;pointerDown=null;if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>8||mechanismMotion||viewMotion||won||menuOpen)return;const action=pickInteraction(event);if(action)action();else if(walking)stopWalking();});
renderer.domElement.addEventListener('pointermove',event=>{renderer.domElement.style.cursor=!(mechanismMotion||viewMotion||won||menuOpen)&&pickInteraction(event)?'pointer':'default';});
window.addEventListener('resize',resize);loadLevel(levelIndex);openMenu();let previous=performance.now();
renderer.setAnimationLoop(time=>{
  const delta=menuOpen?0:Math.max((time-previous)/1000,0);previous=time;elapsed+=delta;
  if(mechanismMotion){
    const m=mechanismMotion;m.time+=delta;const t=Math.min(m.time/m.duration,1),ease=t*t*(3-2*t);
    if(m.type==='rotate'){
      const nextAngle=THREE.MathUtils.lerp(m.from,m.to,ease);
      if(location.segment==='deck'){desiredHeading+=nextAngle-bridgeAngle;actor.root.rotation.y+=nextAngle-bridgeAngle;}
      bridgeAngle=nextAngle;
    }else travel=THREE.MathUtils.lerp(m.from,m.to,ease);
    applyMechanism();updateLocation();positionMarkers();if(t===1){mechanismMotion=null;updateUI();}
  }
  if(viewMotion){const m=viewMotion;m.time+=delta;const t=Math.min(m.time/m.duration,1);viewAngle=THREE.MathUtils.lerp(m.from,m.to,t*t*(3-2*t));applyView();positionMarkers();if(t===1){viewMotion=null;updateUI();}}
  if(walking&&!menuOpen)advanceWalking(delta);
  const angleDelta=Math.atan2(Math.sin(desiredHeading-actor.root.rotation.y),Math.cos(desiredHeading-actor.root.rotation.y));actor.root.rotation.y+=angleDelta*Math.min(delta*12,1);actor.pose(elapsed,!!walking,reducedMotion);
  architecture.portal.position.y=points.goal.y+.8+(reducedMotion?0:Math.sin(elapsed*1.5)*.025);architecture.halo.quaternion.copy(camera.quaternion);if(architecture.moon)architecture.moon.quaternion.copy(camera.quaternion);renderer.render(scene,camera);
});
