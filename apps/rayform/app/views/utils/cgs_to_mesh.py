# pip install pyigl numpy trimesh
import json, math
from typing import List
import numpy as np, math
import igl
import trimesh
from .make_trimesh import create_shape
from models.geometry import GeometryNode



# ---------- 불리언 ----------
def boolean(VA: np.ndarray, FA: np.ndarray, VB: np.ndarray, FB: np.ndarray, op: str):
    """
    op in {"union","intersection","difference"}
    """
    ma = trimesh.Trimesh(VA, FA, process=False)
    mb = trimesh.Trimesh(VB, FB, process=False)

    if op == "union":
        mc = trimesh.boolean.union([ma, mb], engine="manifold")
    elif op == "intersection":
        mc = trimesh.boolean.intersection([ma, mb], engine="manifold")
    elif op == "difference":
        mc = trimesh.boolean.difference([ma, mb], engine="manifold")
    else:
        raise ValueError(f"unknown op: {op}")

    return np.asarray(mc.vertices, dtype=np.float64), np.asarray(mc.faces, dtype=np.int32)


def eval_node(node: GeometryNode):
    role = node.role.value
    gtyp = node.geometry_type.value

    if gtyp == "tree":
        ch = node.geometry
        acc = eval_node(ch[0])
        VA, FA = acc["V"], acc["F"]
        for c in ch[1:]:
            B  = eval_node(c)
            op = {"union":"union","intersect":"intersection","subtract":"difference"}[B["role"]]
            VA, FA = boolean(VA, FA, B["V"], B["F"], op)
        return {"V":VA,"F":FA,"role":role}
    else:
        V, F = create_shape(gtyp, node.size)
        V = node.obj_to_world(V)
        return {"V":V, "F":F, "role":role}


def eval_forest(nodes: List[GeometryNode]):  # 최상위가 배열일 경우
    assert len(nodes)>=1
    acc = eval_node(nodes[0])
    VA, FA = acc["V"], acc["F"]
    for nd in nodes[1:]:
        B = eval_node(nd)
        op = {"union":"union", "intersect":"intersection", "subtract":"difference"}[B["role"]]
        VA, FA = boolean(VA, FA, B["V"], B["F"], op)
    return VA, FA

# ---------- 후처리(선택) ----------
def clean_weld(V, F, eps=1e-6):
    # 중복 정점 용접
    mesh = trimesh.Trimesh(V, F, process=False)
    mesh.merge_vertices(eps)        # weld
    mesh.remove_degenerate_faces()
    mesh.remove_unreferenced_vertices()
    mesh.fix_normals()
    return np.asarray(mesh.vertices), np.asarray(mesh.faces)

# ---------- 실행 ----------
if __name__ == "__main__":
    data = json.loads(open("csg.json").read())
    V, F = eval_forest(data)
    V, F = clean_weld(V, F)
    igl.write_obj("csg_baked.obj", V, F)
    print("Exported: csg_baked.obj")
