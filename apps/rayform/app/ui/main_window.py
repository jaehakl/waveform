from __future__ import annotations

from functools import partial
from typing import Dict, Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import (
    QLabel,
    QListWidget,
    QListWidgetItem,
    QDockWidget,
    QMainWindow,
    QMdiArea,
    QMdiSubWindow,
    QTabWidget,
    QTextEdit,
    QToolBar,
)

from context import Context


class MainWindow(QMainWindow):
    """Primary application window with menus, toolbars, docks, and workspace MDIs."""

    def __init__(self) -> None:
        super().__init__()
        self._context = Context()
        self._context.set_main_window(self)

        self._workspace_tabs: Optional[QTabWidget] = None
        self._mdi_areas: Dict[str, QMdiArea] = {}
        self._document_counters: Dict[str, int] = {}
        self._workspace_definitions: Dict[str, list[str]] = {
            "Acquisition": ["Scope Monitor", "Trigger Log"],
            "Analysis": ["Spectrum Viewer", "Filter Designer"],
            "Automation": ["Macro Console"],
        }

        self.setWindowTitle("Rayform Studio")
        self.resize(1200, 800)
        self._build_ui()
        self._connect_context()
        self._context.set_status_message("Ready")

    # -- setup ---------------------------------------------------------------
    def _build_ui(self) -> None:
        self._create_menu_bar()
        self._create_tool_bar()
        self._create_workspace_tabs()
        self._create_left_dock()
        self._create_bottom_dock()
        self._create_status_bar()
        self._populate_initial_documents()

    def _create_menu_bar(self) -> None:
        file_menu = self.menuBar().addMenu("File")

        new_doc_action = QAction("New Document", self)
        new_doc_action.setShortcut("Ctrl+N")
        new_doc_action.triggered.connect(self._create_document)
        file_menu.addAction(new_doc_action)

        file_menu.addSeparator()

        exit_action = QAction("Exit", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        window_menu = self.menuBar().addMenu("Window")
        tile_action = QAction("Tile Active Workspace", self)
        tile_action.triggered.connect(self._tile_mdi)
        window_menu.addAction(tile_action)
        cascade_action = QAction("Cascade Active Workspace", self)
        cascade_action.triggered.connect(self._cascade_mdi)
        window_menu.addAction(cascade_action)

        self._new_doc_action = new_doc_action

    def _create_tool_bar(self) -> None:
        tool_bar = QToolBar("Main", self)
        tool_bar.setMovable(True)
        tool_bar.addAction(self._new_doc_action)
        self.addToolBar(Qt.TopToolBarArea, tool_bar)

    def _create_workspace_tabs(self) -> None:
        tabs = QTabWidget(self)
        tabs.setDocumentMode(True)
        tabs.setMovable(True)
        tabs.currentChanged.connect(self._on_workspace_tab_changed)
        self.setCentralWidget(tabs)
        self._context.set_workspace_tabs(tabs)
        self._workspace_tabs = tabs

        for workspace in self._workspace_definitions:
            area = self._create_workspace_area(workspace)
            self._mdi_areas[workspace] = area
            self._document_counters[workspace] = 1
            tabs.addTab(area, workspace)
            self._context.register_workspace(workspace, area)

    def _create_workspace_area(self, workspace: str) -> QMdiArea:
        mdi_area = QMdiArea(self)
        mdi_area.setViewMode(QMdiArea.ViewMode.TabbedView)
        mdi_area.setTabsClosable(True)
        mdi_area.setTabsMovable(True)
        mdi_area.setDocumentMode(True)
        mdi_area.subWindowActivated.connect(partial(self._on_subwindow_activated, workspace))
        return mdi_area

    def _create_left_dock(self) -> None:
        dock = QDockWidget("Library", self)
        dock.setAllowedAreas(Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea)

        list_widget = QListWidget(dock)
        list_widget.addItems([
            "Waveforms",
            "Signals",
            "Generators",
            "Measurements",
        ])
        list_widget.currentItemChanged.connect(self._on_left_item_changed)

        dock.setWidget(list_widget)
        self.addDockWidget(Qt.LeftDockWidgetArea, dock)

        self._context.set_left_panel(list_widget)
        self._left_list = list_widget

    def _create_bottom_dock(self) -> None:
        dock = QDockWidget("Details", self)
        dock.setAllowedAreas(Qt.BottomDockWidgetArea)

        label = QLabel("Select a library item to see details.", dock)
        label.setAlignment(Qt.AlignLeft | Qt.AlignTop)
        label.setMargin(8)

        dock.setWidget(label)
        self.addDockWidget(Qt.BottomDockWidgetArea, dock)

        self._context.set_bottom_panel(label)
        self._details_label = label

    def _create_status_bar(self) -> None:
        status_bar = self.statusBar()
        status_bar.showMessage(self._context.status_message())

    def _populate_initial_documents(self) -> None:
        if not self._workspace_tabs:
            return
        for workspace, documents in self._workspace_definitions.items():
            area = self._mdi_areas[workspace]
            first_window: Optional[QMdiSubWindow] = None
            for title in documents:
                sub_window = self._create_document(title=title, workspace=workspace, set_active=False)
                if first_window is None and sub_window is not None:
                    first_window = sub_window
            if first_window is not None:
                area.setActiveSubWindow(first_window)
        if self._workspace_tabs.count() > 0:
            self._workspace_tabs.setCurrentIndex(0)
            self._on_workspace_tab_changed(0)

    def _connect_context(self) -> None:
        self._context.status_message_changed.connect(self.statusBar().showMessage)
        self._context.active_subwindow_title_changed.connect(self._on_active_title_changed)
        self._context.active_workspace_changed.connect(self._on_active_workspace_changed)

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
        target_workspace = workspace or self._active_workspace_name()
        if target_workspace is None:
            self._context.set_status_message("No workspace available")
            return None

        area = self._mdi_areas.get(target_workspace)
        if area is None:
            self._context.set_status_message(f"Workspace '{target_workspace}' is unavailable")
            return None

        index = self._document_counters.get(target_workspace, 1)
        document_title = title or f"{target_workspace} Document {index}"
        self._document_counters[target_workspace] = index + 1

        editor = QTextEdit()
        editor.setPlainText(
            f"Workspace: {target_workspace}\nDocument: {document_title}\nAdd your content here."
        )

        sub_window = QMdiSubWindow()
        sub_window.setWidget(editor)
        sub_window.setAttribute(Qt.WA_DeleteOnClose)
        sub_window.setWindowTitle(document_title)

        area.addSubWindow(sub_window)
        sub_window.show()

        if set_active:
            area.setActiveSubWindow(sub_window)
            self._context.update_active_subwindow(target_workspace, sub_window)
            self._context.set_status_message(f"{target_workspace}: Opened {document_title}")
        else:
            if target_workspace == self._active_workspace_name():
                self._context.set_status_message(f"{target_workspace}: Added {document_title}")

        return sub_window

    def _active_workspace_name(self) -> Optional[str]:
        if not self._workspace_tabs:
            return None
        index = self._workspace_tabs.currentIndex()
        if index < 0:
            return None
        return self._workspace_tabs.tabText(index)

    def _current_mdi_area(self) -> Optional[QMdiArea]:
        workspace = self._active_workspace_name()
        if workspace is None:
            return None
        return self._mdi_areas.get(workspace)

    def _tile_mdi(self) -> None:
        area = self._current_mdi_area()
        if area is None:
            self._context.set_status_message("No workspace to tile")
            return
        area.tileSubWindows()
        workspace = self._active_workspace_name() or "Workspace"
        self._context.set_status_message(f"{workspace}: Tiled subwindows")

    def _cascade_mdi(self) -> None:
        area = self._current_mdi_area()
        if area is None:
            self._context.set_status_message("No workspace to cascade")
            return
        area.cascadeSubWindows()
        workspace = self._active_workspace_name() or "Workspace"
        self._context.set_status_message(f"{workspace}: Cascaded subwindows")

    # -- signal handlers -----------------------------------------------------
    def _on_workspace_tab_changed(self, index: int) -> None:
        if not self._workspace_tabs or index < 0:
            self._context.set_active_workspace("")
            self._context.set_status_message("No workspace selected")
            self._context.update_active_subwindow("", None)
            return
        workspace = self._workspace_tabs.tabText(index)
        area = self._mdi_areas.get(workspace)
        self._context.set_active_workspace(workspace)
        active = area.activeSubWindow() if area is not None else None
        if active is not None:
            self._context.set_status_message(f"{workspace}: Active {active.windowTitle()}")
        else:
            self._context.set_status_message(f"{workspace}: No active document")
        self._context.update_active_subwindow(workspace, active)

    def _on_active_workspace_changed(self, workspace: str) -> None:
        if not self._workspace_tabs:
            return
        area = self._mdi_areas.get(workspace)
        if area is None:
            return
        index = self._workspace_tabs.indexOf(area)
        if index >= 0 and index != self._workspace_tabs.currentIndex():
            self._workspace_tabs.setCurrentIndex(index)

    def _on_subwindow_activated(self, workspace: str, sub_window: Optional[QMdiSubWindow]) -> None:
        self._context.update_active_subwindow(workspace, sub_window)
        if sub_window is None:
            self._context.set_status_message(f"{workspace}: No active document")
            return
        self._context.set_status_message(f"{workspace}: Active {sub_window.windowTitle()}")

    def _on_active_title_changed(self, title: str) -> None:
        workspace = self._context.active_workspace()
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

    def _on_left_item_changed(self, current: Optional[QListWidgetItem], previous: Optional[QListWidgetItem]) -> None:
        _ = previous
        if current is None:
            self._details_label.setText("Select a library item to see details.")
            return
        self._details_label.setText(f"Details for: {current.text()}")
        self._context.set_status_message(f"Selected {current.text()}")


def create_main_window() -> MainWindow:
    return MainWindow()
