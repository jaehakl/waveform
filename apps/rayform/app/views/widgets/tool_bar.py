from __future__ import annotations

from typing import Optional
from PySide6.QtCore import Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QToolBar
from models import GeometryRole

class ToolBar:
    """툴바 관리 클래스"""

    def __init__(self, main_window):
        actions = main_window.actions_manager.actions
        tool_bar = main_window.addToolBar("Main")
        tool_bar.setMovable(True)

        tool_bar.addAction(actions.get("save_cgs"))
        tool_bar.addAction(actions.get("load_cgs"))
        tool_bar.addAction(actions.get("tile_mdi"))
        tool_bar.addAction(actions.get("cascade_mdi"))
        tool_bar.addAction(actions.get("union"))
        tool_bar.addAction(actions.get("intersect"))
        tool_bar.addAction(actions.get("subtract"))
        tool_bar.addAction(actions.get("test_rays"))
        main_window.addToolBar(Qt.TopToolBarArea, tool_bar)