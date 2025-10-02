from __future__ import annotations

from typing import Optional, Dict, Any, List, Union
from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QGroupBox,
    QLabel, QComboBox, QLineEdit, QSpinBox, QDoubleSpinBox,
    QPushButton, QTabWidget, QTableWidget, QTableWidgetItem,
    QHeaderView, QScrollArea, QSplitter, QTextEdit
)
from PySide6.QtGui import QFont

from models import WorkspaceData, GeometryNode, GeometryRole, GeometryType


class GeometryNodeEditor(QWidget):
    """Geometry Node 편집 위젯"""
    
    node_updated = Signal(GeometryNode, int)  # 업데이트된 노드와 인덱스
    
    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._current_node: Optional[GeometryNode] = None
        self._current_index: int = -1
        self._setup_ui()
        self._connect_signals()
    
    def _setup_ui(self):
        """UI 구성"""
        layout = QVBoxLayout(self)
        
        # Geometry Node 편집 그룹
        geometry_group = QGroupBox("Geometry Node")
        geometry_layout = QFormLayout(geometry_group)
        
        # Role 선택
        self._role_combo = QComboBox()
        self._role_combo.addItems([role.value for role in GeometryRole])
        geometry_layout.addRow("Role:", self._role_combo)
        
        # Geometry Type 선택
        self._geometry_type_combo = QComboBox()
        self._geometry_type_combo.addItems([gt.value for gt in GeometryType])
        geometry_layout.addRow("Geometry Type:", self._geometry_type_combo)
        
        # Material 입력
        self._material_edit = QLineEdit()
        geometry_layout.addRow("Material:", self._material_edit)
        
        # Position 입력
        pos_layout = QHBoxLayout()
        self._pos_x_edit = QLineEdit()
        self._pos_y_edit = QLineEdit()
        self._pos_z_edit = QLineEdit()
        pos_layout.addWidget(QLabel("X:"))
        pos_layout.addWidget(self._pos_x_edit)
        pos_layout.addWidget(QLabel("Y:"))
        pos_layout.addWidget(self._pos_y_edit)
        pos_layout.addWidget(QLabel("Z:"))
        pos_layout.addWidget(self._pos_z_edit)
        geometry_layout.addRow("Position:", pos_layout)
        
        # Rotation 입력
        rot_layout = QHBoxLayout()
        self._rot_x_edit = QLineEdit()
        self._rot_y_edit = QLineEdit()
        self._rot_z_edit = QLineEdit()
        rot_layout.addWidget(QLabel("X:"))
        rot_layout.addWidget(self._rot_x_edit)
        rot_layout.addWidget(QLabel("Y:"))
        rot_layout.addWidget(self._rot_y_edit)
        rot_layout.addWidget(QLabel("Z:"))
        rot_layout.addWidget(self._rot_z_edit)
        geometry_layout.addRow("Rotation:", rot_layout)
        
        # 업데이트 버튼
        self._update_button = QPushButton("Update Node")
        self._update_button.clicked.connect(self._update_node)
        geometry_layout.addRow(self._update_button)
        
        layout.addWidget(geometry_group)
        
        # 초기 상태 설정
        self._set_enabled(False)
    
    def _connect_signals(self):
        """시그널 연결"""
        pass
    
    def _set_enabled(self, enabled: bool):
        """위젯 활성화/비활성화"""
        self._role_combo.setEnabled(enabled)
        self._geometry_type_combo.setEnabled(enabled)
        self._material_edit.setEnabled(enabled)
        self._pos_x_edit.setEnabled(enabled)
        self._pos_y_edit.setEnabled(enabled)
        self._pos_z_edit.setEnabled(enabled)
        self._rot_x_edit.setEnabled(enabled)
        self._rot_y_edit.setEnabled(enabled)
        self._rot_z_edit.setEnabled(enabled)
        self._update_button.setEnabled(enabled)
    
    def set_node(self, node: Optional[GeometryNode], index: int = -1):
        """편집할 노드 설정"""
        self._current_node = node
        self._current_index = index
        
        if node is None:
            self._set_enabled(False)
            self._clear_fields()
            return
        
        self._set_enabled(True)
        self._populate_fields(node)
    
    def _populate_fields(self, node: GeometryNode):
        """필드에 노드 데이터 채우기"""
        self._role_combo.setCurrentText(node.role.value)
        self._geometry_type_combo.setCurrentText(node.geometry_type.value)
        self._material_edit.setText(node.material)
        
        # Position
        if len(node.pos) >= 3:
            self._pos_x_edit.setText(str(node.pos[0]))
            self._pos_y_edit.setText(str(node.pos[1]))
            self._pos_z_edit.setText(str(node.pos[2]))
        
        # Rotation
        if len(node.rotation) >= 3:
            self._rot_x_edit.setText(str(node.rotation[0]))
            self._rot_y_edit.setText(str(node.rotation[1]))
            self._rot_z_edit.setText(str(node.rotation[2]))
    
    def _clear_fields(self):
        """필드 초기화"""
        self._role_combo.setCurrentIndex(0)
        self._geometry_type_combo.setCurrentIndex(0)
        self._material_edit.clear()
        self._pos_x_edit.clear()
        self._pos_y_edit.clear()
        self._pos_z_edit.clear()
        self._rot_x_edit.clear()
        self._rot_y_edit.clear()
        self._rot_z_edit.clear()
    
    def _update_node(self):
        """노드 업데이트"""
        if self._current_node is None or self._current_index < 0:
            return
        
        try:
            # 새로운 노드 생성
            updated_node = GeometryNode(
                role=GeometryRole(self._role_combo.currentText()),
                geometry_type=GeometryType(self._geometry_type_combo.currentText()),
                geometry=self._current_node.geometry,  # 기존 geometry 유지
                pos=[
                    self._pos_x_edit.text(),
                    self._pos_y_edit.text(),
                    self._pos_z_edit.text()
                ],
                rotation=[
                    self._rot_x_edit.text(),
                    self._rot_y_edit.text(),
                    self._rot_z_edit.text()
                ],
                material=self._material_edit.text()
            )
            
            self.node_updated.emit(updated_node, self._current_index)
            
        except Exception as e:
            print(f"Error updating node: {e}")


class ParametersEditor(QWidget):
    """Parameters 편집 위젯"""
    
    parameters_updated = Signal(Dict[str, Union[float, str]])  # 업데이트된 파라미터들
    
    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._parameters: Dict[str, Union[float, str]] = {}
        self._setup_ui()
        self._connect_signals()
    
    def _setup_ui(self):
        """UI 구성"""
        layout = QVBoxLayout(self)
        
        # Parameters 그룹
        params_group = QGroupBox("Parameters")
        params_layout = QVBoxLayout(params_group)
        
        # 파라미터 테이블
        self._params_table = QTableWidget()
        self._params_table.setColumnCount(2)
        self._params_table.setHorizontalHeaderLabels(["Parameter", "Value"])
        self._params_table.horizontalHeader().setStretchLastSection(True)
        self._params_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        params_layout.addWidget(self._params_table)
        
        # 버튼들
        button_layout = QHBoxLayout()
        self._add_param_button = QPushButton("Add Parameter")
        self._remove_param_button = QPushButton("Remove Parameter")
        self._update_params_button = QPushButton("Update Parameters")
        
        button_layout.addWidget(self._add_param_button)
        button_layout.addWidget(self._remove_param_button)
        button_layout.addWidget(self._update_params_button)
        button_layout.addStretch()
        
        params_layout.addLayout(button_layout)
        layout.addWidget(params_group)
    
    def _connect_signals(self):
        """시그널 연결"""
        self._add_param_button.clicked.connect(self._add_parameter)
        self._remove_param_button.clicked.connect(self._remove_parameter)
        self._update_params_button.clicked.connect(self._update_parameters)
    
    def set_parameters(self, parameters: Dict[str, Union[float, str]]):
        """파라미터 설정"""
        self._parameters = parameters.copy()
        self._refresh_table()
    
    def _refresh_table(self):
        """테이블 새로고침"""
        self._params_table.setRowCount(len(self._parameters))
        
        for i, (name, value) in enumerate(self._parameters.items()):
            self._params_table.setItem(i, 0, QTableWidgetItem(name))
            self._params_table.setItem(i, 1, QTableWidgetItem(str(value)))
    
    def _add_parameter(self):
        """파라미터 추가"""
        row_count = self._params_table.rowCount()
        self._params_table.insertRow(row_count)
        self._params_table.setItem(row_count, 0, QTableWidgetItem(""))
        self._params_table.setItem(row_count, 1, QTableWidgetItem(""))
    
    def _remove_parameter(self):
        """선택된 파라미터 제거"""
        current_row = self._params_table.currentRow()
        if current_row >= 0:
            self._params_table.removeRow(current_row)
    
    def _update_parameters(self):
        """파라미터 업데이트"""
        new_parameters = {}
        
        for row in range(self._params_table.rowCount()):
            name_item = self._params_table.item(row, 0)
            value_item = self._params_table.item(row, 1)
            
            if name_item and value_item:
                name = name_item.text().strip()
                value_str = value_item.text().strip()
                
                if name and value_str:
                    # 숫자로 변환 시도
                    try:
                        if '.' in value_str or 'e' in value_str.lower():
                            new_parameters[name] = float(value_str)
                        else:
                            new_parameters[name] = int(value_str)
                    except ValueError:
                        # 숫자로 변환할 수 없으면 문자열로 저장
                        new_parameters[name] = value_str
        
        self._parameters = new_parameters
        self.parameters_updated.emit(self._parameters)


class MaterialsEditor(QWidget):
    """Materials 편집 위젯"""
    
    materials_updated = Signal(Dict[str, Dict[float, complex]])  # 업데이트된 재료들
    
    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._materials: Dict[str, Dict[float, complex]] = {}
        self._setup_ui()
        self._connect_signals()
    
    def _setup_ui(self):
        """UI 구성"""
        layout = QVBoxLayout(self)
        
        # Materials 그룹
        materials_group = QGroupBox("Materials")
        materials_layout = QVBoxLayout(materials_group)
        
        # 재료 선택 콤보박스
        self._material_combo = QComboBox()
        materials_layout.addWidget(QLabel("Select Material:"))
        materials_layout.addWidget(self._material_combo)
        
        # 재료 데이터 테이블
        self._materials_table = QTableWidget()
        self._materials_table.setColumnCount(3)
        self._materials_table.setHorizontalHeaderLabels(["Wavelength", "n (real)", "k (imag)"])
        self._materials_table.horizontalHeader().setStretchLastSection(True)
        self._materials_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        materials_layout.addWidget(self._materials_table)
        
        # 버튼들
        button_layout = QHBoxLayout()
        self._add_material_button = QPushButton("Add Material")
        self._remove_material_button = QPushButton("Remove Material")
        self._add_data_button = QPushButton("Add Data Point")
        self._remove_data_button = QPushButton("Remove Data Point")
        self._update_materials_button = QPushButton("Update Materials")
        
        button_layout.addWidget(self._add_material_button)
        button_layout.addWidget(self._remove_material_button)
        button_layout.addWidget(self._add_data_button)
        button_layout.addWidget(self._remove_data_button)
        button_layout.addWidget(self._update_materials_button)
        button_layout.addStretch()
        
        materials_layout.addLayout(button_layout)
        layout.addWidget(materials_group)
    
    def _connect_signals(self):
        """시그널 연결"""
        self._add_material_button.clicked.connect(self._add_material)
        self._remove_material_button.clicked.connect(self._remove_material)
        self._add_data_button.clicked.connect(self._add_data_point)
        self._remove_data_button.clicked.connect(self._remove_data_point)
        self._update_materials_button.clicked.connect(self._update_materials)
        self._material_combo.currentTextChanged.connect(self._on_material_changed)
    
    def set_materials(self, materials: Dict[str, Dict[float, complex]]):
        """재료 데이터 설정"""
        self._materials = materials.copy()
        self._refresh_material_combo()
    
    def _refresh_material_combo(self):
        """재료 콤보박스 새로고침"""
        self._material_combo.clear()
        self._material_combo.addItems(list(self._materials.keys()))
    
    def _on_material_changed(self, material_id: str):
        """재료 변경 시"""
        if material_id in self._materials:
            self._refresh_materials_table(self._materials[material_id])
        else:
            self._materials_table.setRowCount(0)
    
    def _refresh_materials_table(self, data: Dict[float, complex]):
        """재료 데이터 테이블 새로고침"""
        self._materials_table.setRowCount(len(data))
        
        for i, (wavelength, nk) in enumerate(sorted(data.items())):
            self._materials_table.setItem(i, 0, QTableWidgetItem(str(wavelength)))
            self._materials_table.setItem(i, 1, QTableWidgetItem(str(nk.real)))
            self._materials_table.setItem(i, 2, QTableWidgetItem(str(nk.imag)))
    
    def _add_material(self):
        """재료 추가"""
        material_id = f"Material_{len(self._materials) + 1}"
        self._materials[material_id] = {}
        self._refresh_material_combo()
        self._material_combo.setCurrentText(material_id)
    
    def _remove_material(self):
        """재료 제거"""
        current_material = self._material_combo.currentText()
        if current_material in self._materials:
            del self._materials[current_material]
            self._refresh_material_combo()
            if self._material_combo.count() > 0:
                self._material_combo.setCurrentIndex(0)
            else:
                self._materials_table.setRowCount(0)
    
    def _add_data_point(self):
        """데이터 포인트 추가"""
        current_material = self._material_combo.currentText()
        if current_material in self._materials:
            row_count = self._materials_table.rowCount()
            self._materials_table.insertRow(row_count)
            self._materials_table.setItem(row_count, 0, QTableWidgetItem(""))
            self._materials_table.setItem(row_count, 1, QTableWidgetItem(""))
            self._materials_table.setItem(row_count, 2, QTableWidgetItem(""))
    
    def _remove_data_point(self):
        """데이터 포인트 제거"""
        current_row = self._materials_table.currentRow()
        if current_row >= 0:
            self._materials_table.removeRow(current_row)
    
    def _update_materials(self):
        """재료 데이터 업데이트"""
        current_material = self._material_combo.currentText()
        if current_material not in self._materials:
            return
        
        new_data = {}
        
        for row in range(self._materials_table.rowCount()):
            wl_item = self._materials_table.item(row, 0)
            n_item = self._materials_table.item(row, 1)
            k_item = self._materials_table.item(row, 2)
            
            if wl_item and n_item and k_item:
                try:
                    wavelength = float(wl_item.text())
                    n = float(n_item.text())
                    k = float(k_item.text())
                    new_data[wavelength] = complex(n, k)
                except ValueError:
                    continue
        
        self._materials[current_material] = new_data
        self.materials_updated.emit(self._materials)


class EditorPanel(QWidget):
    """메인 편집 패널"""
    
    data_updated = Signal(str, WorkspaceData)  # workspace 이름과 업데이트된 데이터
    
    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._current_workspace: str = ""
        self._app_view_model = None  # ApplicationViewModel 참조
        self._app_view_model_connected: bool = False
        self._syncing_from_view_model: bool = False
        self._setup_ui()
        self._connect_signals()
    
    def _setup_ui(self):
        """UI 구성"""
        layout = QVBoxLayout(self)
        
        # 탭 위젯
        self._tab_widget = QTabWidget()
        
        # Geometry Node 편집 탭
        self._geometry_editor = GeometryNodeEditor()
        self._tab_widget.addTab(self._geometry_editor, "Geometry Node")
        
        # Parameters 편집 탭
        self._parameters_editor = ParametersEditor()
        self._tab_widget.addTab(self._parameters_editor, "Parameters")
        
        # Materials 편집 탭
        self._materials_editor = MaterialsEditor()
        self._tab_widget.addTab(self._materials_editor, "Materials")
        
        layout.addWidget(self._tab_widget)
    
    def _connect_signals(self):
        """시그널 연결"""
        self._geometry_editor.node_updated.connect(self._on_node_updated)
        self._parameters_editor.parameters_updated.connect(self._on_parameters_updated)
        self._materials_editor.materials_updated.connect(self._on_materials_updated)

    def set_view_model(self, view_model) -> None:
        """Deprecated: Use set_app_view_model instead"""
        pass

    def set_app_view_model(self, app_view_model) -> None:
        """ApplicationViewModel 주입"""
        if self._app_view_model is app_view_model:
            return
        self._disconnect_app_view_model()
        self._app_view_model = app_view_model
        if self._app_view_model is not None:
            self._connect_app_view_model()    


    def set_workspace(self, workspace: str) -> None:
        """현재 workspace 설정"""
        self._current_workspace = workspace
        if self._app_view_model is not None:
            self._connect_app_view_model()
            self._sync_from_view_model()



    def _connect_app_view_model(self) -> None:
        if self._app_view_model is None or self._app_view_model_connected:
            return
        self._app_view_model.selected_node_changed.connect(self._on_selected_node_changed)
        self._app_view_model.data_changed.connect(self._on_app_view_model_data_changed)
        self._app_view_model.parameters_changed.connect(self._on_app_view_model_parameters_changed)
        self._app_view_model.materials_changed.connect(self._on_app_view_model_materials_changed)
        self._app_view_model._workspace_data_loaded.connect(self._on_workspace_data_loaded)
        self._app_view_model_connected = True

    def _disconnect_app_view_model(self) -> None:
        if self._app_view_model is None or not self._app_view_model_connected:
            return
        try:
            self._app_view_model.selected_node_changed.disconnect(self._on_selected_node_changed)
        except (TypeError, RuntimeError):
            pass
        try:
            self._app_view_model.data_changed.disconnect(self._on_app_view_model_data_changed)
        except (TypeError, RuntimeError):
            pass
        try:
            self._app_view_model.parameters_changed.disconnect(self._on_app_view_model_parameters_changed)
        except (TypeError, RuntimeError):
            pass
        try:
            self._app_view_model.materials_changed.disconnect(self._on_app_view_model_materials_changed)
        except (TypeError, RuntimeError):
            pass
        try:
            self._app_view_model._workspace_data_loaded.disconnect(self._on_workspace_data_loaded)
        except (TypeError, RuntimeError):
            pass
        self._app_view_model_connected = False

    def _on_selected_node_changed(self, workspace: str, node, index: int) -> None:
        """선택된 노드가 변경되었을 때"""
        if workspace == self._current_workspace:
            self._geometry_editor.set_node(node, index)

    def _on_app_view_model_data_changed(self, workspace: str, data: WorkspaceData) -> None:
        """ApplicationViewModel에서 데이터가 변경되었을 때"""
        if workspace == self._current_workspace:
            self._sync_from_view_model()

    def _on_app_view_model_parameters_changed(self, workspace: str, parameters: Dict[str, Any]) -> None:
        """ApplicationViewModel에서 파라미터가 변경되었을 때"""
        if workspace == self._current_workspace:
            self._parameters_editor.set_parameters(parameters)

    def _on_app_view_model_materials_changed(self, workspace: str, materials: Dict[str, Dict[float, complex]]) -> None:
        """ApplicationViewModel에서 재료가 변경되었을 때"""
        if workspace == self._current_workspace:
            self._materials_editor.set_materials(materials)

    def _on_view_model_data_changed(self, data: WorkspaceData) -> None:
        if self._syncing_from_view_model:
            return
        self._sync_from_view_model()

    def _sync_from_view_model(self) -> None:
        if self._app_view_model is None or not self._current_workspace:
            return
        self._syncing_from_view_model = True
        try:
            data = self._app_view_model.get_workspace_data(self._current_workspace)
            if data is not None:
                self._parameters_editor.set_parameters(dict(data.parameters))
                materials_copy = {key: dict(values) for key, values in data.materials.items()}
                self._materials_editor.set_materials(materials_copy)
        finally:
            self._syncing_from_view_model = False

    def _on_workspace_data_loaded(self, workspace: str) -> None:
        """Workspace 데이터 로드 후 편집 패널 새로고침"""
        if workspace == self._current_workspace:
            self._sync_from_view_model()

    def set_workspace(self, workspace: str):
        """workspace 설정"""
        self._current_workspace = workspace
    
    def set_selected_node(self, node: Optional[GeometryNode], index: int = -1):
        """선택된 노드 설정"""
        self._geometry_editor.set_node(node, index)
    
    def _on_node_updated(self, node: GeometryNode, index: int):
        """노드 업데이트 시"""
        if not self._current_workspace or self._app_view_model is None:
            return

        success = self._app_view_model.update_geometry_node(self._current_workspace, index, node)
        if success:
            workspace_data = self._app_view_model.get_workspace_data(self._current_workspace)
            self.data_updated.emit(self._current_workspace, workspace_data)
    
    def _on_parameters_updated(self, parameters: Dict[str, Union[float, str]]):
        """파라미터 업데이트 시"""
        if not self._current_workspace or self._app_view_model is None:
            return

        self._app_view_model.update_parameters(self._current_workspace, parameters)
        workspace_data = self._app_view_model.get_workspace_data(self._current_workspace)
        self.data_updated.emit(self._current_workspace, workspace_data)
    
    def _on_materials_updated(self, materials: Dict[str, Dict[float, complex]]):
        """재료 데이터 업데이트 시"""
        if not self._current_workspace or self._app_view_model is None:
            return

        self._app_view_model.update_materials(self._current_workspace, materials)
        workspace_data = self._app_view_model.get_workspace_data(self._current_workspace)
        self.data_updated.emit(self._current_workspace, workspace_data)
