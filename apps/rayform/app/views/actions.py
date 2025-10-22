from __future__ import annotations

from typing import Dict, Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QFileDialog

from models import GeometryRole



class ActionsManager:
    """MainWindow의 모든 액션들과 핸들러 메서드들을 관리하는 클래스"""
    
    def __init__(self, main_window):
        self.main_window = main_window
        self.app_vm = main_window._app_vm
        self.actions: Dict[str, QAction] = {}
        self._create_common_actions()
    
    def _create_common_actions(self) -> None:
        """공통 액션들을 생성하고 저장"""
        # 파일 관련 액션들
        self.actions["save_cgs"] = QAction("Save CGS Data", self.main_window)
        self.actions["save_cgs"].setShortcut("Ctrl+S")
        self.actions["save_cgs"].setToolTip("Save CGS data (Ctrl+S)")
        self.actions["save_cgs"].triggered.connect(self._on_save_cgs_data)

        self.actions["load_cgs"] = QAction("Load CGS Data", self.main_window)
        self.actions["load_cgs"].setShortcut("Ctrl+O")
        self.actions["load_cgs"].setToolTip("Load CGS data (Ctrl+O)")
        self.actions["load_cgs"].triggered.connect(self._on_load_cgs_data)

        self.actions["load_example"] = QAction("Load Example Data", self.main_window)
        self.actions["load_example"].triggered.connect(self._on_load_example_data)

        self.actions["exit"] = QAction("Exit", self.main_window)
        self.actions["exit"].setShortcut("Ctrl+Q")
        self.actions["exit"].triggered.connect(self.main_window.close)

        # 윈도우 관리 액션들
        self.actions["tile_mdi"] = QAction("Tile Active Workspace", self.main_window)
        self.actions["tile_mdi"].setToolTip("Tile active workspace windows")
        self.actions["tile_mdi"].triggered.connect(self._on_tile_mdi)

        self.actions["cascade_mdi"] = QAction("Cascade Active Workspace", self.main_window)
        self.actions["cascade_mdi"].setToolTip("Cascade active workspace windows")
        self.actions["cascade_mdi"].triggered.connect(self._on_cascade_mdi)

        # CGS 연산 액션들
        self.actions["union"] = QAction("Union", self.main_window)
        self.actions["union"].setToolTip("Merge selected nodes with UNION")
        self.actions["union"].triggered.connect(lambda: self._on_merge_geometry(GeometryRole.UNION))

        self.actions["intersect"] = QAction("Intersect", self.main_window)
        self.actions["intersect"].setToolTip("Merge selected nodes with INTERSECT")
        self.actions["intersect"].triggered.connect(lambda: self._on_merge_geometry(GeometryRole.INTERSECT))

        self.actions["subtract"] = QAction("Subtract", self.main_window)
        self.actions["subtract"].setToolTip("Merge selected nodes with SUBTRACT")
        self.actions["subtract"].triggered.connect(lambda: self._on_merge_geometry(GeometryRole.SUBTRACT))

        # 기타 액션들
        self.actions["test_rays"] = QAction("Test Rays", self.main_window)
        self.actions["test_rays"].setToolTip("Test ray tracing for current workspace")
        self.actions["test_rays"].triggered.connect(self._on_test_rays)

        self.actions["cgs_string_viewer"] = QAction("CGS String Viewer", self.main_window)
        self.actions["cgs_string_viewer"].triggered.connect(self._on_open_cgs_string_viewer)

        # 선택 변경 시그널 연결
        self._connect_selection_signals()
        
        # 초기 활성화 상태 설정
        self._update_merge_actions_enabled()

    def _connect_selection_signals(self) -> None:
        """선택 변경 시그널들을 연결"""
        try:
            if hasattr(self.app_vm, "selected_nodes_changed"):
                self.app_vm.selected_nodes_changed.connect(self._on_selected_nodes_changed)
            if hasattr(self.app_vm, "selected_node1_changed"):
                self.app_vm.selected_node1_changed.connect(self._on_selected_node1_changed)
            if hasattr(self.app_vm, "selected_node2_changed"):
                self.app_vm.selected_node2_changed.connect(self._on_selected_node2_changed)
        except Exception:
            pass

    # -- 액션 핸들러 메서드들 -----------------------------------------------------
    
    def _on_save_cgs_data(self) -> None:
        """CGS 데이터 저장"""
        current_workspace = self.app_vm.active_workspace()
        if not current_workspace:
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self.main_window,
            f"Save CGS Data - {current_workspace}",
            f"{current_workspace}_cgs_data.json",
            "JSON Files (*.json);;All Files (*)"
        )
        
        if file_path:
            self.app_vm.save_workspace_data(current_workspace, file_path)

    def _on_load_cgs_data(self) -> None:
        """CGS 데이터 로드"""
        current_workspace = self.app_vm.active_workspace()
        if not current_workspace:
            return
        
        file_path, _ = QFileDialog.getOpenFileName(
            self.main_window,
            f"Load CGS Data - {current_workspace}",
            "",
            "JSON Files (*.json);;All Files (*)"
        )
        
        if file_path:
            self.app_vm.load_workspace_data(current_workspace, file_path)

    def _on_load_example_data(self) -> None:
        """예제 데이터 로드"""
        current_workspace = self.app_vm.active_workspace()
        if current_workspace:
            self.app_vm.load_example_data(current_workspace)

    def _on_test_rays(self) -> None:
        """Test Rays 실행"""
        current_workspace = self.app_vm.active_workspace()
        print(self.app_vm.active_workspace(), "test rays")
        if not current_workspace:
            return
        
        self.app_vm.test_rays(current_workspace)

    def _on_open_cgs_string_viewer(self) -> None:
        """CGS String 뷰어 열기"""
        current_workspace = self.app_vm.active_workspace()
        if not current_workspace:
            self.app_vm.set_status_message("활성 워크스페이스가 없습니다.")
            return
        
        # MainWindow의 CGS String 뷰어 생성 메서드 호출을 위한 시그널 발생
        self.app_vm.request_create_subwindow.emit(current_workspace, "cgs_string_viewer")

    def _on_merge_geometry(self, role: GeometryRole) -> None:
        """CGS 노드 병합"""
        workspace = self.app_vm.active_workspace()
        if not workspace:
            return
        idx1 = getattr(self.app_vm, "selected_node_1_index")()
        idx2 = getattr(self.app_vm, "selected_node_2_index")()
        if idx1 is None or idx2 is None:
            return
        if idx1 < 0 or idx2 < 0:
            return
        try:
            self.app_vm.merge_geometry_nodes(workspace, role, idx1, idx2)
        finally:
            # 병합 후에도 활성화 상태를 다시 계산
            self._update_merge_actions_enabled()

    def _on_tile_mdi(self) -> None:
        """MDI 윈도우 타일링"""
        workspace_sheet = self.main_window._current_workspace_sheet()
        if workspace_sheet is None:
            self.app_vm.set_status_message("No workspace to tile")
            return
        workspace_sheet.tile_subwindows()

    def _on_cascade_mdi(self) -> None:
        """MDI 윈도우 캐스케이딩"""
        workspace_sheet = self.main_window._current_workspace_sheet()
        if workspace_sheet is None:
            self.app_vm.set_status_message("No workspace to cascade")
            return
        workspace_sheet.cascade_subwindows()

    def _on_selected_nodes_changed(self, workspace: str, node1, idx1: int, node2, idx2: int) -> None:
        """선택된 노드들 변경 시"""
        # 활성 워크스페이스에서만 버튼 상태를 갱신
        if workspace != self.app_vm.active_workspace():
            self._update_merge_actions_enabled()
            return
        self._update_merge_actions_enabled(idx1, idx2)

    def _on_selected_node1_changed(self, workspace: str, node, idx1: int) -> None:
        """선택된 노드1 변경 시"""
        if workspace != self.app_vm.active_workspace():
            self._update_merge_actions_enabled()
            return
        self._update_merge_actions_enabled(idx1, getattr(self.app_vm, "selected_node_2_index")())

    def _on_selected_node2_changed(self, workspace: str, node, idx2: int) -> None:
        """선택된 노드2 변경 시"""
        if workspace != self.app_vm.active_workspace():
            self._update_merge_actions_enabled()
            return
        self._update_merge_actions_enabled(getattr(self.app_vm, "selected_node_1_index")(), idx2)

    def _update_merge_actions_enabled(self, idx1: Optional[int] = None, idx2: Optional[int] = None) -> None:
        """병합 액션들의 활성화 상태 업데이트"""
        if "union" not in self.actions or "intersect" not in self.actions or "subtract" not in self.actions:
            return
        if idx1 is None or idx2 is None:
            try:
                idx1 = getattr(self.app_vm, "selected_node_1_index")()
                idx2 = getattr(self.app_vm, "selected_node_2_index")()
            except Exception:
                idx1, idx2 = -1, -1
        enabled = (idx1 is not None and idx2 is not None and idx1 != -1 and idx2 != -1)
        self.actions["union"].setEnabled(enabled)
        self.actions["intersect"].setEnabled(enabled)
        self.actions["subtract"].setEnabled(enabled)
