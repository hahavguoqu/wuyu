import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {LEVELS,levelPoints} from '../legacy/threejs/src/levels.js';
import {buildArchitecture} from '../legacy/threejs/src/architecture.js';
import {createTraveller} from '../legacy/threejs/src/character.js';

// Share authored geometry and navigation data; Godot runs independently of JS.
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
    layer:mesh.layers.isEnabled(4)?4:mesh.layers.isEnabled(3)?3:mesh.layers.isEnabled(1)?1:0,
    goal:mesh.parent?.userData.emblem==='golden-four-petal',
  };
}
function encodeNode(node){
  return {name:node.name||node.type,position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray(),
    ...(node.isMesh?{mesh:encodeMesh(node)}:{}),children:node.children.filter(n=>!n.userData.background&&n.visible).map(encodeNode)};
}
const output=path.resolve('godot/data');await fs.mkdir(output,{recursive:true});
const manifest=[];
for(const [index,level] of LEVELS.entries()) {
const stage=buildArchitecture(level,levelPoints(level),{},new THREE.MeshBasicMaterial());
stage.group.children[0].name='FixedArchitecture';stage.mechanism.name='Mechanism';stage.knob.name='Crank';stage.seal.name='GoalEmblem';
const actor=createTraveller();actor.root.name='Traveller';actor.root.children[0].name='Body';actor.root.children[1].name='LeftLeg';actor.root.children[2].name='RightLeg';
actor.root.scale.setScalar(.65);
const file=level.id.replaceAll('-','_');
const data={schema:2,source:'legacy/threejs/src/levels.js:'+level.id,level,architecture:encodeNode(stage.group),traveller:encodeNode(actor.root),frame_points:stage.framePoints.map(p=>p.toArray())};
await fs.writeFile(path.join(output,file+'.json'),JSON.stringify(data));
manifest.push({id:level.id,name:level.name,file,index});
stage.group.traverse(n=>{n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:n.material?[n.material]:[])m.dispose();});
}
await fs.writeFile(path.join(output,'levels.json'),JSON.stringify(manifest));
console.log('Exported all four levels: geometry, optical layers, traveller and navigation.');
