from __future__ import annotations

import json
from typing import Callable, Dict, Optional, Any, List, Union
from PySide6.QtCore import Signal, QObject


from models import CGSTree, GeometryNode, GeometryRole, GeometryType, WorkspaceData

class GeometryService():

    def add_primitive_geometry(vm, workspace: str, geometry: str = "sphere") -> int:
        """Add primitive geometry to workspace."""
        workspace_data = vm.ensure_workspace(workspace)
        index = workspace_data.cgs_tree.add_primitive_geometry(geometry)
        vm._notify_workspace_data(workspace, workspace_data)
        return index

    def remove_geometry_node(vm, workspace: str, index: int) -> bool:
        """Remove geometry node from workspace."""
        workspace_data = vm.get_workspace_data(workspace)
        if workspace_data is None:
            return False
        removed = workspace_data.remove_geometry_node(index)
        if removed:
            vm._notify_workspace_data(workspace, workspace_data)
        return removed

    def update_geometry_node(vm, workspace: str, index: int, node: GeometryNode) -> bool:
        """Update geometry node in workspace."""
        workspace_data = vm.get_workspace_data(workspace)
        if workspace_data is None:
            return False
        updated = workspace_data.cgs_tree.update_geometry_node(index, node)
        if updated:
            vm._notify_workspace_data(workspace, workspace_data)
        return updated

    def move_geometry_node(vm, workspace: str, from_index: int, to_index: int) -> bool:
        """Move geometry node in workspace."""
        workspace_data = vm.get_workspace_data(workspace)
        if workspace_data is None:
            return False
        moved = workspace_data.cgs_tree.move_geometry_node(from_index, to_index)
        if moved:
            vm._notify_workspace_data(workspace, workspace_data)
        return moved

    def merge_geometry_nodes(vm, workspace: str, operation: GeometryRole, index1: int, index2: int) -> bool:
        """Merge geometry nodes in workspace."""
        workspace_data = vm.get_workspace_data(workspace)
        if workspace_data is None:
            return False
        merged = workspace_data.cgs_tree.merge_geometry_nodes(operation, index1, index2)
        if merged:
            vm._notify_workspace_data(workspace, workspace_data)
        return merged