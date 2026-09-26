/** Study pose in the imported model's observed Y-up world coordinates. */
export function seatMario(root, THREE) {
  const bone=name=>root.getObjectByName(name), world=o=>o.getWorldPosition(new THREE.Vector3());
  const aim=(name,childName,target)=>{
    root.updateMatrixWorld(true);
    const joint=bone(name),child=bone(childName),origin=world(joint);
    const delta=new THREE.Quaternion().setFromUnitVectors(world(child).sub(origin).normalize(),new THREE.Vector3(...target).sub(origin).normalize());
    const worldRotation=joint.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta);
    joint.quaternion.copy(joint.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldRotation));
    root.updateMatrixWorld(true);
  };
  for(const side of ['L','R']) {
    const x=side==='L'?1:-1;
    const foot=bone(`Foot${side}_1`),footWorld=foot.getWorldQuaternion(new THREE.Quaternion());
    aim(`Leg${side}_1`,`Knee${side}_1`,[x*1.3,5.1,2.05]);
    aim(`Knee${side}_1`,`Foot${side}_1`,[x*1.3,3.65,2.9]);
    foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(footWorld));
    aim(`Arm${side}_1`,`Elbow${side}_1`,[x*2.6,7.0,.2]);
    aim(`Elbow${side}_1`,`Hand${side}_1`,[x*2.2,6.0,1.7]);
    aim(`Hand${side}_1`,`Finger1${side}_1`,[x*1.75,7.15,3.8]);
    aim(`Finger1${side}_1`,`Finger2${side}_1`,[x*1.75,6.5,3.7]);
  }
  root.updateMatrixWorld(true);
  root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
}
