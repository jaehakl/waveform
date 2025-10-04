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

    def create_menu_bar(self) -> QMenuBar: MenuBarMethods._create_menu_bar(self)
    def _create_file_menu(self, menu_bar: QMenuBar) -> None: MenuBarMethods._create_file_menu(self, menu_bar)
    def _create_window_menu(self, menu_bar: QMenuBar) -> None: MenuBarMethods._create_window_menu(self, menu_bar)
    def _on_save_cgs_data(self) -> None: MenuBarMethods._on_save_cgs_data(self)
    def _on_load_cgs_data(self) -> None: MenuBarMethods._on_load_cgs_data(self)
    def _on_load_example_data(self) -> None: MenuBarMethods._on_load_example_data(self)
    def _on_tile_mdi(self) -> None: MenuBarMethods._on_tile_mdi(self)
    def _on_cascade_mdi(self) -> None: MenuBarMethods._on_cascade_mdi(self)
    def _on_open_cgs_string_viewer(self) -> None: MenuBarMethods._on_open_cgs_string_viewer(self)
    def get_new_doc_action(self) -> Optional[QAction]: MenuBarMethods._get_new_doc_action(self)


class MenuBarMethods:
    def _create_menu_bar(_mbar) -> QMenuBar:
        """메뉴바 생성"""
        menu_bar = _mbar._main_window.menuBar()
        
        # File 메뉴
        _mbar._create_file_menu(menu_bar)
        
        # Window 메뉴
        _mbar._create_window_menu(menu_bar)
        
        return menu_bar

    def _create_file_menu(_mbar, menu_bar: QMenuBar) -> None:
        """File 메뉴 생성"""
        file_menu = menu_bar.addMenu("File")

        # CGS 데이터 저장/로드
        save_cgs_action = QAction("Save CGS Data", _mbar._main_window)
        save_cgs_action.setShortcut("Ctrl+S")
        save_cgs_action.triggered.connect(_mbar._on_save_cgs_data)
        file_menu.addAction(save_cgs_action)

        load_cgs_action = QAction("Load CGS Data", _mbar._main_window)
        load_cgs_action.setShortcut("Ctrl+O")
        load_cgs_action.triggered.connect(_mbar._on_load_cgs_data)
        file_menu.addAction(load_cgs_action)

        # 예제 데이터 로드
        load_example_action = QAction("Load Example Data", _mbar._main_window)
        load_example_action.triggered.connect(_mbar._on_load_example_data)
        file_menu.addAction(load_example_action)

        file_menu.addSeparator()

        # 종료
        exit_action = QAction("Exit", _mbar._main_window)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(_mbar._main_window.close)
        file_menu.addAction(exit_action)

    def _create_window_menu(_mbar, menu_bar: QMenuBar) -> None:
        """Window 메뉴 생성"""
        window_menu = menu_bar.addMenu("Window")
        
        # 타일링
        tile_action = QAction("Tile Active Workspace", _mbar._main_window)
        tile_action.triggered.connect(_mbar._on_tile_mdi)
        window_menu.addAction(tile_action)
        
        # 캐스케이드
        cascade_action = QAction("Cascade Active Workspace", _mbar._main_window)
        cascade_action.triggered.connect(_mbar._on_cascade_mdi)
        window_menu.addAction(cascade_action)
        
        window_menu.addSeparator()
        
        # CGS String 뷰어
        cgs_str_action = QAction("CGS String Viewer", _mbar._main_window)
        cgs_str_action.triggered.connect(_mbar._on_open_cgs_string_viewer)
        window_menu.addAction(cgs_str_action)


    def _on_save_cgs_data(_mbar) -> None:
        """CGS 데이터 저장"""
        current_workspace = _mbar._app_vm.active_workspace()
        if not current_workspace:
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            _mbar._main_window,
            f"Save CGS Data - {current_workspace}",
            f"{current_workspace}_cgs_data.json",
            "JSON Files (*.json);;All Files (*)"
        )
        
        if file_path:
            _mbar._app_vm.save_workspace_data(current_workspace, file_path)

    def _on_load_cgs_data(_mbar) -> None:
        """CGS 데이터 로드"""
        current_workspace = _mbar._app_vm.active_workspace()
        if not current_workspace:
            return
        
        file_path, _ = QFileDialog.getOpenFileName(
            _mbar._main_window,
            f"Load CGS Data - {current_workspace}",
            "",
            "JSON Files (*.json);;All Files (*)"
        )
        
        if file_path:
            _mbar._app_vm.load_workspace_data(current_workspace, file_path)

    def _on_load_example_data(_mbar) -> None:
        """예제 데이터 로드"""
        current_workspace = _mbar._app_vm.active_workspace()
        if current_workspace:
            _mbar._app_vm.load_example_data(current_workspace)

    def _on_tile_mdi(_mbar) -> None:
        """MDI 타일링"""
        _mbar._app_vm.request_tile_mdi.emit()

    def _on_cascade_mdi(_mbar) -> None:
        """MDI 캐스케이드"""
        _mbar._app_vm.request_cascade_mdi.emit()

    def _on_open_cgs_string_viewer(_mbar) -> None:
        """CGS String 뷰어 열기"""
        current_workspace = _mbar._app_vm.active_workspace()
        if not current_workspace:
            _mbar._app_vm.set_status_message("활성 워크스페이스가 없습니다.")
            return
        
        # MainWindow의 CGS String 뷰어 생성 메서드 호출을 위한 시그널 발생
        _mbar._app_vm.request_create_subwindow.emit(current_workspace, "cgs_string_viewer")

    def get_new_doc_action(_mbar) -> Optional[QAction]:
        """새 문서 액션 반환"""
        return _mbar._new_doc_action