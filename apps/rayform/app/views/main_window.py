from __future__ import annotations

from functools import partial
from typing import Dict, Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QLabel, QDockWidget, QMainWindow, QMdiSubWindow, QTabWidget

from viewmodels.application import ApplicationViewModel
from views.widgets.menu_bar import MenuBar
from views.widgets.tool_bar import ToolBar
from views.workspace_sheet import WorkspaceSheet

class MainWindow(QMainWindow):
    """Primary application window with menus, toolbars, docks, and workspace MDIs."""

    def __init__(self) -> None:
        super().__init__()
        self._app_vm = ApplicationViewModel()

        self._workspace_tabs: Optional[QTabWidget] = None
        self._workspace_sheets: Dict[str, WorkspaceSheet] = {}
        self._workspace_definitions: Dict[str, list[str]] = {
            "Acquisition": ["Scope Monitor", "Trigger Log"],
            "Analysis": ["Spectrum Viewer", "Filter Designer"],
            "Automation": ["Macro Console"],
        }
        self._menu_bar: Optional[MenuBar] = None
        self._tool_bar: Optional[ToolBar] = None

        self.setWindowTitle("Rayform Studio")
        self.resize(1200, 800)
        self._build_ui()
        self._connect_view_model()
        self._app_vm.set_status_message("Ready")

    # -- setup ---------------------------------------------------------------
    def _build_ui(self) -> None:
        self._menu_bar = MenuBar(self, self._app_vm)
        self._tool_bar = ToolBar(self, self._app_vm)
        self._create_workspace_tabs()
        self._create_bottom_dock()
        self._create_status_bar()
        self._populate_initial_documents()

    def _create_workspace_tabs(self) -> None:
        tabs = QTabWidget(self)
        tabs.setDocumentMode(True)
        tabs.setMovable(True)
        tabs.currentChanged.connect(self._on_workspace_tab_changed)
        self.setCentralWidget(tabs)
        self._workspace_tabs = tabs

        for workspace in self._workspace_definitions:
            # WorkspaceSheet 생성
            workspace_sheet = WorkspaceSheet(workspace, self._app_vm, self)
            self._workspace_sheets[workspace] = workspace_sheet
            
            # WorkspaceSheet의 data_updated 시그널 연결
            workspace_sheet.data_updated.connect(self._on_workspace_data_updated)
            
            # MDI area를 탭에 추가
            tabs.addTab(workspace_sheet.mdi_area, workspace)


    def _create_bottom_dock(self) -> None:
        dock = QDockWidget("Editor", self)
        dock.setAllowedAreas(Qt.BottomDockWidgetArea)

        # 기본 라벨로 초기화 (workspace 생성 후 업데이트됨)
        label = QLabel("Select a workspace to edit CGS data.", dock)
        label.setAlignment(Qt.AlignCenter)
        dock.setWidget(label)

        self.addDockWidget(Qt.BottomDockWidgetArea, dock)
        self._bottom_dock = dock

    def _create_status_bar(self) -> None:
        status_bar = self.statusBar()
        status_bar.showMessage(self._app_vm.status_message())

    def _populate_initial_documents(self) -> None:
        if not self._workspace_tabs:
            return
        for workspace, documents in self._workspace_definitions.items():
            workspace_sheet = self._workspace_sheets[workspace]
            first_window: Optional[QMdiSubWindow] = None
            for title in documents:
                sub_window = workspace_sheet.create_document(title=title, set_active=False)
                if first_window is None and sub_window is not None:
                    first_window = sub_window
            if first_window is not None:
                workspace_sheet.set_active_subwindow(first_window)
        if self._workspace_tabs.count() > 0:
            self._workspace_tabs.setCurrentIndex(0)
            # 첫 번째 workspace의 left dock을 보이게 함
            first_workspace = self._workspace_tabs.tabText(0)
            self._show_workspace_left_dock(first_workspace)
            # 첫 번째 workspace의 bottom dock도 업데이트
            self._update_bottom_dock(first_workspace)
            self._on_workspace_tab_changed(0)

    def _connect_view_model(self) -> None:
        status_bar = self.statusBar()
        status_bar.showMessage(self._app_vm.status_message())
        self._app_vm.status_message_changed.connect(status_bar.showMessage)
        self._app_vm.active_subwindow_title_changed.connect(self._on_active_title_changed)
        self._app_vm.active_workspace_changed.connect(self._on_active_workspace_changed)
        
        # 메뉴바 시그널 연결
        self._app_vm.request_create_document.connect(self._create_document)
        self._app_vm.request_tile_mdi.connect(self._tile_mdi)
        self._app_vm.request_cascade_mdi.connect(self._cascade_mdi)

    # -- document helpers ----------------------------------------------------
    def _create_document(
        self,
        checked: bool = False,
        title: Optional[str] = None,
        workspace: Optional[str] = None,
        set_active: bool = True,
    ) -> Optional[QMdiSubWindow]:
        _ = checked
        if self._workspace_tabs is None:
            return None
        target_workspace = workspace or self._app_vm.active_workspace()
        if target_workspace is None:
            self._app_vm.set_status_message("No workspace available")
            return None

        workspace_sheet = self._workspace_sheets.get(target_workspace)
        if workspace_sheet is None:
            self._app_vm.set_status_message(f"Workspace '{target_workspace}' is unavailable")
            return None

        sub_window = workspace_sheet.create_document(title=title, set_active=set_active)
        if set_active and sub_window:
            self._update_active_subwindow(target_workspace, sub_window)

        return sub_window


    def _current_workspace_sheet(self) -> Optional[WorkspaceSheet]:
        workspace = self._app_vm.active_workspace()
        if workspace is None:
            return None
        return self._workspace_sheets.get(workspace)

    def _tile_mdi(self) -> None:
        workspace_sheet = self._current_workspace_sheet()
        if workspace_sheet is None:
            self._app_vm.set_status_message("No workspace to tile")
            return
        workspace_sheet.tile_subwindows()

    def _cascade_mdi(self) -> None:
        workspace_sheet = self._current_workspace_sheet()
        if workspace_sheet is None:
            self._app_vm.set_status_message("No workspace to cascade")
            return
        workspace_sheet.cascade_subwindows()

    def _show_workspace_left_dock(self, workspace: str) -> None:
        """특정 workspace의 left dock만 보이게 하고 나머지는 숨김"""
        for ws_name, workspace_sheet in self._workspace_sheets.items():
            if ws_name == workspace:
                workspace_sheet.show_left_dock()
            else:
                workspace_sheet.hide_left_dock()

    def _hide_all_left_docks(self) -> None:
        """모든 workspace의 left dock을 숨김"""
        for workspace_sheet in self._workspace_sheets.values():
            workspace_sheet.hide_left_dock()

    def _update_active_subwindow(self, workspace: str, sub_window: Optional[QMdiSubWindow]) -> None:
        self._app_vm.set_active_workspace(workspace)
        title = ""
        if sub_window is not None:
            title = sub_window.windowTitle() or ""
        self._app_vm.set_active_subwindow_title(title)

    # -- signal handlers -----------------------------------------------------
    def _on_workspace_tab_changed(self, index: int) -> None:
        if not self._workspace_tabs or index < 0:
            self._app_vm.set_active_workspace("")
            self._app_vm.set_status_message("No workspace selected")
            self._update_active_subwindow("", None)
            self._hide_all_left_docks()
            return
        workspace = self._workspace_tabs.tabText(index)
        workspace_sheet = self._workspace_sheets.get(workspace)
        self._app_vm.set_active_workspace(workspace)

        # 현재 workspace의 left dock만 보이게 하고 나머지는 숨김
        self._show_workspace_left_dock(workspace)

        # Bottom dock을 현재 workspace의 editor panel로 변경
        self._update_bottom_dock(workspace)
        
        active = workspace_sheet.get_active_subwindow() if workspace_sheet is not None else None
        if active is not None:
            self._app_vm.set_status_message(f"{workspace}: Active {active.windowTitle()}")
        else:
            self._app_vm.set_status_message(f"{workspace}: No active document")
        self._update_active_subwindow(workspace, active)

    def _on_active_workspace_changed(self, workspace: str) -> None:
        if not self._workspace_tabs:
            return
        workspace_sheet = self._workspace_sheets.get(workspace)
        if workspace_sheet is None:
            return
        index = self._workspace_tabs.indexOf(workspace_sheet.mdi_area)
        if index >= 0 and index != self._workspace_tabs.currentIndex():
            self._workspace_tabs.setCurrentIndex(index)

    def _on_active_title_changed(self, title: str) -> None:
        workspace = self._app_vm.active_workspace()
        if title:
            if workspace:
                self.setWindowTitle(f"Rayform Studio - {workspace} - {title}")
            else:
                self.setWindowTitle(f"Rayform Studio - {title}")
        else:
            if workspace:
                self.setWindowTitle(f"Rayform Studio - {workspace}")
            else:
                self.setWindowTitle("Rayform Studio")

    def _update_bottom_dock(self, workspace: str) -> None:
        """Bottom dock을 현재 workspace의 editor panel로 업데이트"""
        workspace_sheet = self._workspace_sheets.get(workspace)
        if workspace_sheet and hasattr(self, '_bottom_dock'):
            editor_panel = workspace_sheet.get_editor_panel()
            if editor_panel:
                self._bottom_dock.setWidget(editor_panel)


    def _on_workspace_data_updated(self, workspace: str, data) -> None:
        """Workspace 데이터 업데이트 시"""
        workspace_vm = self._app_vm.ensure_workspace(workspace)
        workspace_vm.set_workspace_data(data)
        self._app_vm.handle_workspace_data_updated(workspace, data)




def create_main_window() -> MainWindow:
    return MainWindow()
