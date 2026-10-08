import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {LEVELS,levelPoints} from '../src/levels.js';
import {buildArchitecture} from '../src/architecture.js';
import {createTraveller} from '../src/character.js';

// Share authored geometry and navigation data; Godot runs independently of JS.
const level=LEVELS.find(l=>l.id==='blue-gate');
const stage=buildArchitecture(level,levelPoints(level),{},new THREE.MeshBasicMaterial());
function encodeMesh(mesh){
  const geometry=mesh.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal;
  const indices=geometry.index?Array.from(geometry.index.array):Array.from({length:position.count},(_,i)=>i);
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  return {
    vertices:Array.from(position.array),normals:Array.from(normal.array),indices,
    palette:materials.length===6?[2,0,4].map(i=>'#'+materials[i].color.getHexString()):Array(3).fill('#'+materials[0].color.getHexString()),
    face_shading:materials.length===6,
    collider:mesh.userData.structure?{min:(mesh.userData.solidBounds||geometry.boundingBox).min.toArray(),max:(mesh.userData.solidBounds||geometry.boundingBox).max.toArray()}:null,
    roads:mesh.userData.roads||[],part:mesh.userData.opticalPart||'',
    self_part:mesh.userData.opticalSelfGroup?.part||'',control:!!mesh.userData.control,
  };
}
function encodeNode(node){
  return {name:node.name||node.type,position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray(),
    ...(node.isMesh?{mesh:encodeMesh(node)}:{}),children:node.children.filter(n=>!n.userData.background&&n.visible).map(encodeNode)};
}
const output=path.resolve('godot/data');await fs.mkdir(output,{recursive:true});
stage.group.children[0].name='FixedArchitecture';stage.mechanism.name='Mechanism';stage.knob.name='Crank';stage.seal.name='GoalEmblem';
const actor=createTraveller();actor.root.name='Traveller';actor.root.children[0].name='Body';actor.root.children[1].name='LeftLeg';actor.root.children[2].name='RightLeg';
const data={schema:1,source:'src/levels.js:blue-gate',level,architecture:encodeNode(stage.group),traveller:encodeNode(actor.root),frame_points:stage.framePoints.map(p=>p.toArray())};
await fs.writeFile(path.join(output,'blue_gate.json'),JSON.stringify(data));
console.log('Exported blue gate geometry, optical groups, traveller and navigation to godot/data/blue_gate.json');
