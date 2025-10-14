from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Union
import numpy as np, math


class GeometryRole(Enum):
    UNION = "union"
    INTERSECT = "intersect"
    SUBTRACT = "subtract"


class GeometryType(Enum):
    SPHERE = "sphere"
    BOX = "box"
    TORUS = "torus"
    CONE = "cone"
    PARABOLOID = "paraboloid"
    ELLIPSOID = "ellipsoid"
    TREE = "tree"


class GeometryNode:
    """A single node within a CGS tree."""

    role: GeometryRole
    geometry_type: GeometryType
    geometry: Union[str, List['GeometryNode']]
    pos: List[Union[float, str]]
    rotation: List[Union[float, str]]
    size: List[Union[float, str]]
    material: str

    M: np.ndarray = np.eye(4)
    M_inv: np.ndarray = np.eye(4)

    def __init__(self, role, geometry_type, geometry, pos, rotation, size, material):
        self.role = role
        self.geometry_type = geometry_type
        self.geometry = geometry
        self.pos = pos
        self.rotation = rotation
        self.size = size
        self.material = material
        self.M = np.eye(4) # Object-to-World Matrix
        self.M_inv = np.eye(4) # World-to-Object Matrix

    def __post_init__(self) -> None:
        if isinstance(self.geometry, list):
            self.geometry_type = GeometryType.TREE
        else:
            try:
                self.geometry_type = GeometryType(self.geometry)
            except ValueError:
                self.geometry_type = GeometryType.SPHERE

    def eval_M(self, M_parent: np.ndarray=np.eye(4)) -> np.ndarray:
        if self.geometry_type == GeometryType.TREE:
            size = self.size
        else:
            size = [1,1,1]
        M_here = TRS(self.pos, self.rotation, size)
        M = M_parent @ M_here

        if self.geometry_type == GeometryType.TREE:
            ch = self.geometry
            for c in ch:
                M_child = c.eval_M(M)
        self.M = M
        self.M_inv = np.linalg.inv(M)
        return M    

    def obj_to_world(self, V: np.ndarray) -> np.ndarray:
        return apply_M(V, self.M)

    def world_to_obj(self, V: np.ndarray) -> np.ndarray:
        Vh = np.c_[V, np.ones((len(V),1))]
        return (Vh @ self.M_inv.T)[:, :3]
        #return apply_M(V, self.M_inv)

    def obj_to_world_dir(self, V: np.ndarray) -> np.ndarray:
        return apply_M_dir(V, self.M)
    
    def world_to_obj_dir(self, V: np.ndarray) -> np.ndarray:
        M_dir = self.M_inv[:3,:3]
        return (V @ M_dir.T)
        #return apply_M_dir(V, self.M_inv)


def geometry_node_to_dict(node: GeometryNode) -> Dict[str, Any]:
    return {
        "role": node.role.value,
        "geometry_type": node.geometry_type.value,
        "geometry": node.geometry
        if isinstance(node.geometry, str)
        else [geometry_node_to_dict(sub_node) for sub_node in node.geometry],
        "pos": node.pos,
        "rotation": node.rotation,
        "size": node.size,
        "material": node.material,
    }


def geometry_node_from_dict(data: Dict[str, Any]) -> GeometryNode:
    role = GeometryRole(data.get("role", GeometryRole.UNION.value))
    geometry_data = data.get("geometry", GeometryType.BOX.value)
    if isinstance(geometry_data, list):
        geometry = [geometry_node_from_dict(sub_data) for sub_data in geometry_data]
        geometry_type = GeometryType.TREE
    else:
        geometry = geometry_data
        try:
            geometry_type = GeometryType(data.get("geometry_type", geometry_data))
        except ValueError:
            geometry_type = GeometryType.BOX
    return GeometryNode(
        role=role,
        geometry_type=geometry_type,
        geometry=geometry,
        pos=data.get("pos", [0, 0, 0]),
        rotation=data.get("rotation", [0, 0, 0]),
        size=data.get("size", [2, 2, 2]),
        material=data.get("material", "glass"),
    )


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

def apply_M_dir(V, M):
    M_dir = M[:3,:3]
    return (M_dir @ V.T).T
