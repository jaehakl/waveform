from __future__ import annotations

import json
from typing import Callable, Dict, Optional, Any, List, Union
from PySide6.QtCore import Signal, QObject


from models import CGSTree, GeometryNode, GeometryRole, GeometryType, WorkspaceData

class ParametersService():
    def update_parameters(vm, workspace: str, parameters: Dict[str, object]) -> None:
        """Update parameters for workspace."""
        workspace_data = vm.ensure_workspace(workspace)
        workspace_data.parameters = dict(parameters)
        vm._notify_workspace_data(workspace, workspace_data)

    def update_materials(vm, workspace: str, materials: Dict[str, Dict[float, complex]]) -> None:
        """Update materials for workspace."""
        workspace_data = vm.ensure_workspace(workspace)
        workspace_data.materials = {
            material_id: dict(wavelength_data)
            for material_id, wavelength_data in materials.items()
        }
        vm._notify_workspace_data(workspace, workspace_data)

    def update_material(vm, workspace: str, material_id: str, wavelength_data: Dict[float, complex]) -> None:
        """Update single material for workspace."""
        workspace_data = vm.ensure_workspace(workspace)
        workspace_data.update_material(material_id, wavelength_data)
        vm._notify_workspace_data(workspace, workspace_data)

    def remove_material(vm, workspace: str, material_id: str) -> None:
        """Remove material from workspace."""
        workspace_data = vm.get_workspace_data(workspace)
        if workspace_data is None:
            return
        workspace_data.remove_material(material_id)
        vm._notify_workspace_data(workspace, workspace_data)

    def replace_cgs_tree(vm, workspace: str, nodes: List[GeometryNode]) -> None:
        """Replace CGS tree for workspace."""
        workspace_data = vm.ensure_workspace(workspace)
        workspace_data.cgs_tree.replace(nodes)
        vm._notify_workspace_data(workspace, workspace_data)
