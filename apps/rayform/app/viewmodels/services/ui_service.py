from __future__ import annotations

import json
from typing import Callable, Dict, Optional, Any, List, Union
from PySide6.QtCore import Signal, QObject


from models import CGSTree, GeometryNode, GeometryRole, GeometryType, WorkspaceData

class UIService():
    def set_active_workspace(vm, name: str) -> None:
        name = name or ""
        if not vm._set_and_emit("_active_workspace", name, vm.active_workspace_changed):
            return
        # When workspace changes make sure title gets updated downstream
        current_title = vm._active_subwindow_title
        vm._set_and_emit("_active_subwindow_title", current_title, vm.active_subwindow_title_changed)

    def set_active_subwindow_title(vm, title: str) -> None:
        title = title or ""
        vm._set_and_emit("_active_subwindow_title", title, vm.active_subwindow_title_changed)

    def set_selected_node(vm, workspace: str, node: Optional[Any], index: int) -> None:
        """선택된 노드 설정"""
        workspace = workspace or ""
        index = index if index >= 0 else -1
        
        # workspace가 변경되었거나, node가 변경되었거나, index가 변경된 경우에만 업데이트
        if (vm._active_workspace != workspace or 
            vm._selected_node != node or 
            vm._selected_node_index != index):
            
            vm._active_workspace = workspace
            vm._selected_node = node
            vm._selected_node_index = index
            vm.selected_node_changed.emit(workspace, node, index)