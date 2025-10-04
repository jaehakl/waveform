from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Union


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


@dataclass
class GeometryNode:
    """A single node within a CGS tree."""

    role: GeometryRole
    geometry_type: GeometryType
    geometry: Union[str, List['GeometryNode']]
    pos: List[Union[float, str]]
    rotation: List[Union[float, str]]
    size: List[Union[float, str]]
    material: str

    def __post_init__(self) -> None:
        if isinstance(self.geometry, list):
            self.geometry_type = GeometryType.TREE
        else:
            try:
                self.geometry_type = GeometryType(self.geometry)
            except ValueError:
                self.geometry_type = GeometryType.SPHERE


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
        material=data.get("material", "SiO2"),
    )
