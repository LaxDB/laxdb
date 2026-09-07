"""Shared mesh operations for the two independent Blender head studies."""
import bmesh
import bpy


def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = (*color, 1)
    return mat


def object_mesh(name, vertices, faces, mat=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    if mat:
        data.materials.append(mat)
    return obj


def prism(name, polygon, axis, low, high, mat=None):
    def position(a, b, depth):
        return (a, depth, b) if axis == "Y" else (depth, a, b)
    count = len(polygon)
    vertices = [position(a, b, d) for d in (low, high) for a, b in polygon]
    faces = [tuple(range(count)), tuple(range(count, 2*count))]
    faces += [(i, (i+1)%count, (i+1)%count+count, i+count) for i in range(count)]
    return object_mesh(name, vertices, faces, mat)


def subtract(obj, cutter):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Photographed opening", "BOOLEAN")
    mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def prepare_bend(obj):
    # Bound physical edge length, rather than subdividing long and short triangles equally.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    # Boolean intersections can leave micrometer-wide slivers that keep regenerating diagonals.
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001)
    for _ in range(10):
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        edges = [edge for edge in bm.edges if edge.calc_length() > .0013]
        if not edges:
            break
        bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True,use_single_edge=True)
    longest = max(edge.calc_length() for edge in bm.edges)
    assert longest < .0014, f"{obj.name}: unsampled edge {longest*1000:.3f} mm"
    bm.to_mesh(obj.data)
    bm.free()
