from __future__ import annotations

from typing import Callable, Dict, Optional, Any, List, Union

from PySide6.QtCore import Signal, QObject


from models import CGSTree, GeometryNode, GeometryRole, GeometryType, WorkspaceData
from viewmodels.services.ui_service import UIService
from viewmodels.services.workspace_service import WorkspaceService
from viewmodels.services.geometry_service import GeometryService
from viewmodels.services.parameters_service import ParametersService
from viewmodels.services.helpers import ViewModelHelpers as Helpers

class ApplicationViewModel(QObject):
    """Expose application level state to the views."""
    state_changed = Signal()

    status_message_changed = Signal(str)
    active_workspace_changed = Signal(str)
    active_subwindow_title_changed = Signal(str)
    _workspace_data_loaded = Signal(str)  # workspace_name
    selected_node1_changed = Signal(str, Any, int)  # workspace_name, node, index
    selected_node2_changed = Signal(str, Any, int)  # workspace_name, node, index
    selected_nodes_changed = Signal(str, Any, int, Any, int)  # workspace_name, node1, idx1, node2, idx2
    
    # Workspace data signals
    data_changed = Signal(str, object)  # workspace_name, data
    cgs_tree_changed = Signal(str, list)  # workspace_name, cgs_tree
    parameters_changed = Signal(str, dict)  # workspace_name, parameters
    materials_changed = Signal(str, dict)  # workspace_name, materials
    
    # 메뉴바에서 요청하는 시그널들
    request_tile_mdi = Signal()
    request_cascade_mdi = Signal()
    request_create_subwindow = Signal(str, str) # workspace_name, subwindow_type

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._status_message: str = ""
        self._active_workspace: str = ""
        self._active_subwindow_title: str = ""
        # Dual selection state
        self._selected_node_1: Optional[Any] = None
        self._selected_node_1_index: int = -1
        self._selected_node_2: Optional[Any] = None
        self._selected_node_2_index: int = -1
        self._workspace_data: Dict[str, WorkspaceData] = {}

    # -- helpers ------------------------------------------------------------
    def _set_and_emit(self, attr_name: str, value: Any, signal: Optional[Signal] = None) -> bool: Helpers._set_and_emit(self, attr_name, value, signal)
    def status_message(self) -> str: return self._status_message
    def set_status_message(self, message: str) -> None: Helpers.set_status_message(self, message)
    def _notify_workspace_data(self, workspace_name: str, workspace_data: WorkspaceData) -> None: Helpers._notify_workspace_data(self, workspace_name, workspace_data)

    # -- workspace -----------------------------------------------------------
    def active_workspace(self) -> str: return self._active_workspace
    def set_active_workspace(self, name: str) -> None: UIService.set_active_workspace(self, name)
    def active_subwindow_title(self) -> str: return self._active_subwindow_title
    def set_active_subwindow_title(self, title: str) -> None: UIService.set_active_subwindow_title(self, title)
    def workspace_names(self) -> list[str]: return list(self._workspace_data.keys())
    def get_workspace_data(self, name: str) -> Optional[WorkspaceData]: return self._workspace_data.get(name)        
    def ensure_workspace(self, name: str) -> WorkspaceData: return WorkspaceService.ensure_workspace(self, name)

    # -- workspace commands -------------------------------------------------
    def workspace_has_persistable_data(self, name: str) -> bool: return WorkspaceService.workspace_has_persistable_data(self, name)
    def save_workspace_to_file(self, name: str, file_path: str) -> None: return WorkspaceService.save_workspace_to_file(self, name, file_path)
    def load_workspace_from_file(self, name: str, file_path: str) -> None: return WorkspaceService.load_workspace_from_file(self, name, file_path)
    def load_workspace_example_data(self, name: str) -> None: return WorkspaceService.load_workspace_example_data(self, name)
    def save_workspace_via_dialog(self,workspace: Optional[str],prompt_save: Callable[[str, str], Optional[str]]) -> None: return WorkspaceService.save_workspace_via_dialog(self, workspace, prompt_save)
    def load_workspace_via_dialog(self, workspace: Optional[str], prompt_open: Callable[[str], Optional[str]]) -> bool: return WorkspaceService.load_workspace_via_dialog(self, workspace, prompt_open)
    def apply_workspace_example_data(self, workspace: Optional[str]) -> bool: return WorkspaceService.apply_workspace_example_data(self, workspace)
    def save_workspace_data(self, workspace: str, file_path: str) -> None: return WorkspaceService.save_workspace_data(self, workspace, file_path)
    def load_workspace_data(self, workspace: str, file_path: str) -> None: return WorkspaceService.load_workspace_data(self, workspace, file_path)
    def load_example_data(self, workspace: Optional[str]) -> None: return WorkspaceService.load_example_data(self, workspace)

    # -- geometry operations ------------------------------------------------
    def add_primitive_geometry(self, workspace: str, geometry: str = "sphere") -> int: return GeometryService.add_primitive_geometry(self, workspace, geometry)
    def remove_geometry_node(self, workspace: str, index: int) -> bool: return GeometryService.remove_geometry_node(self, workspace, index)
    def update_geometry_node(self, workspace: str, index: int, node: GeometryNode) -> bool: return GeometryService.update_geometry_node(self, workspace, index, node)
    def move_geometry_node(self, workspace: str, from_index: int, to_index: int) -> bool: return GeometryService.move_geometry_node(self, workspace, from_index, to_index)
    def merge_geometry_nodes(self, workspace: str, operation: GeometryRole, index1: int, index2: int) -> bool: return GeometryService.merge_geometry_nodes(self, workspace, operation, index1, index2)
    
    # -- parameters/materials ----------------------------------------------
    def update_parameters(self, workspace: str, parameters: Dict[str, object]) -> None: return ParametersService.update_parameters(self, workspace, parameters)
    def update_materials(self, workspace: str, materials: Dict[str, Dict[float, complex]]) -> None: return ParametersService.update_materials(self, workspace, materials)
    def update_material(self, workspace: str, material_id: str, wavelength_data: Dict[float, complex]) -> None: return ParametersService.update_material(self, workspace, material_id, wavelength_data)
    def remove_material(self, workspace: str, material_id: str) -> None: return ParametersService.remove_material(self, workspace, material_id)
    def replace_cgs_tree(self, workspace: str, nodes: List[GeometryNode]) -> None: return ParametersService.replace_cgs_tree(self, workspace, nodes)

    # -- mdi title -----------------------------------------------------------
    # Dual selection getters
    def selected_node_1(self) -> Optional[Any]: return self._selected_node_1
    def selected_node_1_index(self) -> int: return self._selected_node_1_index
    def selected_node_2(self) -> Optional[Any]: return self._selected_node_2
    def selected_node_2_index(self) -> int: return self._selected_node_2_index
    # Unified handler for click selection with modifier
    def handle_node_click(self, workspace: str, node: Optional[Any], index: int, ctrl_pressed: bool) -> None: UIService.handle_node_click(self, workspace, node, index, ctrl_pressed)

    # -- MDI commands ---------------------------------------------------------
    def handle_tile_mdi_request(self) -> None: self.request_tile_mdi.emit()
    def handle_cascade_mdi_request(self) -> None: self.request_cascade_mdi.emit()
        
