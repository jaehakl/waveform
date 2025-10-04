from __future__ import annotations

from functools import partial
from typing import Optional

from PySide6.QtCore import QObject, Qt, Signal
from PySide6.QtWidgets import (
    QDockWidget,
    QListWidget,
    QListWidgetItem,
    QMdiArea,
    QMdiSubWindow,
    QTextEdit,
    QSplitter,
)

from viewmodels.application import ApplicationViewModel
from views.subwindows.cgs_3d_viewer import CGS3DViewerWindow
from views.widgets.cgs_tree_widget import CGSTreeWidget
from views.widgets.geometry_edit_widget import GeometryEditWidget


class WorkspaceSheet(QObject):
    """Encapsulates all widgets that belong to a single workspace tab."""

    data_updated = Signal(str, object)  # workspace, data

    def __init__(self, workspace_name: str, app_vm: ApplicationViewModel, parent_window) -> None:
        super().__init__()
        self.workspace_name = workspace_name
        self.app_vm = app_vm
        self.parent_window = parent_window

        # Lazy created widgets
        self.mdi_area: Optional[QMdiArea] = None
        self.left_dock: Optional[QDockWidget] = None
        self.cgs_tree_widget: Optional[CGSTreeWidget] = None
        self.geometry_edit_widget: Optional[GeometryEditWidget] = None
        self._left_splitter: Optional[QSplitter] = None
        self._viewer_window: Optional[QMdiSubWindow] = None
        
        self._create_widgets()
        self._connect_signals()

    # ---------------------------------------------------------------------
    def _create_widgets(self) -> None:
        """Instantiate the MDI area, tree dock, editor panel, and defaults."""
        self.mdi_area = QMdiArea(self.parent_window)
        self.mdi_area.setViewMode(QMdiArea.ViewMode.SubWindowView)
        self.mdi_area.setTabsClosable(True)
        self.mdi_area.setTabsMovable(True)
        self.mdi_area.subWindowActivated.connect(partial(self._on_subwindow_activated))

        self.cgs_tree_widget = CGSTreeWidget()
        self.cgs_tree_widget.set_app_view_model(self.app_vm)
        self.cgs_tree_widget.set_workspace(self.workspace_name)

        # 하단 Geometry 에디터와 함께 수직 스플리터 구성
        self.geometry_edit_widget = GeometryEditWidget(self.app_vm, self.workspace_name)
        self._left_splitter = QSplitter(Qt.Orientation.Vertical, self.parent_window)
        self._left_splitter.addWidget(self.cgs_tree_widget)
        self._left_splitter.addWidget(self.geometry_edit_widget)
        self._left_splitter.setChildrenCollapsible(False)
        # 초기 사이즈 비율 (상단 60%, 하단 40%)
        self._left_splitter.setSizes([3, 2])

        self.left_dock = QDockWidget(f"{self.workspace_name} CGS Tree", self.parent_window)
        self.left_dock.setAllowedAreas(Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea)
        self.left_dock.setWidget(self._left_splitter)
        self.left_dock.setVisible(False)
        self.parent_window.addDockWidget(Qt.LeftDockWidgetArea, self.left_dock)

        self._open_default_subwindows()

    def _connect_signals(self) -> None:
        """Attach future signals here."""
        pass

    # ------------------------------------------------------------------ UI
    def _open_default_subwindows(self) -> None:
        """Ensure the workspace starts with the CGS 3D View."""
        if self.mdi_area is None:
            return
        if self._viewer_window is not None:
            return

        viewer = CGS3DViewerWindow(self.app_vm, self.workspace_name, self.mdi_area)
        self.mdi_area.addSubWindow(viewer)
        viewer.show()
        self.mdi_area.setActiveSubWindow(viewer)
        self._viewer_window = viewer
        self.app_vm.set_status_message(f"{self.workspace_name}: 3D Viewer ready")

    def _on_subwindow_activated(self, sub_window: Optional[QMdiSubWindow]) -> None:
        self.app_vm.set_active_workspace(self.workspace_name)
        if sub_window is None:
            self.app_vm.set_status_message(f"{self.workspace_name}: No active window")
            return
        self.app_vm.set_status_message(
            f"{self.workspace_name}: Active {sub_window.windowTitle()}"
        )

    def _on_workspace_data_updated(self, data) -> None:
        self.data_updated.emit(self.workspace_name, data)

    # ---------------------------------------------------------------- docks
    def show_left_dock(self) -> None:
        if self.left_dock:
            self.left_dock.setVisible(True)

    def hide_left_dock(self) -> None:
        if self.left_dock:
            self.left_dock.setVisible(False)

    def tile_subwindows(self) -> None:
        if self.mdi_area:
            self.mdi_area.tileSubWindows()
            self.app_vm.set_status_message(f"{self.workspace_name}: Tiled subwindows")

    def cascade_subwindows(self) -> None:
        if self.mdi_area:
            self.mdi_area.cascadeSubWindows()
            self.app_vm.set_status_message(f"{self.workspace_name}: Cascaded subwindows")

    def get_active_subwindow(self) -> Optional[QMdiSubWindow]:
        if self.mdi_area:
            return self.mdi_area.activeSubWindow()
        return None

    def set_active_subwindow(self, sub_window: Optional[QMdiSubWindow]) -> None:
        if self.mdi_area and sub_window:
            self.mdi_area.setActiveSubWindow(sub_window)
