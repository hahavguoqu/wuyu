import * as THREE from 'three';

// Exact cuts at ramp boundaries give mating surfaces a flat landing zone.
// Only the six outer faces are generated; no internal faces or extra colliders.
export function opticalBoxGeometry(mesh,spec){
  mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox;
  const axes={x:[bounds.min.x,bounds.max.x],y:[bounds.min.y,bounds.max.y],z:[bounds.min.z,bounds.max.z]};
  for(const ramp of (spec.ramps||[]).flatMap(r=>r.gate?[r,r.gate]:[r]))for(const boundary of [ramp.start,ramp.end]){
    const local=boundary-mesh.position[ramp.axis];
    if(local>bounds.min[ramp.axis]+1e-6&&local<bounds.max[ramp.axis]-1e-6)axes[ramp.axis].push(local);
  }
  for(const key of Object.keys(axes))axes[key]=[...new Set(axes[key])].sort((a,b)=>a-b);
  const faces=[['z','y','x',-1,-1,1],['z','y','x',1,-1,-1],['x','z','y',1,1,1],['x','z','y',1,-1,-1],['x','y','z',1,-1,1],['x','y','z',-1,-1,-1]];
  const positions=[],normals=[],uvs=[],indices=[],groups=[];
  for(const [material,face]of faces.entries()){
    const [u,v,w,ud,vd,side]=face,us=ud>0?axes[u]:axes[u].slice().reverse(),vs=vd>0?axes[v]:axes[v].slice().reverse(),base=positions.length/3,start=indices.length;
    for(let j=0;j<vs.length;j++)for(let i=0;i<us.length;i++){
      const p=new THREE.Vector3(),n=new THREE.Vector3();p[u]=us[i];p[v]=vs[j];p[w]=side>0?bounds.max[w]:bounds.min[w];n[w]=side;
      positions.push(...p.toArray());normals.push(...n.toArray());uvs.push(i/(us.length-1),1-j/(vs.length-1));
    }
    for(let j=0;j<vs.length-1;j++)for(let i=0;i<us.length-1;i++){
      const a=base+j*us.length+i,b=a+us.length,c=b+1,d=a+1;indices.push(a,b,d,b,c,d);
    }
    groups.push({start,count:indices.length-start,materialIndex:material});
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.groups=groups;geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

// Road boxes overlap at corners. Remove faces wholly buried in another box;
// otherwise their end edges can survive the depth mask as a thin bright line.
// Keep partially exposed faces and coplanar exterior surfaces intact.
export function removeBuriedFaces(meshes){
  const solids=meshes.map(mesh=>{
    mesh.updateWorldMatrix(true,false);mesh.geometry.computeBoundingBox();
    return {mesh,bounds:mesh.geometry.boundingBox.clone(),inverse:mesh.matrixWorld.clone().invert()};
  });
  for(const {mesh} of solids){
    const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index,indices=[],groups=[];
    for(const group of geometry.groups){
      const start=indices.length;
      for(let i=group.start;i<group.start+group.count;i+=3){
        const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],vertices=ids.map(id=>new THREE.Vector3().fromBufferAttribute(position,id).applyMatrix4(mesh.matrixWorld));
        const buried=solids.some(other=>{
          if(other.mesh===mesh)return false;
          const local=vertices.map(p=>p.clone().applyMatrix4(other.inverse)),bounds=other.bounds;
          if(!local.every(p=>['x','y','z'].every(axis=>p[axis]>=bounds.min[axis]-1e-6&&p[axis]<=bounds.max[axis]+1e-6)))return false;
          const center=local.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/3);
          return ['x','y','z'].every(axis=>center[axis]>bounds.min[axis]+1e-6&&center[axis]<bounds.max[axis]-1e-6);
        });
        if(!buried)indices.push(...ids);
      }
      if(indices.length>start)groups.push({...group,start,count:indices.length-start});
    }
    geometry.setIndex(indices);geometry.groups=groups;
  }
}
