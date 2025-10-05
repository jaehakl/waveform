from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Union, List
from .geometry import GeometryNode, GeometryType
from .utils.intersect import intersect_ray_sphere

@dataclass
class Ray:
    origin: List[float] = field(default_factory=list)
    direction: List[float] = field(default_factory=list)
    power: float = 1.0
    wavelength: float = 550.0
    opl: float = 10.0
    nhits: int = 0


#def find_nearest_node(ray: Ray, nodes: List[GeometryNode]) -> GeometryNode:
#    min_distance = float('inf')
#    nearest_node = None
#    for node in nodes:
#        distance = np.linalg.norm(node.pos - ray.origin)
#        if distance < min_distance:
#            min_distance = distance
#            nearest_node = node
#    return nearest_node


def intersect_ray_geometry(
    ray: Ray,
    geometry: GeometryNode,
) -> List[Dict[str, object]]:

    if geometry.geometry_type == GeometryType.SPHERE:
        return intersect_ray_sphere(ray.origin, ray.direction, geometry.size[0])

    return []
