"""Build original smooth sculptures into local-only GLBs. Y-up numeric space."""
import bpy,sys,os,math
from mathutils import Euler, Vector
from mathutils.bvhtree import BVHTree
folder=sys.argv[sys.argv.index('--')+1]
import json
specs=json.load(open(os.path.join(folder,'pack-spec.json')))
def material(color,metal=False):
    name=color+str(metal)
    if name in bpy.data.materials:return bpy.data.materials[name]
    m=bpy.data.materials.new(name)
    def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
    m.diffuse_color=tuple(linear(int(color[i:i+2],16)/255) for i in (1,3,5))+(1,)
    m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=.32 if metal else .48;p.inputs['Metallic'].default_value=.6 if metal else .05
    vertex=m.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color'
    m.node_tree.links.new(vertex.outputs['Color'],p.inputs['Base Color'])
    return m
for spec in specs:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for part in spec['parts']:
        shape=part['shape'];p=part['p'];s=part['s'];rot=part['rotation'];name=part['name']
        if shape=='wheel':
            bpy.ops.object.empty_add();parent=bpy.context.object;parent.name=name;parent.location=p
            profile=[(-.5,.63),(-.54,.78),(-.46,.94),(-.28,1),(.28,1),(.46,.94),(.54,.78),(.5,.63)]
            verts=[];faces=[];segments=48
            for axial,radius in profile:
                for j in range(segments):
                    angle=j*math.tau/segments;verts.append((axial*s[1],radius*s[0]*math.cos(angle),radius*s[0]*math.sin(angle)))
            for i in range(len(profile)):
                for j in range(segments):faces.append((i*segments+j,i*segments+(j+1)%segments,((i+1)%len(profile))*segments+(j+1)%segments,((i+1)%len(profile))*segments+j))
            faces=[tuple(reversed(face)) for face in faces]
            data=bpy.data.meshes.new(name+'-rounded-rubber');data.from_pydata(verts,[],faces);data.update()
            ob=bpy.data.objects.new(name+'-tire',data);bpy.context.collection.objects.link(ob);ob.parent=parent;ob.data.materials.append(material('#111820'))
            for face in data.polygons:face.use_smooth=True
            for side in (-1,1):
                bpy.ops.mesh.primitive_torus_add(major_radius=s[0]*.62,minor_radius=.034,major_segments=40,minor_segments=8)
                ob=bpy.context.object;ob.name=name+'-rim';ob.parent=parent;ob.location=(side*s[1]*.49,0,0);ob.rotation_euler[1]=math.pi/2;ob.data.materials.append(material('#e5b52c',True))
                for n,r,depth,col,x in [('hub',s[0]*.5,.025,'#242c34',.47),('hub-center',.076,.04,'#a7b1b9',.53)]:
                    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=depth);ob=bpy.context.object;ob.name=name+'-'+n;ob.parent=parent;ob.location=(side*s[1]*x,0,0);ob.rotation_euler[1]=math.pi/2;ob.data.materials.append(material(col,True))
                for j in range(5):
                    angle=j*math.tau/5;bpy.ops.mesh.primitive_cube_add(size=1);ob=bpy.context.object;ob.name=name+'-rim-spoke';ob.parent=parent;ob.location=(side*s[1]*.51,math.cos(angle)*.13,math.sin(angle)*.13);ob.scale=(.03,.23,.07);ob.rotation_euler[0]=angle;ob.data.materials.append(material('#ddb030',True));bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bevel=ob.modifiers.new('machined-edge','BEVEL');bevel.width=.012;bevel.segments=2
                for radius,axial in ((.79,.535),(.91,.42)):
                    bpy.ops.mesh.primitive_torus_add(major_radius=s[0]*radius,minor_radius=.0055,major_segments=48,minor_segments=5);ob=bpy.context.object;ob.name=name+'-tire-bead';ob.parent=parent;ob.location=(side*s[1]*axial,0,0);ob.rotation_euler[1]=math.pi/2;ob.data.materials.append(material('#37414a'))
            continue
        if shape=='sphere':bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=1)
        elif shape=='box':bpy.ops.mesh.primitive_cube_add(size=1)
        elif shape in ('cylinder','cone'):
            bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=1,radius2=1 if shape=='cylinder' else 0,depth=1)
            ob=bpy.context.object
            # Primitive Z axis -> desired Y axis, baked before per-part rotation.
            ob.rotation_euler[0]=math.pi/2;bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
        elif shape=='torus':bpy.ops.mesh.primitive_torus_add(major_radius=1,minor_radius=.105,major_segments=32,minor_segments=8)
        elif shape=='text':
            bpy.ops.object.text_add();ob=bpy.context.object;ob.data.body=part['text'];ob.data.align_x='CENTER';ob.data.align_y='CENTER';ob.data.extrude=.02
        else:continue
        ob=bpy.context.object;ob.name=name;ob.location=p;ob.scale=s;ob.rotation_euler=rot
        ob.data.materials.append(material(part['color'],'frame' in name or 'exhaust' in name))
        if shape!='text':
            if shape=='box':
                bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
                bevel=ob.modifiers.new('sculpted-corners','BEVEL');bevel.width=.08;bevel.segments=3
                ob.modifiers.new('weighted-normals','WEIGHTED_NORMAL')
            for face in ob.data.polygons:face.use_smooth=True
    # Bake soft self-occlusion into vertex color. Short hemisphere rays see the
    # real overlapping sculpture, so cap/neck, overalls, engine and wheel wells
    # retain contact depth under broad stadium lighting without an extra pass.
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in list(bpy.context.scene.objects):
        if obj.type not in ('MESH','FONT'):continue
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        bpy.ops.object.convert(target='MESH');obj.select_set(False)
    # Fuse touching organic volumes before shading. Separate intersecting balls
    # otherwise leave black seams at shoulders, nape and the overalls waistband.
    # Mechanical parts and wheel pivots never enter this operation.
    import re
    organic={}
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH' or obj.parent or not obj.data.materials:continue
        n=obj.name
        region=('shirt' if re.match(r'^(torso|arm)',n) else
                'skin' if re.match(r'^(head$|neck$|ear[+-]?[0-9]|nose-face)',n) else
                'hair' if re.match(r'^hair($|-lock)',n) else
                'mustache' if n.startswith('mustache') else
                'overalls' if re.match(r'^(overalls|back-strap|strap)',n) else None)
        if region:organic.setdefault((region,obj.data.materials[0].name),[]).append(obj)
    for (region,_),objects in organic.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join();obj=bpy.context.object;obj.name='organic-'+region
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        remesh=obj.modifiers.new('continuous-sculpture','REMESH');remesh.mode='VOXEL'
        remesh.voxel_size=.022;remesh.use_smooth_shade=True
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        smooth=obj.modifiers.new('soft-transitions','SMOOTH');smooth.factor=.7;smooth.iterations=4
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        decimate=obj.modifiers.new('sculpt-budget','DECIMATE');decimate.ratio=.6
        bpy.ops.object.modifier_apply(modifier=decimate.name)
        for face in obj.data.polygons:face.use_smooth=True
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    bpy.context.view_layer.update()
    vertices=[];polygons=[]
    for obj in meshes:
        offset=len(vertices);vertices.extend([obj.matrix_world @ v.co for v in obj.data.vertices])
        polygons.extend([tuple(offset+i for i in poly.vertices) for poly in obj.data.polygons])
    tree=BVHTree.FromPolygons(vertices,polygons)
    for obj in meshes:
        values=[];normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
        for v in obj.data.vertices:
            normal=(normal_matrix @ v.normal).normalized();origin=obj.matrix_world @ v.co+normal*.012
            tangent=normal.cross(Vector((0,1,0)) if abs(normal.y)<.9 else Vector((1,0,0))).normalized();bitangent=normal.cross(tangent)
            blocked=0
            for ray in range(12):
                u=(ray+.5)/12;phi=ray*2.39996323
                direction=(tangent*math.cos(phi)*math.sqrt(u)+bitangent*math.sin(phi)*math.sqrt(u)+normal*math.sqrt(1-u)).normalized()
                hit,_,_,dist=tree.ray_cast(origin,direction,1.1)
                if hit is not None:blocked+=max(0,1-dist/1.1)
            value=max(.38,1-blocked/12*.72);values.append(value)
        col=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for loop in obj.data.loops:
            v=values[loop.vertex_index];base=obj.data.materials[0].diffuse_color
            col.data[loop.index].color=(v*base[0],v*base[1],v*base[2],1)
    bpy.ops.export_scene.gltf(filepath=os.path.join(folder,spec['id']+'.glb'),export_format='GLB',export_yup=False,export_apply=True)
    print('Built',spec['id'])
