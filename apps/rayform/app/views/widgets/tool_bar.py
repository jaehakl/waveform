from __future__ import annotations

from typing import Optional
from PySide6.QtCore import Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QToolBar


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
        # 새 문서 액션
        self._new_doc_action = QAction("New Document", self._main_window)
        self._new_doc_action.setShortcut("Ctrl+N")
        self._new_doc_action.setToolTip("Create a new document (Ctrl+N)")
        self._new_doc_action.triggered.connect(self._create_document)

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

    def _add_actions_to_toolbar(self) -> None:
        """액션들을 툴바에 추가"""
        if not self._tool_bar:
            return

        # 새 문서
        self._tool_bar.addAction(self._new_doc_action)
        
        # 구분선
        self._tool_bar.addSeparator()
        
        # 저장/로드
        self._tool_bar.addAction(self._save_action)
        self._tool_bar.addAction(self._load_action)
        
        # 구분선
        self._tool_bar.addSeparator()
        
        # 윈도우 관리
        self._tool_bar.addAction(self._tile_action)
        self._tool_bar.addAction(self._cascade_action)

    def _create_document(self) -> None:
        """새 문서 생성"""
        self._app_vm.request_create_document.emit()

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

    def get_new_doc_action(self) -> Optional[QAction]:
        """새 문서 액션 반환"""
        return self._new_doc_action

    def get_tool_bar(self) -> Optional[QToolBar]:
        """툴바 반환"""
        return self._tool_bar
