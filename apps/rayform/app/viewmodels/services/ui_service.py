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

    def _emit_dual_selection(vm, workspace: str) -> None:
        """이중 선택 신호 방출 및 레거시 동기화"""
        # 레거시 단일 선택은 node_1로 동기화
        vm.selected_node1_changed.emit(workspace, vm._selected_node_1, vm._selected_node_1_index)
        vm.selected_node2_changed.emit(workspace, vm._selected_node_2, vm._selected_node_2_index)
        vm.selected_nodes_changed.emit(
            workspace,
            vm._selected_node_1,
            vm._selected_node_1_index,
            vm._selected_node_2,
            vm._selected_node_2_index,
        )

    def handle_node_click(vm, workspace: str, node: Optional[Any], index: int, ctrl_pressed: bool) -> None:
        """클릭 입력을 받아 이중 선택 상태를 관리한다.
        - ctrl 미사용: node_1 = 선택, node_2 = None 초기화
        - ctrl 사용: node_1 유지, node_2 = 선택 (단, node_1과 동일하면 무시)
        - 최대 2개만 유지하며, ctrl로 새로 선택 시 node_2를 교체
        """
        workspace = workspace or ""
        index = index if index >= 0 else -1

        # 작업 공간 설정
        if vm._active_workspace != workspace:
            vm._active_workspace = workspace

        if not ctrl_pressed:
            # 기본 선택: node_1로 지정, node_2는 초기화
            changed = (
                vm._selected_node_1 is not node or vm._selected_node_1_index != index or vm._selected_node_2 is not None
            )
            vm._selected_node_1 = node
            vm._selected_node_1_index = index
            vm._selected_node_2 = None
            vm._selected_node_2_index = -1
            if changed:
                UIService._emit_dual_selection(vm, workspace)
            return

        # ctrl이 눌린 경우: node_2를 갱신. 단, node_1과 같으면 무시
        if vm._selected_node_1_index == index and vm._selected_node_1 is node:
            # 예외 처리: node_1과 동일하면 변경하지 않음
            return
        changed = (vm._selected_node_2 is not node or vm._selected_node_2_index != index)
        vm._selected_node_2 = node
        vm._selected_node_2_index = index
        if changed:
            UIService._emit_dual_selection(vm, workspace)