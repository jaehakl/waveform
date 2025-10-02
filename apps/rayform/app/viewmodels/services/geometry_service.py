from __future__ import annotations

import json
from typing import Callable, Dict, Optional, Any, List, Union
from PySide6.QtCore import Signal, QObject


from models import CGSTree, GeometryNode, GeometryRole, GeometryType, WorkspaceData

class GeometryService():
    def add_geometry_node(vm, workspace: str, node: GeometryNode) -> int:
        """Add geometry node to workspace."""
        workspace_data = vm.ensure_workspace(workspace)
        index = workspace_data.add_geometry_node(node)
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

    def add_branch_node(vm, workspace: str, parent_index: int, branch_node: GeometryNode) -> Optional[int]:
        """Add branch node to workspace."""
        workspace_data = vm.ensure_workspace(workspace)
        branch_index = workspace_data.cgs_tree.add_branch_node(parent_index, branch_node)
        if branch_index is not None:
            vm._notify_workspace_data(workspace, workspace_data)
        return branch_index

    def create_default_geometry_node(vm) -> GeometryNode:
        """Create default geometry node."""
        return CGSTree.create_default_geometry_node()

    def create_branch_geometry_node(vm) -> GeometryNode:
        """Create branch geometry node."""
        return CGSTree.create_branch_geometry_node()

    def find_node_index(vm, workspace: str, node: GeometryNode) -> int:
        """Find node index in workspace."""
        workspace_data = vm.get_workspace_data(workspace)
        if workspace_data is None:
            return -1
        return workspace_data.cgs_tree.find_node_index(node)    
