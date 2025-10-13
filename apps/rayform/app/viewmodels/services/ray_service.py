from __future__ import annotations

import json
from turtle import distance
from typing import Callable, Dict, Optional, Any, List, Union
from models import CGSTree, GeometryNode, GeometryRole, GeometryType, WorkspaceData, Ray

class RayService():
    def test_rays(vm, workspace: str) -> None:
        """Test rays in workspace."""
        workspace_data = vm.ensure_workspace(workspace)
        rays_total = []

        geometry = GeometryNode(
            role=GeometryRole.UNION,
            geometry_type=GeometryType.TREE,
            geometry=workspace_data.cgs_tree.nodes,
            pos=[0,0,0],
            rotation=[0,0,0],
            size=[1,1,1],
            material="glass"
        )
        print(geometry.eval_M())

        for i in range(-10,10):
            for j in range(-10,10):
                ray = Ray(origin=[i,j,-5], direction=[0,0,1])
                rays = ray.get_rays(geometry)
                if rays is not None:
                    for ray in rays:
                        rays_total.append(ray)
        workspace_data.set_rays(rays_total)
        vm._notify_workspace_data(workspace, workspace_data)
        vm.rays_changed.emit(workspace, rays_total)


def add_rays_recursive(cgs_tree: CGSTree, rays: List[Ray], max_nhits: int) -> List[Ray]:
    if len(rays) > max_nhits:
        return rays
    if len(rays) == 0:
        return rays
    ray = rays[-1]
    interval = None
    for node in cgs_tree.nodes:
        child_interval = ray.intersection(node)
        if interval is None:
            interval = child_interval
        elif child_interval is not None and child_interval["distance"] < interval["distance"]:
            interval = child_interval
    if interval is None:
        ray.length = 0.0
        return rays
    else:
        if interval["distance"] == float('inf'):
            ray.length = 0.0
        else:
            ray.length = interval["distance"]
        next_ray = ray.next_ray(interval["geometry"])
        rays.append(next_ray)
        return add_rays_recursive(cgs_tree, rays, max_nhits)    
