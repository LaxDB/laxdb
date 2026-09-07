"""Build the first embodiment in US D707770 S, without touching the Mirage assets.

blender --background --python scripts/build-patent-head.py
Control points are transcribed from Figures 2–4; Figures 1, 5, and 6 constrain depth.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_geometry import material, object_mesh, prism, subtract, prepare_bend

PACKAGE = Path(__file__).resolve().parents[1]
SOURCE = PACKAGE/"assets/lacrosse/patent-d707770"
OUT = PACKAGE/"public/models"
trace = json.loads((SOURCE/"trace.json").read_text())
front,side,rear = trace["front"],trace["side"],trace["rear"]
scale = trace["comparison_width_m"]/(2*(max(x for x,_ in front["outer_right"])-front["center_x"]))
height = (front["bottom_y"]-front["top_y"])*scale
side_scale = height/(side["scoop_y"]-side["socket_y"])
rear_scale = height/(rear["bottom_y"]-rear["top_y"])
# These files are never outputs of this builder; verify that they remain byte-identical.
frozen = {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in [OUT/"mirage-head.glb",OUT/"head-study.blend"]}
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
plastic = material("White molded nylon",(.62,.65,.68),.32)


def curve(points,closed=True):
    """Interpolate the drawing's control points; dashed gaps are not physical gaps."""
    points = np.asarray(points,dtype=float)
    result = []
    for i in range(len(points) if closed else len(points)-1):
        p0,p1,p2,p3 = [points[j%len(points) if closed else min(max(j,0),len(points)-1)] for j in (i-1,i,i+1,i+2)]
        for t in np.linspace(0,1,8,endpoint=False):
            result.append((.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3)).tolist())
    if not closed:
        result.append(points[-1].tolist())
    return result


def symmetric(points,center):
    return points+[[2*center-x,y] for x,y in reversed(points[1:-1])]


def front_polygon(points):
    return [((x-front["center_x"])*scale,(front["bottom_y"]-y)*scale) for x,y in curve(points)]


def side_polygon(points):
    # Figure 2 has the SOCKET at the top of its sheet, unlike Figures 3 and 4.
    return [((x-side["shaft_center_x"])*side_scale,(y-side["socket_y"])*side_scale) for x,y in curve(points)]


def ellipse(x,y,rx,ry,angle=0):
    a = math.radians(angle)
    return [(x+rx*math.cos(t)*math.cos(a)-ry*math.sin(t)*math.sin(a),y+rx*math.cos(t)*math.sin(a)+ry*math.sin(t)*math.cos(a)) for t in np.linspace(0,2*math.pi,40,endpoint=False)]


outer = front_polygon(symmetric(front["outer_right"],front["center_x"]))
opening = front_polygon(symmetric(front["opening_right"],front["center_x"]))
width_samples = sorted((z,x) for x,z in outer if x >= 0)
inner_samples = sorted((z,x) for x,z in opening if x >= 0)
leading = sorted(((y-side["socket_y"])*side_scale,(x-side["shaft_center_x"])*side_scale) for x,y in curve(side["leading"],False))
trailing = sorted(((y-side["socket_y"])*side_scale,(x-side["shaft_center_x"])*side_scale) for x,y in curve(side["trailing"],False))


def interpolate(samples,z):
    return float(np.interp(z,[p[0] for p in samples],[p[1] for p in samples]))


def width(z):
    return interpolate(width_samples,z)


def front_y(z):
    return interpolate(leading,z)


def back_y(z):
    return interpolate(trailing,z)


def face_depth(z):
    t = min(max((z/height-.78)/.10,0),1)
    blend = t*t*(3-2*t)
    return .0036*(1-blend)+max(.005,back_y(z)-front_y(z))*blend


front_windows = [front_polygon(points) for points in [front["throat_window_right"],[[2*front["center_x"]-x,y] for x,y in front["throat_window_right"]]]]
face = prism("Figure 3 face and scoop",outer,"Y",0,.01,plastic)
for polygon in [opening,*front_windows]:
    subtract(face,prism("Front opening",polygon,"Y",-.01,.02))
prepare_bend(face)
for vertex in face.data.vertices:
    z = vertex.co.z
    vertex.co.y = front_y(z)+vertex.co.y/.01*face_depth(z)

side_windows = [side_polygon(points) for points in side["windows"]]
# Ellipses are already sampled curves; interpolating them again creates tiny Boolean slivers.
side_slots = [[((xx-side["shaft_center_x"])*side_scale,(yy-side["socket_y"])*side_scale) for xx,yy in ellipse(x,y,9,13,-12 if y > 1050 else 8)] for x,y in side["string_holes"]]
for polygon in side_slots:
    assert min(back_y(z)-y for y,z in polygon) > .0005,"Side slot breaks through the outer rail"
panels = []
for sign in (-1,1):
    outline = side_polygon(side["leading"]+list(reversed(side["trailing"][:-1])))
    panel = prism("Figure 2 sidewall",outline,"X",-.0018,.0018,plastic)
    for polygon in [*side_windows,*side_slots]:
        subtract(panel,prism("Sidewall opening",polygon,"X",-.025,.025))
    prepare_bend(panel)
    for vertex in panel.data.vertices:
        minimum = .0115 if vertex.co.z < .04 else 0
        vertex.co.x = sign*(max(minimum,width(vertex.co.z)-.0018)+vertex.co.x)
    panels.append(panel)

# A single consistent receiver replaces the cut ends of the front/side drawing plates.
for obj in [face,*panels]:
    subtract(obj,prism("Trim receiver join",[(-.1,-.1),(.1,-.1),(.1,.004),(-.1,.004)],"Y",-.1,.1))
floor = min(z for _,z in opening)
bridge_front = front_y(floor)+.002
bridge_back = back_y(floor+.005)-.002
bridge_width = width(floor+.005)-.001


def bridge_z(x,y):
    return floor-.001+.004*(x/bridge_width)**2+.005*(y-bridge_front)/(bridge_back-bridge_front)


nx,ny = 25,17
vertices = []
for layer in (0,1):
    for j in range(ny):
        t = j/(ny-1)
        for i in range(nx):
            u = 2*i/(nx-1)-1
            x = u*bridge_width
            y = bridge_front+(bridge_back-bridge_front)*t-.004*u*u*t
            vertices.append((x,y,bridge_z(x,y)-.004*(1-layer)))
faces = []
for layer in (0,1):
    for j in range(ny-1):
        for i in range(nx-1):
            a = layer*nx*ny+j*nx+i
            faces.append((a,a+1,a+nx+1,a+nx))
boundary = list(range(nx))+[j*nx+nx-1 for j in range(1,ny)]+list(range(nx*ny-2,(ny-1)*nx-1,-1))+[j*nx for j in range(ny-2,0,-1)]
faces += [(a,b,b+nx*ny,a+nx*ny) for a,b in zip(boundary,boundary[1:]+boundary[:1])]
object_mesh("Figures 5–6 throat bridge",vertices,faces,plastic)

vertices = []
for t in np.linspace(0,1,32):
    z = .001+t*(floor-.005)
    half_width = max(.0132,width(max(.004,z)))
    low,high = front_y(z),back_y(z)
    cy,half_depth = (low+high)/2,(high-low)/2
    radius = .0023
    for cx,dy,start in [(half_width-radius,half_depth-radius,0),(-half_width+radius,half_depth-radius,90),(-half_width+radius,-half_depth+radius,180),(half_width-radius,-half_depth+radius,270)]:
        for a in np.linspace(math.radians(start),math.radians(start+90),7):
            x,y = cx+radius*math.cos(a),cy+dy+radius*math.sin(a)
            vertices.append((x,y,z+.006*t**8*(y-low)/(high-low)))
faces = [tuple(range(28)),tuple(range(31*28,32*28))]
for j in range(31):
    for i in range(28):
        a,b = j*28+i,j*28+(i+1)%28
        faces.append((a,b,b+28,a+28))
socket = object_mesh("Figure 6 octagonal shaft receiver",vertices,faces,plastic)
bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=1,depth=.1,location=(0,0,.025),rotation=(0,0,math.pi/8))
bore = bpy.context.object
bore.scale = (.0114,.0142,1)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
subtract(socket,bore)
for polygon in front_windows:
    subtract(socket,prism("Front throat relief",polygon,"Y",-.08,-.007))
subtract(socket,prism("Socket side windows",side_windows[0],"X",-.1,.1))
for points in rear["neck_windows_right"]:
    for sign in (-1,1):
        polygon = [(sign*(x-rear["center_x"])*rear_scale,(rear["bottom_y"]-y)*rear_scale) for x,y in curve(points)]
        subtract(socket,prism("Figure 4 rear throat web",polygon,"Y",.004,.1))

bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = face
bpy.ops.object.join()
head = bpy.context.object
head.name = "Warrior US D707770 S — Figures 1–6"
mod = head.modifiers.new("Fuse molded components","REMESH")
mod.mode,mod.voxel_size = "VOXEL",.00028
bpy.ops.object.modifier_apply(modifier=mod.name)

# Drill through the assembled body. Joining meshes alone does not fuse their volumes.
top_slots = []
for x,y,rx,ry,angle in front["top_holes_right"]:
    for sign in (-1,1):
        polygon = [((sign*(xx-front["center_x"]))*scale,(front["bottom_y"]-yy)*scale) for xx,yy in ellipse(x,y,rx,ry,angle)]
        top_slots.append(polygon)
        subtract(head,prism("Figure 3 oval top-string slot",polygon,"Y",-.1,.1))
bottom_slots = []
for x in (-.018,-.006,.006,.018):
    y = bridge_back-.0045-.004*(x/bridge_width)**2
    bottom_slots.append((x,y))
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,floor))
    cutter = bpy.context.object
    cutter.dimensions = (.0062,.0041,.08)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod = cutter.modifiers.new("Rounded bottom slot","BEVEL")
    mod.width,mod.segments = .0009,5
    bpy.ops.object.modifier_apply(modifier=mod.name)
    cutter.rotation_euler.z = math.atan(-.008*x/bridge_width**2)
    subtract(head,cutter)
mod = head.modifiers.new("Continuous molding","REMESH")
mod.mode,mod.voxel_size,mod.use_smooth_shade = "VOXEL",.00028,True
bpy.ops.object.modifier_apply(modifier=mod.name)
mod = head.modifiers.new("Molded edge fillets","SMOOTH")
mod.factor,mod.iterations = 1,3
bpy.ops.object.modifier_apply(modifier=mod.name)
mod = head.modifiers.new("Browser geometry","DECIMATE")
mod.ratio = .03
bpy.ops.object.modifier_apply(modifier=mod.name)
mod = head.modifiers.new("Smooth molded finish","SUBSURF")
mod.levels = 1
bpy.ops.object.modifier_apply(modifier=mod.name)
for polygon in head.data.polygons:
    polygon.use_smooth = True

# Real geometry checks, not just file-presence checks.
clear_rays = 0
for z in np.linspace(floor+.025,max(z for _,z in opening)-.012,15):
    for fraction in (-.4,0,.4):
        x = interpolate(inner_samples,z)*fraction
        hit,_,_,_ = head.ray_cast(Vector((x,-.15,z)),Vector((0,1,0)))
        assert not hit,f"Unexpected plastic across the aperture at {x}, {z}"
        clear_rays += 1
for polygon in top_slots:
    x,z = np.mean(polygon,axis=0)
    hit,_,_,_ = head.ray_cast(Vector((x,-.1,z)),Vector((0,1,0)))
    assert not hit,"Top-string slot blocked"
for polygon in [*side_windows,*side_slots]:
    y,z = np.mean(polygon,axis=0)
    hit,_,_,_ = head.ray_cast(Vector((-.15,y,z)),Vector((1,0,0)))
    assert not hit,f"Side opening blocked at {y}, {z}"
for polygon in side_slots:
    _,z = np.mean(polygon,axis=0)
    hit,_,_,_ = head.ray_cast(Vector((.15,back_y(z)-.0006,z)),Vector((-1,0,0)))
    assert hit,"Missing plastic behind a side stringing hole"
for x,y in bottom_slots:
    hit,point,_,_ = head.ray_cast(Vector((x,y,floor+.035)),Vector((0,0,-1)))
    assert not hit or point.z < floor-.01,"Bottom-string slot blocked"
hit,point,_,_ = head.ray_cast(Vector((0,0,-.02)),Vector((0,0,1)))
assert hit and point.z > .035,"Shaft entry blocked"
assert .164 < head.dimensions.x < .168,"Head width differs from comparison scale"
bm = bmesh.new()
bm.from_mesh(head.data)
assert all(edge.is_manifold for edge in bm.edges),"Head contains open surface edges"
bm.free()
for path,digest in frozen.items():
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest,f"Existing study changed: {path.name}"

collection = bpy.data.collections.new("Warrior patent D707770 — first embodiment")
bpy.context.scene.collection.children.link(collection)
for previous in list(head.users_collection):
    previous.objects.unlink(head)
collection.objects.link(head)
head["source_patent"] = "US D707770 S, Figures 1–6"
head["scale_note"] = "166 mm width assumed for comparison; patent supplies no dimensions"
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"patent-d707770.blend"),compress=True)
bpy.ops.object.select_all(action="DESELECT")
head.select_set(True)
bpy.context.view_layer.objects.active = head
bpy.ops.export_scene.gltf(filepath=str(OUT/"patent-d707770.glb"),export_format="GLB",use_selection=True,export_cameras=False,export_lights=False)
assert (OUT/"patent-d707770.glb").stat().st_size > 10000
report = {
    "patent":"US D707770 S",
    "figures":[1,2,3,4,5,6],
    "scale_note":"166 mm comparison width, not a patent dimension",
    "width_mm":head.dimensions.x*1000,
    "height_mm":head.dimensions.z*1000,
    "clear_aperture_rays":clear_rays,
    "top_string_slots":len(top_slots),
    "side_string_slots_per_side":len(side_slots),
    "continuous_stringing_rail_checks":len(side_slots),
    "side_windows_per_side":len(side_windows),
    "bottom_string_slots":len(bottom_slots),
    "shaft_entry_open":True,
    "closed_surface":True,
    "mirage_files_unchanged":True,
    "polygons":len(head.data.polygons),
}
(OUT/"patent-d707770-checks.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report),flush=True)
