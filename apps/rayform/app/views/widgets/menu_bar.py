from __future__ import annotations

from typing import Optional
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QMenuBar, QFileDialog


class MenuBar:
    """메뉴바 관리 클래스"""

    def __init__(self, main_window):
        menu_bar = main_window.menuBar()
        actions = main_window.actions_manager.actions    

        file_menu = menu_bar.addMenu("File")
        file_menu.addAction(actions.get("save_cgs"))
        file_menu.addAction(actions.get("load_cgs"))
        file_menu.addAction(actions.get("load_example"))
        file_menu.addSeparator()
        file_menu.addAction(actions.get("exit"))

        window_menu = menu_bar.addMenu("Window")    
        window_menu.addAction(actions.get("tile_mdi"))
        window_menu.addAction(actions.get("cascade_mdi"))        
        window_menu.addSeparator()        
        window_menu.addAction(actions.get("cgs_string_viewer"))