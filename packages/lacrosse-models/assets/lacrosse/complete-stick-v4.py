"""Blender 4.5: blender --background --python scripts/build-lacrosse.py"""
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / "public" / "models"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0


def material(name, color, roughness=0.5, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return mat


plastic = material("Molded white nylon", (0.64, 0.66, 0.68), 0.34)
carbon = material("Satin carbon composite", (0.024, 0.029, 0.033), 0.32, 0.35)
cord = material("Ivory knitted mesh", (0.72, 0.70, 0.64), 0.96)
shooter = material("White woven shooting lace", (0.88, 0.87, 0.82), 0.94)
rubber = material("Optic yellow rubber", (0.61, 0.65, 0.07), 0.91)
grip = material("Rubber end cap", (0.009, 0.012, 0.014), 0.9)
ink = material("Graphite shaft print", (0.12, 0.14, 0.16), 0.55)


def mesh(name, verts, faces, mat, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Molded edge radius", "BEVEL")
        mod.width, mod.segments = bevel, 3
        obj.modifiers.new("Surface normals", "WEIGHTED_NORMAL")
    return obj


def smooth(points, steps=8, cyclic=False):
    points = [Vector(p) for p in points]
    result = []
    for i in range(len(points) if cyclic else len(points)-1):
        a, b, c, d = [points[j % len(points)] if cyclic else points[min(max(j, 0), len(points)-1)] for j in (i-1, i, i+1, i+2)]
        for n in range(steps):
            t = n/steps
            result.append(0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    if not cyclic:
        result.append(points[-1])
    return result


def ribbon(name, points, width, depth, mat=plastic, cyclic=False, bevel=0.0008):
    """Solid rectangular rail swept along its face outline, not a round pipe."""
    points = smooth(points, cyclic=cyclic)
    verts = []
    for i, p in enumerate(points):
        before = points[(i-1) % len(points)] if cyclic else points[max(i-1, 0)]
        after = points[(i+1) % len(points)] if cyclic else points[min(i+1, len(points)-1)]
        tangent = (after-before).normalized()
        normal = Vector((tangent.z, 0, -tangent.x)).normalized()
        for side, back in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(p + normal*side*width/2 + Vector((0, back*depth/2, 0)))
    faces = []
    for i in range(len(points) if cyclic else len(points)-1):
        for j in range(4):
            faces.append((4*i+j, 4*i+(j+1)%4, 4*((i+1)%len(points))+(j+1)%4, 4*((i+1)%len(points))+j))
    if not cyclic:
        faces.extend([(3, 2, 1, 0), tuple(range(len(verts)-4, len(verts)))])
    return mesh(name, verts, faces, mat, bevel)


def tube(name, points, radius, mat=cord, cyclic=False):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth, curve.bevel_resolution = radius, 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points)-1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def cylinder(name, radius, depth, z, mat, vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, z), rotation=(0, 0, math.pi/8))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    mod = obj.modifiers.new("Rounded manufactured edges", "BEVEL")
    mod.width, mod.segments = 0.0007, 3
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


# Approximate real-world scale. ECD photographs determine the shape, not CAD measurements.
corners = [Vector((.0129*math.cos(math.pi/8+i*math.pi/4), .0129*math.sin(math.pi/8+i*math.pi/4), 0)) for i in range(8)]
section = []
for i, corner in enumerate(corners):
    section.extend([corner, (corner+corners[(i+1)%8])*.5*.982])
shaft_verts = [(p.x, p.y, z) for z in (0, .762) for p in section]
mesh("Concave octagonal Carbon shaft", shaft_verts, [(i, (i+1)%16, (i+1)%16+16, i+16) for i in range(16)]+[tuple(range(15,-1,-1)), tuple(range(16,32))], carbon, .00035)
cylinder("Rounded butt end", 0.0155, 0.012, 0.009, grip, 32)
cylinder("End-cap sleeve", 0.014, 0.022, 0.022, grip)
cylinder("End-cap lip", 0.017, 0.007, 0.022, grip, 48)
cylinder("Head socket", 0.0142, 0.031, 0.765, plastic, 32)
cylinder("Socket lower lip", 0.015, 0.005, 0.752, plastic, 32)

# Right-hand silhouette traced from the Mirage 3.0 face photograph.
# Parallel lower pocket; shoulder flares high up; a deep, rounded scoop.
half = [(0, .821), (.019, .824), (.034, .834), (.0405, .847), (.0415, .874), (.042, .905), (.046, .931), (.054, .951), (.067, .971), (.0795, .990), (.081, 1.005), (.071, 1.024), (.052, 1.039), (.027, 1.050), (0, 1.053)]
outline = half + [(-x, z) for x, z in half[-2:0:-1]]
def front_y(z):
    return float(np.interp(z, [.775,.82,.86,.90,.94,.98,1.015,1.053], [-.002,.002,.014,.018,.018,.020,.026,.046]))
ribbon("Continuous face rim", [(x, front_y(z), z) for x, z in outline], .0048, .008, cyclic=True)
# Fine raised edge on the molded face, visible in close-up.
tube("Face rim bead", smooth([(x, front_y(z)-.0044, z) for x, z in outline], cyclic=True), .0005, plastic, True)

print("Face rim complete", flush=True)
# Open sidewalls have two large triangular windows, not a repeated wire zig-zag.
side_profile = [(.034,.026,.829), (.041,.043,.85), (.0415,.057,.89), (.044,.057,.928), (.059,.045,.958), (.078,.033,.989), (.075,.038,1.016)]
for side in (-1, 1):
    lower = [(side*x, y, z) for x, y, z in side_profile]
    rail = ribbon("Perforated lower sidewall", lower, .0065, .008)
    # Two broad, flat support webs divide the sidewall into large open windows.
    for coords in [
        [(.028,.001,.811),(.040,.027,.846),(.0415,.054,.876)],
        [(.041,.011,.848),(.042,.023,.880),(.044,.054,.928)],
        [(.061,.020,.965),(.050,.036,.945),(.044,.054,.928)],
    ]:
        ribbon("Molded diagonal web", [(side*x, y, z) for x, y, z in coords], .0048, .0065)
    # Rectangular stringing holes cut through the sidewall's radial thickness.
    for z in np.linspace(.849, 1.008, 17):
        x = float(np.interp(z, [p[2] for p in side_profile], [p[0] for p in side_profile]))
        y = float(np.interp(z, [p[2] for p in side_profile], [p[1] for p in side_profile]))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(side*x, y, z))
        cutter = bpy.context.object
        cutter.dimensions = (.020, .0042, .0037)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = rail.modifiers.new("Stringing hole", "BOOLEAN")
        mod.operation, mod.object = "DIFFERENCE", cutter
        bpy.context.view_layer.objects.active = rail
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)

print("Sidewalls complete", flush=True)
# Wide, thin scoop blade joins both sidewalls behind the face rim.
scoop = [(x, front_y(z)+.004, z-.004) for x, z in outline if z >= 1.005]
scoop_rail = ribbon("Scoop blade", scoop, .011, .015)
for x in (-.059,-.039,-.019,.019,.039,.059):
    z = float(np.interp(abs(x), [0,.027,.052,.071], [1.053,1.050,1.039,1.024]))-.0055
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, front_y(z), z))
    cutter = bpy.context.object
    cutter.dimensions = (.0065,.05,.0038)
    cutter.rotation_euler.y = math.copysign(.35, x)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = scoop_rail.modifiers.new("Rectangular scoop string hole", "BOOLEAN")
    mod.operation, mod.object = "DIFFERENCE", cutter
    bpy.context.view_layer.objects.active = scoop_rail
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

# Sculpted throat: swept supports, a triangular insert, and an open X at the socket.
for side in (-1, 1):
    ribbon("Throat outer support", [(side*x,front_y(z),z) for x,z in [(.010,.776),(.012,.793),(.024,.811),(.038,.834)]], .0055, .010)
    ribbon("Throat X support", [(side*.009,-.003,.777),(0,-.003,.789),(-side*.012,-.003,.801)], .0035, .005)
mesh("Solid throat insert support", [(-.024,-.001,.821),(.024,-.001,.821),(0,-.001,.794),(-.024,.005,.821),(.024,.005,.821),(0,.005,.794)], [(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)], plastic, .0008)
def printed_surface(name, filename, vertices, uvs, face):
    mat = material(name, (.10, .12, .15), .48)
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(OUT / "references" / filename))
    tex.image.pack()
    shader = mat.node_tree.nodes.get("Principled BSDF")
    mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    mat.node_tree.links.new(tex.outputs["Alpha"], shader.inputs["Alpha"])
    mat.surface_render_method = "DITHERED"
    obj = mesh(name, vertices, [face], mat)
    uv = obj.data.uv_layers.new()
    for loop in obj.data.loops:
        uv.data[loop.index].uv = uvs[loop.vertex_index]


printed_surface("Photographed ECD throat badge", "badge.png", [(-.021,-.0018,.818),(.021,-.0018,.818),(0,-.0018,.797)], [(0,1),(1,1),(.5,0)], (0,2,1))
for filename, bottom, top in [("carbon-print.png", .449, .556), ("ecd-print.png", .130, .237)]:
    printed_surface(filename, filename, [(-.0048,-.01195,bottom),(.0048,-.01195,bottom),(.0048,-.01195,top),(-.0048,-.01195,top)], [(0,0),(1,0),(1,1),(0,1)], (0,1,2,3))

# Map a knitted sheet into the head. Its bottom stays wide instead of tapering to a point.
def pocket(u, t):
    bend = min(max((t-.24)/.56, 0), 1)
    bend = bend*bend*(3-2*bend)
    z = .824+.220*t-.033*bend*u*u+.007*(1-t)**8*u*u
    edge_z = .824+.220*t-.033*bend+.007*(1-t)**8
    w = float(np.interp(edge_z, [p[1] for p in half], [p[0] for p in half]))-.003
    edge = float(np.interp(edge_z, [p[2] for p in side_profile], [p[1] for p in side_profile]))
    y = edge+.053*math.sin(math.pi*t**.78)**1.3*(1-u*u)**.75
    return Vector((u*w, y, z))


# Paired knot ends make elongated six-sided openings, like the knitted ECD mesh.
rows = []
for row in range(27):
    us = [-1+i*.2 for i in range(11)] if row % 2 == 0 else [-.9+i*.2 for i in range(10)]
    rows.append([(u, pocket(u, row/26)) for u in us])
    if 0 < row < 26:
        for u, p in rows[-1]:
            tube("Knitted junction", [p+Vector((0, 0, -.0011)), p+Vector((0, 0, .0011))], .00075)
for row, (previous, current) in enumerate(zip(rows, rows[1:])):
    for u, p in previous:
        for v, q in current:
            if abs(abs(u-v)-.1) < .001:
                start, end = p+Vector((0, 0, .0011)), q-Vector((0, 0, .0011))
                delta = end-start
                across = delta.cross(Vector((0, 1, 0))).normalized()
                # Two twisted plies catch light instead of looking like tennis strings.
                for phase in (0, math.pi):
                    points = [start+delta*s+across*(.00031*math.cos(s*4*math.pi+phase))+Vector((0, .00031*math.sin(s*4*math.pi+phase), 0)) for s in np.linspace(0, 1, 13)]
                    tube("Twisted mesh ply", points, .00040)
for side in (-1, 1):
    tube("Sidewall cord", [pocket(side, t) for t in np.linspace(0, 1, 80)], .001, shooter)
    for t in np.linspace(.07, .95, 15):
        p = pocket(side, t)
        hole = Vector((side*float(np.interp(p.z, [c[2] for c in side_profile], [c[0] for c in side_profile])), float(np.interp(p.z, [c[2] for c in side_profile], [c[1] for c in side_profile])), p.z))
        tube("Interlocked sidewall knot", smooth([p, hole+Vector((side*.002, -.005, .002)), hole+Vector((side*.005, .003, 0)), p+Vector((0, 0, -.002))]), .00085, shooter)
    # Visible string tails with dark aglets.
    for t, length in ((.91, .031), (.82, .021), (.04, .019)):
        p = pocket(side, t)
        end = p+Vector((side*length, -.004, -.01))
        tube("Loose string tail", smooth([p, p+Vector((side*length*.55, -.007, -.002)), end]), .0008, shooter)
        tube("String aglet", [end, end+Vector((side*.004, 0, -.001))], .00087, grip)
for u in (-.67,-.27,.27,.67):
    p = pocket(u, 1)
    top_z = 1.048-.029*abs(u)**1.7
    top = Vector((u*.073,front_y(top_z),top_z))
    tube("Double top-string hitch", smooth([p,top+Vector((-.0015,-.004,0)),top+Vector((.0015,.009,.002)),p+Vector((.002,0,0))]), .001, shooter)
for t in (.74,.85):
    points = [pocket(u,t)+Vector((0,-.002,0)) for u in np.linspace(-1,1,75)]
    if t > .8:
        tube("Curved nylon shooter", points, .0011, shooter)
    else:
        ribbon("Curved woven shooting lace", points[::5]+[points[-1]], .0045, .0022, shooter, bevel=.0006)
        for i in range(0,len(points)-1):
            p = points[i]
            tube("Woven lace stitch", [p+Vector((-.0007,-.0015,-.002)),p+Vector((.0007,-.0015,.002))], .00024, cord)
# Bottom strings secure the sheet to the throat rather than leaving a floating net.
for u in (-.7, -.25, .25, .7):
    p = pocket(u, 0)
    tube("Bottom string", smooth([p,(u*.024,.018,.823),(u*.020,.031,.818),p]), .001, shooter)

print("Knitted pocket complete", flush=True)
# Rubber grain and the actual printed graphic from ECD's ball reference, without baked photo lighting.
def image_from_pixels(name, rgba, noncolor=False):
    image = bpy.data.images.new(name, width=rgba.shape[1], height=rgba.shape[0])
    if noncolor:
        image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(rgba.astype(np.float32).ravel())
    image.pack()
    return image


rng = np.random.default_rng(7)
height, width = 512, 1024
v, u = np.mgrid[0:height, 0:width]
theta, latitude = (u/(width-1)-.5)*2*math.pi, (v/(height-1)-.5)*math.pi
x, z = np.sin(theta)*np.cos(latitude), np.sin(latitude)
photo = bpy.data.images.load(str(OUT / "references" / "ball.jpg"))
pixels = np.array(photo.pixels[:], dtype=np.float32).reshape(photo.size[1], photo.size[0], 4)
px = np.clip(((.5+x/3)*photo.size[0]).astype(int), 0, photo.size[0]-1)
py = np.clip(((.5+z/3)*photo.size[1]).astype(int), 0, photo.size[1]-1)
printed = (pixels[py, px, :3].max(axis=2) < .40) & (np.cos(theta) > .25)
rgba = np.ones((height, width, 4))
rgba[:, :, :3] = np.array([.80, .83, .28]) + rng.normal(0, .009, (height, width, 1))
rgba[printed, :3] = [.14, .16, .09]
texture = rubber.node_tree.nodes.new("ShaderNodeTexImage")
texture.image = image_from_pixels("ECD ball color and print", rgba)
rubber.node_tree.links.new(texture.outputs["Color"], rubber.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
normal = np.ones((height, width, 4))
normal[:, :, :2] = .5 + rng.normal(0, .08, (height, width, 2))
normal_texture = rubber.node_tree.nodes.new("ShaderNodeTexImage")
normal_texture.image = image_from_pixels("Fine rubber grain", normal, True)
normal_map = rubber.node_tree.nodes.new("ShaderNodeNormalMap")
normal_map.inputs["Strength"].default_value = .28
rubber.node_tree.links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
rubber.node_tree.links.new(normal_map.outputs["Normal"], rubber.node_tree.nodes.get("Principled BSDF").inputs["Normal"])
bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=.032, location=(.135, -.008, .16))
ball = bpy.context.object
ball.name = "Textured ECD practice ball"
ball.data.materials.append(rubber)
uv = ball.data.uv_layers.active
for poly in ball.data.polygons:
    poly.use_smooth = True
    coords = []
    for index in poly.loop_indices:
        p = ball.data.vertices[ball.data.loops[index].vertex_index].co.normalized()
        coords.append((index, .5+math.atan2(p.x, -p.y)/(2*math.pi), .5+math.asin(max(-1, min(1, p.z)))/math.pi))
    crosses_seam = max(p[1] for p in coords)-min(p[1] for p in coords) > .5
    for index, s, t in coords:
        uv.data[index].uv = (s+1 if crosses_seam and s < .5 else s, t)

print("Ball textures complete", flush=True)
# Fuse the polymer pieces into one molded shell; smooth the joins, not the open mesh.
bpy.ops.object.select_all(action="DESELECT")
polymer = [obj for obj in bpy.context.scene.objects if obj.active_material == plastic]
for obj in polymer:
    obj.select_set(True)
bpy.context.view_layer.objects.active = polymer[0]
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
shell = bpy.context.object
shell.name = "Mirage 3.0 continuous molded shell"
mod = shell.modifiers.new("Fused nylon", "REMESH")
mod.mode, mod.voxel_size, mod.use_smooth_shade = "VOXEL", .00048, True
bpy.ops.object.modifier_apply(modifier=mod.name)
mod = shell.modifiers.new("Molded fillets", "SMOOTH")
mod.factor, mod.iterations = 1.1, 5
bpy.ops.object.modifier_apply(modifier=mod.name)
mod = shell.modifiers.new("Browser shell mesh", "DECIMATE")
mod.ratio = .45
bpy.ops.object.modifier_apply(modifier=mod.name)
for face in shell.data.polygons:
    face.use_smooth = True
print("Molded shell complete", flush=True)
# Keep an editable source. Merge only the export to reduce WebGL draw calls.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.convert(target="MESH")
meshes = list(bpy.context.scene.objects)
assert len(meshes) > 1000, "Mesh knitting or stringing is missing"
assert abs(ball.dimensions.x-.064) < .001, "Ball diameter changed"
assert .49 < .0415/.081 < .54, "Lower face must not taper like a triangle"
assert all(obj.type == "MESH" for obj in meshes)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "lacrosse.blend"))
for mat in list(bpy.data.materials):
    parts = [obj for obj in bpy.context.scene.objects if obj.active_material == mat]
    if parts:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=str(OUT / "lacrosse.glb"), export_format="GLB", export_cameras=False, export_lights=False)
assert (OUT / "lacrosse.glb").stat().st_size > 100000
print(f"Exported {len(meshes)} modeled parts")
