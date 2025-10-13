from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Union, List
from .geometry import GeometryNode, GeometryType, GeometryRole
import numpy as np

from .ray_geometry.sphere import SphereRay
from .utils.snell_fresnel import snell_fresnel

@dataclass
class Ray:
    origin: List[float] = field(default_factory=list)
    direction: List[float] = field(default_factory=list)
    power: float = 1.0
    wavelength: float = 550.0
    length: float = 10.0
    nhits: int = 0
    material: str = "vacuum"

    def get_intersections(self, geometry: GeometryNode) -> List[Dict[str, object]]:
        if geometry.geometry_type == GeometryType.TREE:
            intersections = []
            for child in geometry.geometry:
                intersections.extend(self.get_intersections(child))
            intersections.sort(key=lambda x: x["distance"])
            return intersections
        elif geometry.geometry_type == GeometryType.SPHERE:
            # geometry.eval_M might be done already
            origin = geometry.world_to_obj(np.array([self.origin]))[0]
            direction = geometry.world_to_obj_dir(np.array([self.direction]))[0]
            intersections = SphereRay.intersect(origin, direction, geometry.size[0])
            if len(intersections) == 2:
                for i in range(2):
                    intersections[i]["geometry"] = geometry
                    intersections[i]["point"] = geometry.obj_to_world(np.array([intersections[i]["point"]]))[0]
                    intersections[i]["normal"] = geometry.obj_to_world_dir(np.array([intersections[i]["normal"]]))[0]
                intersections[0]["incoming"] = True
                intersections[1]["incoming"] = False
            elif len(intersections) == 1:
                intersections[0]["geometry"] = geometry
                intersections[0]["point"] = geometry.obj_to_world(np.array([intersections[0]["point"]]))[0]
                intersections[0]["normal"] = geometry.obj_to_world_dir(np.array([intersections[0]["normal"]]))[0]
                intersections[0]["incoming"] = False
            else:
                intersections = []
        return intersections

    def get_rays(self, geometry: GeometryNode, max_nhits: int = 10) -> List[Ray]:
        intersections = self.get_intersections(geometry)
        if len(intersections) >3:
            print(intersections)
        ray = self
        if len(intersections) > 0:
            distance = intersections[0]["distance"]
            if distance == float('inf'):
                return []
            else:
                ray.length = intersections[0]["distance"]
                rays = [ray]
        else:
            return []
        for i in range(max_nhits):
            ray = next_ray(ray, geometry)
            if ray is None:
                break
            rays.append(ray)
        return rays


RI_DICT = {
    "glass": 1.47,
    "vacuum": 1.0,
    "air": 1.0,
    "water": 1.33,
    "diamond": 2.42,
    "silicon": 3.47,
    "titanium": 2.65,
    "aluminum": 1.44,
    "copper": 1.59,
    "gold": 1.72,
    "silver": 1.60,
    "platinum": 2.21,
    "iridium": 2.26,
}


def next_ray(ray: Ray, geometry: GeometryNode) -> Ray:
    intersections = ray.get_intersections(geometry)
    if len(intersections) == 0:
        return None

    if is_inside_geometry(intersections[0]["point"]-1e-3*np.array(ray.direction), geometry):
        mat_1 = geometry.material
    else:
        mat_1 = "vacuum"

    if is_inside_geometry(intersections[0]["point"] + 1e-3*np.array(ray.direction), geometry):
        mat_2 = geometry.material
    else:
        mat_2 = "vacuum"

    intersection = intersections[0]
    ray.length = intersection["distance"]
    fresnel_result = snell_fresnel(ray.direction, intersection["normal"], RI_DICT[mat_1], RI_DICT[mat_2])

    if fresnel_result["refract_dir"] is not None:
        origin = intersection["point"] + 1e-3*fresnel_result["refract_dir"]
        return Ray(
            origin=origin, 
            direction=fresnel_result["refract_dir"], 
            power=ray.power * fresnel_result["T_unpolarized"],
            wavelength=ray.wavelength,
            nhits=ray.nhits + 1,                
            material=mat_2)
    return None

def is_inside_geometry(point: List[float], geometry: GeometryNode) -> bool:
    point = geometry.world_to_obj(np.array([point]))[0]
    if geometry.geometry_type == GeometryType.TREE:
        is_inside = False
        for child in geometry.geometry:        
            if child.role == GeometryRole.UNION:
                is_inside = is_inside or is_inside_geometry(point, child)
            elif child.role == GeometryRole.INTERSECT:
                is_inside = is_inside and is_inside_geometry(point, child)
            elif child.role == GeometryRole.SUBTRACT:
                is_inside = is_inside and not is_inside_geometry(point, child)
        return is_inside
    elif geometry.geometry_type == GeometryType.SPHERE:
        return SphereRay.is_inside(point, geometry.size[0])
    return False

