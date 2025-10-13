from __future__ import annotations

from typing import Optional
from PySide6.QtCore import Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QToolBar
from models import GeometryRole


class ToolBar:
    """툴바 관리 클래스"""

    def __init__(self, main_window, app_vm):
        self._main_window = main_window
        self._app_vm = app_vm
        self._tool_bar: Optional[QToolBar] = None
        self._new_doc_action: Optional[QAction] = None
        self._save_action: Optional[QAction] = None
        self._load_action: Optional[QAction] = None
        self._tile_action: Optional[QAction] = None
        self._cascade_action: Optional[QAction] = None
        self._union_action: Optional[QAction] = None
        self._intersect_action: Optional[QAction] = None
        self._subtract_action: Optional[QAction] = None
        self._test_rays_action: Optional[QAction] = None
        self.create_tool_bar()

    def create_tool_bar(self) -> QToolBar:
        """툴바 생성"""
        self._tool_bar = QToolBar("Main", self._main_window)
        self._tool_bar.setMovable(True)
        
        # 액션들 생성
        self._create_actions()
        
        # 액션들을 툴바에 추가
        self._add_actions_to_toolbar()
        self._main_window.addToolBar(Qt.TopToolBarArea, self._tool_bar)
        
        return self._tool_bar

    def _create_actions(self) -> None:
        """툴바 액션들 생성"""

        # 저장 액션
        self._save_action = QAction("Save CGS Data", self._main_window)
        self._save_action.setShortcut("Ctrl+S")
        self._save_action.setToolTip("Save CGS data (Ctrl+S)")
        self._save_action.triggered.connect(self._on_save_cgs_data)

        # 로드 액션
        self._load_action = QAction("Load CGS Data", self._main_window)
        self._load_action.setShortcut("Ctrl+O")
        self._load_action.setToolTip("Load CGS data (Ctrl+O)")
        self._load_action.triggered.connect(self._on_load_cgs_data)

        # 타일 액션
        self._tile_action = QAction("Tile Windows", self._main_window)
        self._tile_action.setToolTip("Tile active workspace windows")
        self._tile_action.triggered.connect(self._on_tile_mdi)

        # 캐스케이드 액션
        self._cascade_action = QAction("Cascade Windows", self._main_window)
        self._cascade_action.setToolTip("Cascade active workspace windows")
        self._cascade_action.triggered.connect(self._on_cascade_mdi)

        # CGS 연산 액션들
        self._union_action = QAction("Union", self._main_window)
        self._union_action.setToolTip("Merge selected nodes with UNION")
        self._union_action.triggered.connect(lambda: self._on_merge_geometry(GeometryRole.UNION))

        self._intersect_action = QAction("Intersect", self._main_window)
        self._intersect_action.setToolTip("Merge selected nodes with INTERSECT")
        self._intersect_action.triggered.connect(lambda: self._on_merge_geometry(GeometryRole.INTERSECT))

        self._subtract_action = QAction("Subtract", self._main_window)
        self._subtract_action.setToolTip("Merge selected nodes with SUBTRACT")
        self._subtract_action.triggered.connect(lambda: self._on_merge_geometry(GeometryRole.SUBTRACT))

        # Test Rays 액션
        self._test_rays_action = QAction("Test Rays", self._main_window)
        self._test_rays_action.setToolTip("Test ray tracing for current workspace")
        self._test_rays_action.triggered.connect(self._on_test_rays)

        # 선택 변경 시 버튼 활성화 상태 업데이트
        try:
            if hasattr(self._app_vm, "selected_nodes_changed"):
                self._app_vm.selected_nodes_changed.connect(self._on_selected_nodes_changed)
            if hasattr(self._app_vm, "selected_node1_changed"):
                self._app_vm.selected_node1_changed.connect(self._on_selected_node1_changed)
            if hasattr(self._app_vm, "selected_node2_changed"):
                self._app_vm.selected_node2_changed.connect(self._on_selected_node2_changed)
        except Exception:
            pass
        # 초기 활성화 상태 설정
        self._update_merge_actions_enabled()

    def _add_actions_to_toolbar(self) -> None:
        """액션들을 툴바에 추가"""
        if not self._tool_bar:
            return

        # 구분선
        self._tool_bar.addSeparator()
        
        # 저장/로드
        self._tool_bar.addAction(self._save_action)
        self._tool_bar.addAction(self._load_action)
        
        # 구분선
        self._tool_bar.addSeparator()
        
        # CGS 연산
        self._tool_bar.addAction(self._union_action)
        self._tool_bar.addAction(self._intersect_action)
        self._tool_bar.addAction(self._subtract_action)

        # 구분선
        self._tool_bar.addSeparator()

        # Test Rays
        self._tool_bar.addAction(self._test_rays_action)

        # 구분선
        self._tool_bar.addSeparator()

        # 윈도우 관리
        self._tool_bar.addAction(self._tile_action)
        self._tool_bar.addAction(self._cascade_action)


    def _on_save_cgs_data(self) -> None:
        """CGS 데이터 저장"""
        current_workspace = self._app_vm.active_workspace()
        if not current_workspace:
            return
        
        # MenuBar의 저장 로직과 동일하게 처리
        from PySide6.QtWidgets import QFileDialog
        
        file_path, _ = QFileDialog.getSaveFileName(
            self._main_window,
            f"Save CGS Data - {current_workspace}",
            f"{current_workspace}_cgs_data.json",
            "JSON Files (*.json);;All Files (*)"
        )
        
        if file_path:
            self._app_vm.save_workspace_data(current_workspace, file_path)

    def _on_load_cgs_data(self) -> None:
        """CGS 데이터 로드"""
        current_workspace = self._app_vm.active_workspace()
        if not current_workspace:
            return
        
        # MenuBar의 로드 로직과 동일하게 처리
        from PySide6.QtWidgets import QFileDialog
        
        file_path, _ = QFileDialog.getOpenFileName(
            self._main_window,
            f"Load CGS Data - {current_workspace}",
            "",
            "JSON Files (*.json);;All Files (*)"
        )
        
        if file_path:
            self._app_vm.load_workspace_data(current_workspace, file_path)

    def _on_tile_mdi(self) -> None:
        """MDI 타일링"""
        self._app_vm.request_tile_mdi.emit()

    def _on_cascade_mdi(self) -> None:
        """MDI 캐스케이드"""
        self._app_vm.request_cascade_mdi.emit()

    def _on_test_rays(self) -> None:
        """Test Rays 실행"""
        current_workspace = self._app_vm.active_workspace()
        print(self._app_vm.active_workspace(),"test rays")
        if not current_workspace:
            return
        
        self._app_vm.test_rays(current_workspace)

    # ------------------------------ CGS merge helpers ------------------------------
    def _on_merge_geometry(self, role: GeometryRole) -> None:
        workspace = self._app_vm.active_workspace()
        if not workspace:
            return
        idx1 = getattr(self._app_vm, "selected_node_1_index")()
        idx2 = getattr(self._app_vm, "selected_node_2_index")()
        if idx1 is None or idx2 is None:
            return
        if idx1 < 0 or idx2 < 0:
            return
        try:
            self._app_vm.merge_geometry_nodes(workspace, role, idx1, idx2)
        finally:
            # 병합 후에도 활성화 상태를 다시 계산
            self._update_merge_actions_enabled()

    def _on_selected_nodes_changed(self, workspace: str, node1, idx1: int, node2, idx2: int) -> None:
        # 활성 워크스페이스에서만 버튼 상태를 갱신
        if workspace != self._app_vm.active_workspace():
            self._update_merge_actions_enabled()
            return
        self._update_merge_actions_enabled(idx1, idx2)

    def _on_selected_node1_changed(self, workspace: str, node, idx1: int) -> None:
        if workspace != self._app_vm.active_workspace():
            self._update_merge_actions_enabled()
            return
        self._update_merge_actions_enabled(idx1, getattr(self._app_vm, "selected_node_2_index")())

    def _on_selected_node2_changed(self, workspace: str, node, idx2: int) -> None:
        if workspace != self._app_vm.active_workspace():
            self._update_merge_actions_enabled()
            return
        self._update_merge_actions_enabled(getattr(self._app_vm, "selected_node_1_index")(), idx2)

    def _update_merge_actions_enabled(self, idx1: Optional[int] = None, idx2: Optional[int] = None) -> None:
        if self._union_action is None or self._intersect_action is None or self._subtract_action is None:
            return
        if idx1 is None or idx2 is None:
            try:
                idx1 = getattr(self._app_vm, "selected_node_1_index")()
                idx2 = getattr(self._app_vm, "selected_node_2_index")()
            except Exception:
                idx1, idx2 = -1, -1
        enabled = (idx1 is not None and idx2 is not None and idx1 != -1 and idx2 != -1)
        self._union_action.setEnabled(enabled)
        self._intersect_action.setEnabled(enabled)
        self._subtract_action.setEnabled(enabled)

    def get_new_doc_action(self) -> Optional[QAction]:
        """새 문서 액션 반환"""
        return self._new_doc_action

    def get_tool_bar(self) -> Optional[QToolBar]:
        """툴바 반환"""
        return self._tool_bar
