# pip install pyigl numpy trimesh
import json, math
import numpy as np, math
import igl
import trimesh


def R_zyx(deg):
    rx, ry, rz = [math.radians(v) for v in deg]
    cx,sx = math.cos(rx), math.sin(rx)
    cy,sy = math.cos(ry), math.sin(ry)
    cz,sz = math.cos(rz), math.sin(rz)
    Rx = np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])
    Ry = np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])
    Rz = np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
    return Rz @ Ry @ Rx   # ZYX

def TRS(pos, rot_deg, scale):
    T = np.eye(4); T[:3,3] = np.array(pos, float)
    R = np.eye(4); R[:3,:3] = R_zyx(rot_deg)
    S = np.diag([scale[0], scale[1], scale[2], 1.0])
    return T @ R @ S

def apply_M(V, M):
    Vh = np.c_[V, np.ones((len(V),1))]
    return (M @ Vh.T).T[:, :3]


# ---------- 리프 메셔: 단위 이코스피어 ----------
def make_unit_icosphere(subdiv=4):
    mesh = trimesh.creation.icosphere(subdivisions=subdiv, radius=1.0)
    return np.asarray(mesh.vertices, dtype=np.float64), np.asarray(mesh.faces, dtype=np.int32)

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


def eval_node(node, M_parent=np.eye(4)):
    role = node.get("role", "union")
    gtyp = node["geometry_type"]
    M_here = TRS(node.get("pos",[0,0,0]),
                 node.get("rotation",[0,0,0]),
                 node.get("size",[1,1,1]))
    M = M_parent @ M_here

    if gtyp == "sphere":
        V,F = make_unit_icosphere(subdiv=4)     # 단위구
        V = apply_M(V, M)                       # 부모 누적 변환 적용
        return {"V":V, "F":F, "role":role}

    elif gtyp == "tree":
        ch = node["geometry"]
        acc = eval_node(ch[0], M)
        VA, FA = acc["V"], acc["F"]
        for c in ch[1:]:
            B  = eval_node(c, M)
            op = {"union":"union","intersect":"intersection","subtract":"difference"}[B["role"]]
            VA, FA = boolean(VA, FA, B["V"], B["F"], op)
        return {"V":VA,"F":FA,"role":role}

    else:
        raise ValueError(f"unsupported geometry_type: {gtyp}")


def eval_forest(nodes):  # 최상위가 배열일 경우
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
