from __future__ import annotations

from typing import Dict, Optional

from PySide6.QtCore import QObject, Signal
from PySide6.QtWidgets import QMainWindow, QMdiArea, QMdiSubWindow, QWidget, QTabWidget


class State(QObject):
    """Application-wide shared state container implemented as a singleton."""

    _instance: Optional["State"] = None

    status_message_changed = Signal(str)
    active_workspace_changed = Signal(str)
    active_subwindow_title_changed = Signal(str)

    def __new__(cls) -> "State":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return
        super().__init__()
        self._initialized = True
        self.main_window: Optional[QMainWindow] = None
        self.workspace_tabs: Optional[QTabWidget] = None
        self.mdi_areas: Dict[str, QMdiArea] = {}
        self.left_panels: Dict[str, QWidget] = {}
        self.bottom_panel: Optional[QWidget] = None
        self._status_message: str = ""
        self._active_workspace: str = ""
        self._active_subwindow_title: str = ""

    # -- main window helpers -------------------------------------------------
    def set_main_window(self, window: QMainWindow) -> None:
        self.main_window = window

    def set_workspace_tabs(self, tabs: QTabWidget) -> None:
        self.workspace_tabs = tabs

    def register_workspace(self, name: str, mdi_area: QMdiArea) -> None:
        self.mdi_areas[name] = mdi_area

    def mdi_area(self, name: str) -> Optional[QMdiArea]:
        return self.mdi_areas.get(name)

    def set_left_panel(self, widget: QWidget) -> None:
        # Deprecated: use set_workspace_left_panel instead
        pass

    def set_workspace_left_panel(self, workspace: str, widget: QWidget) -> None:
        self.left_panels[workspace] = widget

    def get_workspace_left_panel(self, workspace: str) -> Optional[QWidget]:
        return self.left_panels.get(workspace)

    def set_bottom_panel(self, widget: QWidget) -> None:
        self.bottom_panel = widget

    # -- workspace state -----------------------------------------------------
    def active_workspace(self) -> str:
        return self._active_workspace

    def set_active_workspace(self, name: str) -> None:
        if name == self._active_workspace:
            return
        self._active_workspace = name
        self.active_workspace_changed.emit(self._active_workspace)

    # -- status bar state ----------------------------------------------------
    def status_message(self) -> str:
        return self._status_message

    def set_status_message(self, message: str) -> None:
        message = message or ""
        if message == self._status_message:
            return
        self._status_message = message
        self.status_message_changed.emit(self._status_message)

    # -- mdi state -----------------------------------------------------------
    def active_subwindow_title(self) -> str:
        return self._active_subwindow_title

    def update_active_subwindow(self, workspace: str, subwindow: Optional[QMdiSubWindow]) -> None:
        if workspace:
            self.set_active_workspace(workspace)
        title = ""
        if subwindow is not None:
            title = subwindow.windowTitle() or ""
        if title == self._active_subwindow_title:
            return
        self._active_subwindow_title = title
        self.active_subwindow_title_changed.emit(self._active_subwindow_title)
