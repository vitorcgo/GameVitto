"""Attach measured source ground triangles to a local route; standard library."""
from pathlib import Path
import json,sys,hashlib
obj,route_file,output=map(Path,sys.argv[1:4])
route=json.loads(route_file.read_text())
road_names={'fc_road','fc_road_G','fc_road_WhiteLine','fc_road_WhiteLine_G',
 'fc_road_MARIOKART','fc_ColorRoad','fc_RoadOther2','fc_RoadOther2_G',
 'ef_dashboard','ef_glideboard','ef_gravityboard'}
ground_names=road_names|{'fc_concrete_road','fc_RoadOther','fc_PitYuka','fc_grass_Outside','fc_shiba','fc_suna'}
vertices=[];normals=[];faces=[];name=''
for line in obj.open():
 a=line.split()
 if not a:continue
 if a[0]=='v':vertices.append(tuple(map(float,a[1:4])))
 elif a[0]=='vn':normals.append(tuple(map(float,a[1:4])))
 elif a[0]=='o':name=a[1].split('__')[-1]
 elif a[0]=='f' and name in ground_names:
  corners=[tuple(int(v)-1 for v in c.split('/')) for c in a[1:]]
  for k in range(1,len(corners)-1):faces.append((name,[corners[0],corners[k],corners[k+1]]))
p=[];n=[];indices=[];road=[];boost=[];lookup={}
for name,corners in faces:
 road.append(int(name in road_names))
 boost.append(int(name=='ef_dashboard'))
 for vi,_,ni in corners:
  key=(vi,ni)
  if key not in lookup:
   lookup[key]=len(p)//3;p.extend(round((v-o)*route['scale'],7) for v,o in zip(vertices[vi],route['origin']));n.extend(normals[ni])
  indices.append(lookup[key])
route['roadMesh']={'p':p,'n':n,'i':indices,'road':road,'boost':boost}
route['roadMeshSource']={'objSha256':hashlib.sha256(obj.read_bytes()).hexdigest(),'converterSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'groundMaterials':sorted(ground_names),'roadMaterials':sorted(road_names)}
output.parent.mkdir(exist_ok=True,parents=True);output.write_text(json.dumps(route,separators=(',',':')))
print(f'Ground mesh: {len(faces)} triangles, {len(p)//3} vertices, {output.stat().st_size} bytes')
