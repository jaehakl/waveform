from __future__ import annotations

from typing import Optional
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QMenuBar, QFileDialog


class MenuBar:
    """메뉴바 관리 클래스"""

    def __init__(self, main_window, app_vm):
        self._main_window = main_window
        self._app_vm = app_vm
        self._new_doc_action: Optional[QAction] = None
        self.create_menu_bar()

    def create_menu_bar(self) -> QMenuBar:
        """메뉴바 생성"""
        menu_bar = self._main_window.menuBar()
        
        # File 메뉴
        self._create_file_menu(menu_bar)
        
        # Window 메뉴
        self._create_window_menu(menu_bar)
        
        return menu_bar

    def _create_file_menu(self, menu_bar: QMenuBar) -> None:
        """File 메뉴 생성"""
        file_menu = menu_bar.addMenu("File")

        # 새 문서
        self._new_doc_action = QAction("New Document", self._main_window)
        self._new_doc_action.setShortcut("Ctrl+N")
        self._new_doc_action.triggered.connect(self._create_document)
        file_menu.addAction(self._new_doc_action)

        file_menu.addSeparator()

        # CGS 데이터 저장/로드
        save_cgs_action = QAction("Save CGS Data", self._main_window)
        save_cgs_action.setShortcut("Ctrl+S")
        save_cgs_action.triggered.connect(self._on_save_cgs_data)
        file_menu.addAction(save_cgs_action)

        load_cgs_action = QAction("Load CGS Data", self._main_window)
        load_cgs_action.setShortcut("Ctrl+O")
        load_cgs_action.triggered.connect(self._on_load_cgs_data)
        file_menu.addAction(load_cgs_action)

        # 예제 데이터 로드
        load_example_action = QAction("Load Example Data", self._main_window)
        load_example_action.triggered.connect(self._on_load_example_data)
        file_menu.addAction(load_example_action)

        file_menu.addSeparator()

        # 종료
        exit_action = QAction("Exit", self._main_window)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self._main_window.close)
        file_menu.addAction(exit_action)

    def _create_window_menu(self, menu_bar: QMenuBar) -> None:
        """Window 메뉴 생성"""
        window_menu = menu_bar.addMenu("Window")
        
        # 타일링
        tile_action = QAction("Tile Active Workspace", self._main_window)
        tile_action.triggered.connect(self._on_tile_mdi)
        window_menu.addAction(tile_action)
        
        # 캐스케이드
        cascade_action = QAction("Cascade Active Workspace", self._main_window)
        cascade_action.triggered.connect(self._on_cascade_mdi)
        window_menu.addAction(cascade_action)

    def _create_document(self) -> None:
        """새 문서 생성"""
        # MainWindow의 _create_document 메서드 호출을 위한 시그널 발생
        self._app_vm.request_create_document.emit()

    def _on_save_cgs_data(self) -> None:
        """CGS 데이터 저장"""
        current_workspace = self._app_vm.active_workspace()
        if not current_workspace:
            return
        
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
        
        file_path, _ = QFileDialog.getOpenFileName(
            self._main_window,
            f"Load CGS Data - {current_workspace}",
            "",
            "JSON Files (*.json);;All Files (*)"
        )
        
        if file_path:
            self._app_vm.load_workspace_data(current_workspace, file_path)

    def _on_load_example_data(self) -> None:
        """예제 데이터 로드"""
        current_workspace = self._app_vm.active_workspace()
        if current_workspace:
            self._app_vm.load_example_data(current_workspace)

    def _on_tile_mdi(self) -> None:
        """MDI 타일링"""
        self._app_vm.request_tile_mdi.emit()

    def _on_cascade_mdi(self) -> None:
        """MDI 캐스케이드"""
        self._app_vm.request_cascade_mdi.emit()

    def get_new_doc_action(self) -> Optional[QAction]:
        """새 문서 액션 반환"""
        return self._new_doc_action
