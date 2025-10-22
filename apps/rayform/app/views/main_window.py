from __future__ import annotations

from typing import Dict, Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QLabel, QDockWidget, QMainWindow, QMdiSubWindow, QTabWidget, QFileDialog

from viewmodels.application import ApplicationViewModel
from views.widgets.menu_bar import MenuBar
from views.widgets.tool_bar import ToolBar
from views.widgets.workspace_sheet import WorkspaceSheet
from views.subwindows.cgs_str import CGSStringViewer
from views.actions import ActionsManager
from models import GeometryRole

class MainWindow(QMainWindow):
    """Primary application window with menus, toolbars, docks, and workspace MDIs."""
    def __init__(self) -> None:
        super().__init__()
        self._app_vm = ApplicationViewModel()

        self._workspace_tabs: Optional[QTabWidget] = None
        self._workspace_sheets: Dict[str, WorkspaceSheet] = {}
        self._menu_bar: Optional[MenuBar] = None
        self._tool_bar: Optional[ToolBar] = None

        # Actions 클래스 인스턴스
        self.actions_manager: Optional[ActionsManager] = ActionsManager(self)

        self.setWindowTitle("Rayform Studio")
        self.resize(1200, 800)
        self._build_ui()
        MainWindowMethods._connect_view_model(self)
        self._app_vm.set_status_message("Ready")

    def _build_ui(self) -> None:
        self._menu_bar = MenuBar(self)
        self._tool_bar = ToolBar(self)
        MainWindowMethods._create_workspace_tabs(self)
        MainWindowMethods._create_status_bar(self)

    def _create_subwindow(self, workspace: str, subwindow_type: str) -> Optional[QMdiSubWindow]: MainWindowMethods._create_subwindow(self, workspace, subwindow_type)
    def _current_workspace_sheet(self) -> Optional[WorkspaceSheet]: MainWindowMethods._current_workspace_sheet(self)

    def _tile_mdi(self) -> None: 
        """MDI 윈도우 타일링 - Actions 클래스를 통해 처리"""
        if self.actions_manager:
            self.actions_manager._on_tile_mdi()
    
    def _cascade_mdi(self) -> None: 
        """MDI 윈도우 캐스케이딩 - Actions 클래스를 통해 처리"""
        if self.actions_manager:
            self.actions_manager._on_cascade_mdi()
    def _show_workspace_left_dock(self, workspace: str) -> None: MainWindowMethods._show_workspace_left_dock(self, workspace)
    def _hide_all_left_docks(self) -> None: MainWindowMethods._hide_all_left_docks(self)
    def _update_active_subwindow(self, workspace: str, sub_window: Optional[QMdiSubWindow]) -> None: MainWindowMethods._update_active_subwindow(self, workspace, sub_window)
    def _on_workspace_tab_changed(self, index: int) -> None: MainWindowMethods._on_workspace_tab_changed(self, index)
    def _on_active_workspace_changed(self, workspace: str) -> None: MainWindowMethods._on_active_workspace_changed(self, workspace)
    def _on_active_title_changed(self, title: str) -> None: MainWindowMethods._on_active_title_changed(self, title)
    def _on_workspace_data_updated(self, workspace: str, data) -> None: MainWindowMethods._on_workspace_data_updated(self, workspace, data)
    


class MainWindowMethods:
    # -- setup ---------------------------------------------------------------

    def _create_workspace_tabs(_mw) -> None:
        tabs = QTabWidget(_mw)
        tabs.setMovable(True)
        tabs.currentChanged.connect(_mw._on_workspace_tab_changed)
        _mw.setCentralWidget(tabs)
        _mw._workspace_tabs = tabs

        # Default WorkspaceSheet 생성
        workspace_name = "noname"
        workspace_sheet = WorkspaceSheet(workspace_name, _mw._app_vm, _mw)
        _mw._workspace_sheets[workspace_name] = workspace_sheet        
        tabs.addTab(workspace_sheet.mdi_area, workspace_name)

    def _create_status_bar(_mw) -> None:
        status_bar = _mw.statusBar()
        status_bar.showMessage(_mw._app_vm.status_message())

    def _connect_view_model(_mw) -> None:
        status_bar = _mw.statusBar()
        status_bar.showMessage(_mw._app_vm.status_message())
        _mw._app_vm.status_message_changed.connect(status_bar.showMessage)
        _mw._app_vm.active_subwindow_title_changed.connect(_mw._on_active_title_changed)
        _mw._app_vm.active_workspace_changed.connect(_mw._on_active_workspace_changed)
        
        # 메뉴바 시그널 연결
        _mw._app_vm.request_tile_mdi.connect(_mw._tile_mdi)
        _mw._app_vm.request_cascade_mdi.connect(_mw._cascade_mdi)
        _mw._app_vm.request_create_subwindow.connect(_mw._create_subwindow)


    def _create_subwindow(_mw, workspace: str, subwindow_type: str) -> Optional[QMdiSubWindow]:
        """subwindow 생성"""
        workspace_sheet = _mw._workspace_sheets.get(workspace)
        if workspace_sheet is None:
            _mw._app_vm.set_status_message(f"워크스페이스 '{workspace}'를 찾을 수 없습니다.")
            return None     

        if subwindow_type == "cgs_string_viewer":
            subwindow = CGSStringViewer(_mw._app_vm, workspace)
        else:
            _mw._app_vm.set_status_message(f"지원하지 않는 서브윈도우 타입입니다: {subwindow_type}")
            return None

        if workspace_sheet.mdi_area:
            workspace_sheet.mdi_area.addSubWindow(subwindow)
            subwindow.show()
            _mw._app_vm.set_status_message(f"CGS String 뷰어가 {workspace} 워크스페이스에 열렸습니다.")
            return subwindow
        
        return None

    def _current_workspace_sheet(_mw) -> Optional[WorkspaceSheet]:
        workspace = _mw._app_vm.active_workspace()
        if workspace is None:
            return None
        return _mw._workspace_sheets.get(workspace)


    def _show_workspace_left_dock(_mw, workspace: str) -> None:
        """특정 workspace의 left dock만 보이게 하고 나머지는 숨김"""
        for ws_name, workspace_sheet in _mw._workspace_sheets.items():
            if ws_name == workspace:
                workspace_sheet.show_left_dock()
            else:
                workspace_sheet.hide_left_dock()

    def _hide_all_left_docks(_mw) -> None:
        """모든 workspace의 left dock을 숨김"""
        for workspace_sheet in _mw._workspace_sheets.values():
            workspace_sheet.hide_left_dock()

    def _update_active_subwindow(_mw, workspace: str, sub_window: Optional[QMdiSubWindow]) -> None:
        _mw._app_vm.set_active_workspace(workspace)
        title = ""
        if sub_window is not None:
            title = sub_window.windowTitle() or ""
        _mw._app_vm.set_active_subwindow_title(title)

    # -- signal handlers -----------------------------------------------------
    def _on_workspace_tab_changed(_mw, index: int) -> None:
        if not _mw._workspace_tabs or index < 0:
            _mw._app_vm.set_active_workspace("")
            _mw._app_vm.set_status_message("No workspace selected")
            _mw._update_active_subwindow("", None)
            _mw._hide_all_left_docks()
            return
        workspace = _mw._workspace_tabs.tabText(index)
        workspace_sheet = _mw._workspace_sheets.get(workspace)
        _mw._app_vm.set_active_workspace(workspace)

        # 현재 workspace의 left dock만 보이게 하고 나머지는 숨김
        _mw._show_workspace_left_dock(workspace)
        
        active = workspace_sheet.get_active_subwindow() if workspace_sheet is not None else None
        if active is not None:
            _mw._app_vm.set_status_message(f"{workspace}: Active {active.windowTitle()}")
        else:
            _mw._app_vm.set_status_message(f"{workspace}: No active window")
        _mw._update_active_subwindow(workspace, active)

    def _on_active_workspace_changed(_mw, workspace: str) -> None:
        if not _mw._workspace_tabs:
            return
        workspace_sheet = _mw._workspace_sheets.get(workspace)
        if workspace_sheet is None:
            return
        index = _mw._workspace_tabs.indexOf(workspace_sheet.mdi_area)
        if index >= 0 and index != _mw._workspace_tabs.currentIndex():
            _mw._workspace_tabs.setCurrentIndex(index)

    def _on_active_title_changed(_mw, title: str) -> None:
        workspace = _mw._app_vm.active_workspace()
        if title:
            if workspace:
                _mw.setWindowTitle(f"Rayform Studio - {workspace} - {title}")
            else:
                _mw.setWindowTitle(f"Rayform Studio - {title}")
        else:
            if workspace:
                _mw.setWindowTitle(f"Rayform Studio - {workspace}")
            else:
                _mw.setWindowTitle("Rayform Studio")

    def _on_workspace_data_updated(_mw, workspace: str, data) -> None:
        """Workspace 데이터 업데이트 시"""
        workspace_vm = _mw._app_vm.ensure_workspace(workspace)
        workspace_vm.set_workspace_data(data)
        _mw._app_vm.handle_workspace_data_updated(workspace, data)


