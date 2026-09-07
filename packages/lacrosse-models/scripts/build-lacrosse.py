"""Build the bare Mirage head and a separate, uniform mesh study in Blender 4.5.

blender --background --python scripts/build-lacrosse.py
The complete stick is frozen in assets/lacrosse/complete-stick-v4.*.
"""
import hashlib
import json
import math
import sys
from collections import Counter, deque
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_geometry import material, object_mesh, prism, subtract, prepare_bend

OUT = Path(__file__).resolve().parents[1] / "public" / "models"
REF = OUT / "references"
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0


plastic = material("White molded nylon", (.62, .65, .68), .32)
yarn = material("Ivory mesh yarn", (.73, .71, .66), .94)
filament = material("Woven fiber highlights", (.84, .82, .77), .96)


def image_pixels(filename):
    image = bpy.data.images.load(str(REF / filename), check_existing=True)
    pixels = np.array(image.pixels[:]).reshape(image.size[1], image.size[0], 4)
    return np.flipud(pixels)


def simplify(points, tolerance=1.3):
    """Ramer-Douglas-Peucker, in source pixels; remove only sub-pixel noise."""
    points = np.asarray(points, dtype=float)
    if len(points) < 3:
        return points.tolist()
    delta = points[-1]-points[0]
    length = float(np.linalg.norm(delta))
    distances = np.linalg.norm(points-points[0], axis=1) if length == 0 else np.abs(delta[0]*(points[:, 1]-points[0, 1])-delta[1]*(points[:, 0]-points[0, 0]))/length
    index = int(np.argmax(distances))
    if distances[index] <= tolerance:
        return [points[0].tolist(), points[-1].tolist()]
    return simplify(points[:index+1], tolerance)[:-1]+simplify(points[index:], tolerance)


def contour(points):
    """Trace row extrema of these single-lobed product silhouettes/openings."""
    spans = {}
    for x, y in points:
        left, right = spans.get(y, (x, x))
        spans[y] = (min(left, x), max(right, x))
    rows = sorted(spans)
    left = simplify([(spans[y][0], y) for y in rows])
    right = simplify([(spans[y][1], y) for y in reversed(rows)])
    result = []
    for p in left+right:
        if not result or result[-1] != p:
            result.append(p)
    if result[-1] == result[0]:
        result.pop()
    return result


def trace(filename):
    pixels = image_pixels(filename)
    solid = pixels[:, :, 3] >= .38
    height, width = solid.shape
    opaque = np.argwhere(solid)
    top, bottom = int(opaque[:, 0].min()), int(opaque[:, 0].max())
    outer = contour([(int(x), int(y)) for y, x in opaque])
    visited = np.zeros(solid.shape, dtype=bool)
    holes = []
    for y, x in np.argwhere(~solid):
        if visited[y, x]:
            continue
        pending = deque([(int(x), int(y))])
        visited[y, x] = True
        region, boundary = [], False
        while pending:
            x, y = pending.popleft()
            region.append((x, y))
            boundary |= x == 0 or y == 0 or x == width-1 or y == height-1
            for xx, yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0 <= xx < width and 0 <= yy < height and not solid[yy, xx] and not visited[yy, xx]:
                    visited[yy, xx] = True
                    pending.append((xx, yy))
        if not boundary and len(region) >= 70:
            holes.append((len(region), contour(region)))
    return pixels, solid, outer, sorted(holes, reverse=True), top, bottom


front_pixels, front_mask, front_outline, front_holes, front_top, front_bottom = trace("mirage-front.png")
_, side_mask, side_outline, side_holes, side_top, side_bottom = trace("mirage-side.png")
assert front_holes[0][0] > 100000, "The face opening was not found"
assert len([area for area, _ in side_holes if area > 1000]) == 5, "Expected four sidewall windows and the socket keyhole"
assert len(side_holes) >= 24, "Stringing holes are missing from the source trace"

# Photo-calibrated proportions, not a claim of manufacturer CAD dimensions.
front_rows = [(y, np.flatnonzero(front_mask[y])) for y in range(front_top, front_bottom+1)]
max_width = max(int(xs[-1]-xs[0]) for _, xs in front_rows)
scale = .166/max_width
head_height = (front_bottom-front_top)*scale
side_scale = head_height/(side_bottom-side_top)
center_x = float(np.median([(xs[0]+xs[-1])/2 for _, xs in front_rows]))
base_rows = np.argwhere(side_mask & (np.indices(side_mask.shape)[0] > side_bottom-20))
side_center = float(np.mean(base_rows[:, 1]))
front_poly = lambda polygon: [((x-center_x)*scale, (front_bottom-y)*scale) for x, y in polygon]
side_poly = lambda polygon: [((x-side_center)*side_scale, (side_bottom-y)*side_scale) for x, y in polygon]
front_z = [(front_bottom-y)*scale for y, _ in reversed(front_rows)]
front_width = [(xs[-1]-xs[0])*scale/2 for _, xs in reversed(front_rows)]
side_rows = [(y, np.flatnonzero(side_mask[y])) for y in range(side_top, side_bottom+1)]
side_z = [(side_bottom-y)*side_scale for y, _ in reversed(side_rows)]
side_leading = [(xs[0]-side_center)*side_scale for _, xs in reversed(side_rows)]
side_trailing = [(xs[-1]-side_center)*side_scale for _, xs in reversed(side_rows)]
# Suppress cutout-edge antialiasing; it must not become ridges in the plastic.
front_width = np.convolve(np.pad(front_width,(3,3),mode="edge"),np.ones(7)/7,mode="valid")
side_leading = np.convolve(np.pad(side_leading,(3,3),mode="edge"),np.ones(7)/7,mode="valid")
side_trailing = np.convolve(np.pad(side_trailing,(3,3),mode="edge"),np.ones(7)/7,mode="valid")


# Fit smooth surfaces through the scoop profile. Row extrema include projected edges
# and slot borders; extruding every change created ridges across the rear surface.
scoop_rows = np.asarray(side_z) > head_height*.82
scoop_front = np.polynomial.Polynomial.fit(np.asarray(side_z)[scoop_rows],side_leading[scoop_rows],2)
scoop_back = np.polynomial.Polynomial.fit(np.asarray(side_z)[scoop_rows],side_trailing[scoop_rows],2)


def scoop_blend(z):
    t = min(max((z/head_height-.80)/.07,0),1)
    return t*t*(3-2*t)


def face_front(z):
    blend = scoop_blend(z)
    return float(np.interp(z,side_z,side_leading))*(1-blend)+float(scoop_front(z))*blend


def face_depth(z):
    blend = scoop_blend(z)
    return .0045*(1-blend)+max(.006,float(scoop_back(z)-scoop_front(z)))*blend


# Trace the complete face plate, including its real throat openings and scoop slots.
face = prism("Mirage face silhouette", front_poly(front_outline), "Y", 0, .01, plastic)
for _, opening in front_holes:
    subtract(face, prism("Face opening cutter", front_poly(opening), "Y", -.01, .02))
# Two shallow relief panels surround three slots each, with a raised center strip.
recess = [(205,195),(209,168),(233,130),(268,104),(305,83),(344,68),(390,56),(415,54),(407,87),(373,92),(342,103),(305,121),(269,144),(242,172),(226,195)]
for points in (recess,[(2*center_x-x,y) for x,y in recess]):
    subtract(face,prism("Shallow top-string recess",front_poly(points),"Y",-.01,.00035))
prepare_bend(face)
for vertex in face.data.vertices:
    z = vertex.co.z
    vertex.co.y = face_front(z)+vertex.co.y/.01*face_depth(z)

# Each sidewall is one solid plate cut from the photographed profile, not separate beams.
panels = []
for side in (-1, 1):
    panel = prism("Mirage sidewall", side_poly(side_outline), "X", -.0023, .0023, plastic)
    for _, opening in side_holes:
        subtract(panel, prism("Sidewall opening cutter", side_poly(opening), "X", -.02, .02))
    prepare_bend(panel)
    for vertex in panel.data.vertices:
        z = vertex.co.z
        x = max(.009, float(np.interp(z, front_z, front_width))-.002)
        vertex.co.x = side*(x+vertex.co.x)
        lo = float(np.interp(z,side_z,side_leading))
        hi = float(np.interp(z,side_z,side_trailing))
        depth_fraction = min(max((vertex.co.y-lo)/max(hi-lo,.001),0),1)
        target = float(scoop_front(z))+(float(scoop_back(z))-float(scoop_front(z)))*depth_fraction
        vertex.co.y += scoop_blend(z)*(target-vertex.co.y)
    panels.append(panel)

# The three photo plates end above one shared receiver rim, not beside a separate circle.
for obj in [face,*panels]:
    subtract(obj,prism("Remove disconnected photo-base edges",[(-.1,-.1),(.1,-.1),(.1,.0055),(-.1,.0055)],"Y",-.1,.1))

# Solid throat bridge, behind the front badge, supporting the ball stop and bottom string.
floor_z = min(z for _,z in front_poly(front_holes[0][1]))
bridge_front = float(np.interp(floor_z,side_z,side_leading))+.003
bridge_back = float(np.interp(floor_z+.004,side_z,side_trailing))
bridge_width = float(np.interp(floor_z+.006,front_z,front_width))


def bridge_height(x,y):
    t = (y-bridge_front)/(bridge_back-bridge_front)
    return floor_z-.003+.006*(x/bridge_width)**2+.006*t


nx,ny = 25,15
vertices = []
for layer in (0,1):
    for j in range(ny):
        t = j/(ny-1)
        for i in range(nx):
            u = 2*i/(nx-1)-1
            x = u*bridge_width*(.95+.05*math.sin(math.pi*t))
            y = bridge_front+(bridge_back-bridge_front)*t-.005*u*u*t
            vertices.append((x,y,bridge_height(x,y)-.004*(1-layer)))
faces = []
for layer in (0,1):
    for j in range(ny-1):
        for i in range(nx-1):
            a = layer*nx*ny+j*nx+i
            faces.append((a,a+1,a+nx+1,a+nx))
boundary = list(range(nx))+[j*nx+nx-1 for j in range(1,ny)]+list(range((ny-1)*nx+nx-2,(ny-1)*nx-1,-1))+[j*nx for j in range(ny-2,0,-1)]
faces += [(a,b,b+nx*ny,a+nx*ny) for a,b in zip(boundary,boundary[1:]+boundary[:1])]
bridge = object_mesh("Throat bridge and bottom-string ledge",vertices,faces,plastic)
# One molded receiver: rounded outer collar, octagonal shaft bore, and closed rear wall.
# Rear screw placement is provisional: available product photos do not expose that face.
vertices = []
ring_size = 28
for t in np.linspace(0,1,32):
    z = .0015+t*(floor_z-.0055)
    profile_z = max(.006,z)
    half_width = max(.0132,float(np.interp(profile_z,front_z,front_width)))
    y_front = float(np.interp(profile_z,side_z,side_leading))
    y_back = float(np.interp(profile_z,side_z,side_trailing))
    cy,half_depth = (y_front+y_back)/2,(y_back-y_front)/2
    radius = .003
    for cx,dy,start in [(half_width-radius,half_depth-radius,0),(-half_width+radius,half_depth-radius,90),(-half_width+radius,-half_depth+radius,180),(half_width-radius,-half_depth+radius,270)]:
        for angle in np.linspace(start,start+90,7):
            a = math.radians(angle)
            x,y = cx+radius*math.cos(a),cy+dy+radius*math.sin(a)
            vertices.append((x,y,z+.006*t**8*(y-y_front)/(y_back-y_front)))
faces = [tuple(range(ring_size)),tuple(range(31*ring_size,32*ring_size))]
for j in range(31):
    for i in range(ring_size):
        a,b = j*ring_size+i,j*ring_size+(i+1)%ring_size
        faces.append((a,b,b+ring_size,a+ring_size))
socket = object_mesh("Continuous throat and shaft receiver",vertices,faces,plastic)
bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=1,depth=.09,location=(0,.002,.025),rotation=(0,0,math.pi/8))
bore = bpy.context.object
bore.scale = (.0123,.0134,1)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
subtract(socket,bore)
# Preserve the accepted front cutouts and lateral keyholes, not an open rear panel.
for _,opening in front_holes:
    polygon = front_poly(opening)
    if max(z for _,z in polygon) < floor_z:
        subtract(socket,prism("Front throat window",polygon,"Y",-.05,-.005))
for _,opening in side_holes:
    polygon = side_poly(opening)
    if max(z for _,z in polygon) < floor_z:
        subtract(socket,prism("Lateral throat keyholes",polygon,"X",-.1,.1))
screw_z = .0195
bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.00165,depth=.035,location=(0,.025,screw_z),rotation=(math.pi/2,0,0))
subtract(socket,bpy.context.object)

# Fuse interfaces into smooth injection-molded fillets; retain all photographed openings.
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = face
bpy.ops.object.join()
shell = bpy.context.object
shell.name = "Mirage 3.0 bare molded head"
# A joined collection still has overlapping solids. Fuse before the through-cuts,
# or Boolean differences can leave internal cap faces blocking the bottom slots.
mod = shell.modifiers.new("Fuse overlaps before drilling","REMESH")
mod.mode,mod.voxel_size = "VOXEL",.00028
bpy.ops.object.modifier_apply(modifier=mod.name)
# Drill through the assembled bridge AND receiver, not just the top deck.
bottom_holes = []
for x in (-.0225,-.0075,.0075,.0225):
    y = bridge_back-.005-.003*(x/bridge_width)**2
    bottom_holes.append((x,y))
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,floor_z))
    cutter = bpy.context.object
    cutter.dimensions = (.006,.0038,.06)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod = cutter.modifiers.new("Rounded string-slot corners","BEVEL")
    mod.width,mod.segments = .001,5
    bpy.ops.object.modifier_apply(modifier=mod.name)
    cutter.rotation_euler.z = math.atan(-.01*x/bridge_width**2)
    subtract(shell,cutter)
mod = shell.modifiers.new("Continuous molded shell", "REMESH")
mod.mode, mod.voxel_size, mod.use_smooth_shade = "VOXEL", .00028, True
bpy.ops.object.modifier_apply(modifier=mod.name)
mod = shell.modifiers.new("Molding fillets", "SMOOTH")
mod.factor, mod.iterations = 1, 3
bpy.ops.object.modifier_apply(modifier=mod.name)
mod = shell.modifiers.new("Web mesh", "DECIMATE")
mod.ratio = .035
bpy.ops.object.modifier_apply(modifier=mod.name)
mod = shell.modifiers.new("Rounded scoop and molding edges", "SUBSURF")
mod.subdivision_type, mod.levels = "CATMULL_CLARK", 1
bpy.ops.object.modifier_apply(modifier=mod.name)
for polygon in shell.data.polygons:
    polygon.use_smooth = True

# Reject stray cap faces inside the real aperture, the failure this study exposed.
opening = front_holes[0][1]
clear_rays = 0
for y in np.linspace(min(p[1] for p in opening)+25,max(p[1] for p in opening)-50,15):
    crossings = []
    for a,b in zip(opening,opening[1:]+opening[:1]):
        if min(a[1],b[1]) <= y < max(a[1],b[1]):
            crossings.append(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]))
    for fraction in (.25,.5,.75):
        x = min(crossings)+(max(crossings)-min(crossings))*fraction
        px,pz = front_poly([(x,y)])[0]
        hit,_,_,_ = shell.ray_cast(Vector((px,-.25,pz)),Vector((0,1,0)))
        assert not hit, f"Unexpected plastic in the aperture at {x:.1f}, {y:.1f}"
        clear_rays += 1

# An interior scoop ray must EXIT solid plastic, not enter a disconnected rear wall.
for source_y in (front_top+20,front_top+35,front_top+50):
    z = (front_bottom-source_y)*scale
    y = face_front(z)+face_depth(z)/2
    hit,_,normal,_ = shell.ray_cast(Vector((0,y,z)),Vector((0,1,0)))
    assert hit and normal.y > .2, "The scoop is hollow or missing its rear surface"
top_slots = [front_poly(points) for _,points in front_holes if min(z for _,z in front_poly(points)) > .8*head_height]
assert len(top_slots) == 6
for polygon in top_slots:
    x,z = np.mean(polygon,axis=0)
    hit,_,_,_ = shell.ray_cast(Vector((x,-.1,z)),Vector((0,1,0)))
    assert not hit, "A top-string slot is blocked"
for source_x in (365,2*center_x-365):
    x,z = front_poly([(source_x,80)])[0]
    hit,point,_,_ = shell.ray_cast(Vector((x,-.1,z)),Vector((0,1,0)))
    assert hit and point.y-face_front(z) > .0003, "Scoop relief is missing"
for x in (-.017,0,.017):
    y = (bridge_front+bridge_back)/2
    hit,point,_,_ = shell.ray_cast(Vector((x,y,floor_z+.04)),Vector((0,0,-1)))
    assert hit and point.z > floor_z-.008, "The ball-stop platform is missing"
for x,y in bottom_holes:
    hit,point,_,_ = shell.ray_cast(Vector((x,y,floor_z+.03)),Vector((0,0,-1)))
    assert not hit or point.z < floor_z-.008, "A bottom-string hole is blocked"

# Regression checks for the rear wall, shaft entry, and scoop ridges reported in v5.
for z in (.014,.023,.032):
    hit,point,_,_ = shell.ray_cast(Vector((0,.1,z)),Vector((0,-1,0)))
    assert hit and point.y > .01, "Rear throat wall is missing"
hit,point,_,_ = shell.ray_cast(Vector((0,.1,screw_z)),Vector((0,-1,0)))
assert not hit or point.y < .007, "Rear screw hole is blocked"
hit,point,_,_ = shell.ray_cast(Vector((0,.002,-.02)),Vector((0,0,1)))
assert hit and point.z > .035, "The shaft entry is capped or has an extra internal ledge"
for angle in np.linspace(0,2*math.pi,16,endpoint=False):
    direction = Vector((math.cos(angle),math.sin(angle),0))
    origin = Vector((0,.002,.0035))
    hit,inner,_,_ = shell.ray_cast(origin,direction)
    assert hit, "Shaft receiver wall is missing"
    hit,outer,normal,_ = shell.ray_cast(inner+direction*.0001,direction)
    assert hit and normal.dot(direction) > .2, "Receiver has overlapping rim surfaces"
    hit,_,_,_ = shell.ray_cast(outer+direction*.0001,direction)
    assert not hit, "Receiver has a second disconnected outer rim"
rear_samples = []
for z in np.linspace(.2575,.2685,23):
    hit,point,_,_ = shell.ray_cast(Vector((0,.15,z)),Vector((0,-1,0)))
    assert hit, "Scoop rear surface is missing"
    rear_samples.append(point.y)
scoop_ripple = float(np.max(np.abs(np.diff(rear_samples,n=2))))
assert scoop_ripple < .00006, f"Scoop rear surface has a ridge: {scoop_ripple*1000:.3f} mm"

# Preserve the actual badge artwork, placed using the same source-photo coordinates.
badge = material("ECD throat insert", (.03,.04,.05), .48)
badge_pixels = front_pixels.copy()
blue = (badge_pixels[:,:,2] > badge_pixels[:,:,0]*1.5) & (badge_pixels[:,:,1] > badge_pixels[:,:,0]*1.5) & (badge_pixels[:,:,2] > .1)
badge_pixels[blue,:3] = [.62,.65,.68]
photo = bpy.data.images.new("White head badge reference",width=front_mask.shape[1],height=front_mask.shape[0])
photo.pixels.foreach_set(np.flipud(badge_pixels).astype(np.float32).ravel())
photo.pack()
tex = badge.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = photo
badge.node_tree.links.new(tex.outputs["Color"], badge.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
coords = [(392,767),(498,767),(446,818)]
vertices = [(x,float(np.interp(z,side_z,side_leading))-.0005,z) for x,z in front_poly(coords)]
label = object_mesh("Photographed ECD badge", vertices, [(0,2,1)], badge)
uv = label.data.uv_layers.new()
for loop in label.data.loops:
    x,y = coords[loop.vertex_index]
    uv.data[loop.index].uv = (x/front_mask.shape[1],1-y/front_mask.shape[0])
# The rectangular ball stop is separate from the triangular front badge.
stop_material = material("Mirage ball stop insert",(.025,.03,.035),.55)
stop_image = bpy.data.images.load(str(REF/"mirage-ball-stop.png"),check_existing=True)
stop_image.pack()
stop_tex = stop_material.node_tree.nodes.new("ShaderNodeTexImage")
stop_tex.image = stop_image
stop_material.node_tree.links.new(stop_tex.outputs["Color"],stop_material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
pad_width = .032
pad_length = (bridge_back-bridge_front)*.58
pad_y = bridge_front+(bridge_back-bridge_front)*.39
radius = .0018
perimeter = []
for cx,cy,start in [(pad_width/2-radius,pad_length/2-radius,0),(-pad_width/2+radius,pad_length/2-radius,90),(-pad_width/2+radius,-pad_length/2+radius,180),(pad_width/2-radius,-pad_length/2+radius,270)]:
    for angle in np.linspace(start,start+90,7):
        a = math.radians(angle)
        perimeter.append((cx+radius*math.cos(a),pad_y+cy+radius*math.sin(a)))
count = len(perimeter)
stop_vertices = [(x,y,bridge_height(x,y)+offset) for offset in (.0001,.0018) for x,y in perimeter]
stop_vertices += [(0,pad_y,bridge_height(0,pad_y)+offset) for offset in (.0001,.0018)]
stop_faces = [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
stop_faces += [(2*count,i,(i+1)%count) for i in range(count)]
stop_faces += [(2*count+1,count+i,count+(i+1)%count) for i in range(count)]
ball_stop = object_mesh("MIRAGE 3.0 ball stop",stop_vertices,stop_faces,stop_material)
stop_uv = ball_stop.data.uv_layers.new()
for loop in ball_stop.data.loops:
    vertex = ball_stop.data.vertices[loop.vertex_index].co
    stop_uv.data[loop.index].uv = (vertex.x/pad_width+.5,(vertex.y-pad_y)/pad_length+.5)
for polygon in ball_stop.data.polygons:
    polygon.use_smooth = True
ball_stop_hash = hashlib.sha256(np.array([v.co[:] for v in ball_stop.data.vertices],dtype=np.float32).tobytes()).hexdigest()
assert ball_stop_hash == "8a2b581a07f6c32dcfe7d162bac5236f215a1e91523aa809b95169738eb54d6a", "The accepted ball stop changed"
head_objects = [shell,label,ball_stop]

# A separate unstrung sheet: every opening is the SAME elongated six-sided polygon.
# Integer micrometers prevent coordinate rounding from creating duplicate shared edges.
W, H, A = 5000, 9000, 2500
cell_shape = [(0,H),(W,A),(W,-A),(0,-H),(-W,-A),(-W,A)]
cells, edges = [], set()
for row in range(21):
    columns = 10 if row % 2 == 0 else 9
    for column in range(columns):
        center = ((2*column-(columns-1))*W, row*(H+A))
        cell = [(x+center[0],z+center[1]) for x,z in cell_shape]
        cells.append(cell)
        for a,b in zip(cell,cell[1:]+cell[:1]):
            edges.add(tuple(sorted((a,b))))

# These checks fail if any row changes the opening shape, scale, or connectivity.
signatures = {tuple((x-cell[0][0],z-cell[0][1]) for x,z in cell) for cell in cells}
assert len(signatures) == 1, "Mesh openings have inconsistent geometry"
assert all(len(set(cell)) == 6 for cell in cells), "Each opening must have six distinct corners"
assert all(max(x for x,_ in cell)-min(x for x,_ in cell) == 2*W for cell in cells)
assert all(max(z for _,z in cell)-min(z for _,z in cell) == 2*H for cell in cells)
valence = Counter(p for edge in edges for p in edge)
assert max(valence.values()) == 3, "Hex mesh junctions must join at most three strands"
assert len(edges) < 6*len(cells), "Neighboring cells must share edges"


def curve_paths(name, paths, radius, mat, resolution):
    curve = bpy.data.curves.new(name,"CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth, curve.bevel_resolution = radius, resolution
    curve.use_fill_caps = True
    for path in paths:
        spline = curve.splines.new("POLY")
        spline.points.add(len(path)-1)
        for p,co in zip(spline.points,path):
            p.co = (*co,1)
    obj = bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


# No row-by-row taper or pocket deformation: verify the material pattern before fitting it.
def mesh_point(p):
    return Vector((p[0]/1e6,0,(p[1]+H)/1e6))

base_paths, fiber_paths = [], []
for a,b in sorted(edges):
    start,end = mesh_point(a),mesh_point(b)
    base_paths.append([start,end])
    delta = end-start
    normal = delta.cross(Vector((0,1,0))).normalized()
    turns = delta.length/.0014
    samples = max(8,math.ceil(turns*4))
    for phase in (0,math.pi):
        path = []
        for i in range(samples+1):
            t = i/samples
            angle = t*turns*2*math.pi+phase
            path.append(start+delta*t+normal*(.00043*math.cos(angle))+Vector((0,.00030*math.sin(angle),0)))
        fiber_paths.append(path)
mesh_core = curve_paths("Uniform hexagonal knit",base_paths,.00048,yarn,2)
mesh_fibers = curve_paths("Fine woven fibers",fiber_paths,.000115,filament,0)
mesh_objects = [mesh_core,mesh_fibers]
for obj in mesh_objects:
    obj.scale.y = .7
    obj.location.x = .23
bpy.ops.object.select_all(action="DESELECT")
for obj in mesh_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_core
bpy.ops.object.convert(target="MESH")
# Refresh references after conversion; Blender keeps the object IDs.
for obj in mesh_objects:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

# Named collections keep the source components separate, too.
for name,objects in [("Bare Mirage head",head_objects),("Uniform mesh sheet",mesh_objects)]:
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    for obj in objects:
        for previous in list(obj.users_collection):
            previous.objects.unlink(obj)
        collection.objects.link(obj)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"head-study.blend"),compress=True)
for filename,objects in [("mirage-head.glb",head_objects),("mirage-mesh.glb",mesh_objects)]:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format="GLB",use_selection=True,export_cameras=False,export_lights=False)
    assert (OUT/filename).stat().st_size > 10000

report = {
    "clear_aperture_rays":clear_rays,
    "solid_scoop_checks":3,
    "scoop_rear_second_difference_mm":scoop_ripple*1000,
    "open_top_string_slots":len(top_slots),
    "front_scoop_recesses":2,
    "rear_throat_wall_checks":3,
    "receiver_single_rim_checks":16,
    "rear_screw_holes":1,
    "rear_screw_placement":"Provisional; rear face not visible in available product photos",
    "ball_stop_geometry_sha256":ball_stop_hash,
    "ball_stop_platform_checks":3,
    "open_bottom_string_holes":len(bottom_holes),
    "front_openings_traced":len(front_holes),
    "side_openings_traced":len(side_holes),
    "hexagonal_cells":len(cells),
    "unique_cell_shapes":len(signatures),
    "cell_width_mm":2*W/1000,
    "cell_height_mm":2*H/1000,
    "unique_shared_edges":len(edges),
    "maximum_junction_valence":max(valence.values()),
    "mesh_state":"Flat material study; not fitted or deformed into the head",
}
(OUT/"head-study-checks.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report),flush=True)
