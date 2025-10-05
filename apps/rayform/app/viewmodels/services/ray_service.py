from __future__ import annotations

import json
from typing import Callable, Dict, Optional, Any, List, Union
from models import CGSTree, GeometryNode, GeometryRole, GeometryType, WorkspaceData, Ray

class RayService():

    def test_rays(vm, workspace: str) -> None:
        """Test rays in workspace."""
        workspace_data = vm.ensure_workspace(workspace)
        rays = []
        for i in range(5):
            for j in range(5):
                ray = Ray(origin=[i,j,-5], direction=[0,0,1])
                rays.append(ray)
        workspace_data.set_rays(rays)
        vm._notify_workspace_data(workspace, workspace_data)
        vm.rays_changed.emit(workspace, rays)
