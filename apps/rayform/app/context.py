from __future__ import annotations

from typing import Dict, Optional

from PySide6.QtCore import QObject, Signal
from PySide6.QtWidgets import QMainWindow, QMdiArea, QMdiSubWindow, QWidget, QTabWidget

from models import WorkspaceData


class Context(QObject):
    """
    workspace data : {
        "workspace_name": {
            "cgs_tree":     [
                {
                    role : union,
                    geometry : primitive_geometry or [ {}, {}, ... {}],		
                    pos: [0,0,$a],
                    rotation: [0,0,0],
                    material: SiO2
                }, ... ],
            "parameters": {
                "a": 10,
                "b": %10~20 (random, sweep)
            },
            "materials": {
                "SiO2": { wavelength vs nk map (nearest neighbor 값 사용) }
            }
        }
    }
    """
    _instance: Optional["Context"] = None
    workspace_data_changed = Signal(str)

    def __new__(cls) -> "Context":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return
        super().__init__()
        self._initialized = True
        self.workspace_data: Dict[str, WorkspaceData] = {}

    def set_workspace_data(self, workspace: str, data: WorkspaceData) -> None:
        self.workspace_data[workspace] = data
        self.workspace_data_changed.emit(workspace)

    def get_workspace_data(self, workspace: str) -> WorkspaceData:
        return self.workspace_data.get(workspace, WorkspaceData())
    
    def get_or_create_workspace_data(self, workspace: str) -> WorkspaceData:
        """workspace 데이터를 가져오거나 새로 생성"""
        if workspace not in self.workspace_data:
            self.workspace_data[workspace] = WorkspaceData()
        return self.workspace_data[workspace]