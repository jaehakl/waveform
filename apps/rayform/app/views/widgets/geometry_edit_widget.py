from __future__ import annotations

from typing import Optional, List

from PySide6.QtCore import QObject, Signal, Qt, QEvent
from PySide6.QtWidgets import (
    QWidget,
    QFormLayout,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QDoubleSpinBox,
    QComboBox,
    QGroupBox,
    QPushButton,
)

from models import GeometryNode, GeometryRole, GeometryType


class GeometryEditWidget(QWidget):
    """선택된 GeometryNode(_selected_node_1)를 편집하는 에디터.
    - ApplicationViewModel.selected_node1_changed를 구독하여 UI를 갱신
    - 에디터가 blur(포커스 아웃)되면 즉시 update_geometry_node 호출
    """

    def __init__(self, app_view_model, workspace: str, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._app_vm = app_view_model
        self._workspace = workspace
        self._current_index: int = -1
        self._current_node: Optional[GeometryNode] = None
        self._programmatic_updating: bool = False

        self._build_ui()
        self._connect_signals()

    # ------------------------------------------------------------------ UI
    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        title = QLabel("Geometry Editor")
        title.setStyleSheet("font-weight: bold;")
        layout.addWidget(title)

        form_group = QGroupBox("Selected Node")
        form_layout = QFormLayout(form_group)
        form_layout.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        # Role
        self._role_combo = QComboBox()
        for role in GeometryRole:
            self._role_combo.addItem(role.value, role)
        form_layout.addRow("Role", self._role_combo)

        # Material
        self._material_edit = QLineEdit()
        form_layout.addRow("Material", self._material_edit)

        # Position
        self._pos_edits: List[QDoubleSpinBox] = [self._make_spin(-1e9, 1e9) for _ in range(3)]
        pos_row = self._make_xyz_row(self._pos_edits)
        form_layout.addRow("Position", pos_row)

        # Rotation
        self._rot_edits: List[QDoubleSpinBox] = [self._make_spin(-1e9, 1e9) for _ in range(3)]
        rot_row = self._make_xyz_row(self._rot_edits)
        form_layout.addRow("Rotation", rot_row)

        # Size
        self._size_edits: List[QDoubleSpinBox] = [self._make_spin(0.0, 1e9) for _ in range(3)]
        size_row = self._make_xyz_row(self._size_edits)
        form_layout.addRow("Size", size_row)

        # Geometry type (읽기 전용: 하위 트리인 경우 변경 방지)
        self._geom_type_combo = QComboBox()
        for gt in GeometryType:
            self._geom_type_combo.addItem(gt.value, gt)
        self._geom_type_combo.setEnabled(False)
        form_layout.addRow("Type", self._geom_type_combo)

        layout.addWidget(form_group)

        # Apply 버튼: 클릭 시에만 변경 사항 적용
        self._apply_btn = QPushButton("Apply")
        layout.addWidget(self._apply_btn)

        # 편집자 모음 (focusOut 감지를 위해)
        self._editors = [
            self._role_combo,
            self._material_edit,
            *self._pos_edits,
            *self._rot_edits,
            *self._size_edits,
            self._geom_type_combo,
        ]
        for w in self._editors:
            w.installEventFilter(self)

        self._set_enabled(False)

    def _make_spin(self, vmin: float, vmax: float) -> QDoubleSpinBox:
        spin = QDoubleSpinBox()
        spin.setRange(vmin, vmax)
        spin.setDecimals(6)
        spin.setSingleStep(0.1)
        return spin

    def _make_xyz_row(self, spins: List[QDoubleSpinBox]) -> QWidget:
        row = QWidget()
        h = QHBoxLayout(row)
        h.setContentsMargins(0, 0, 0, 0)
        h.setSpacing(6)
        labels = [QLabel("X"), QLabel("Y"), QLabel("Z")]
        for lab, sp in zip(labels, spins):
            h.addWidget(lab)
            h.addWidget(sp)
        return row

    # -------------------------------------------------------------- signals
    def _connect_signals(self) -> None:
        if self._app_vm is None:
            return
        # 선택 변경 감지
        if hasattr(self._app_vm, "selected_node1_changed"):
            self._app_vm.selected_node1_changed.connect(self._on_selected_node1_changed)
        # Apply 버튼 클릭 시에만 적용
        self._apply_btn.clicked.connect(self._apply_changes)


    # ------------------------------------------------------------- updates
    def _on_selected_node1_changed(self, workspace: str, node: Optional[GeometryNode], index: int) -> None:
        if workspace != self._workspace:
            return
        self._current_index = index if index is not None else -1
        self._current_node = node if isinstance(node, GeometryNode) else None
        self._populate_from_node(self._current_node)

    def _populate_from_node(self, node: Optional[GeometryNode]) -> None:
        self._programmatic_updating = True
        try:
            if node is None or self._current_index < 0:
                self._set_enabled(False)
                self._clear_fields()
                return
            self._set_enabled(True)

            # Role
            role_idx = max(0, self._role_combo.findText(node.role.value))
            self._role_combo.setCurrentIndex(role_idx)

            # Material
            self._material_edit.setText(node.material or "")

            # Position / Rotation / Size
            for sp, val in zip(self._pos_edits, node.pos or [0, 0, 0]):
                sp.setValue(float(val))
            for sp, val in zip(self._rot_edits, node.rotation or [0, 0, 0]):
                sp.setValue(float(val))
            for sp, val in zip(self._size_edits, node.size or [0, 0, 0]):
                sp.setValue(float(val))

            # Geometry type (읽기 전용 표시)
            gt_idx = max(0, self._geom_type_combo.findText(node.geometry_type.value))
            self._geom_type_combo.setCurrentIndex(gt_idx)
        finally:
            self._programmatic_updating = False

    def _clear_fields(self) -> None:
        self._role_combo.setCurrentIndex(0)
        self._material_edit.clear()
        for sp in (*self._pos_edits, *self._rot_edits, *self._size_edits):
            sp.setValue(0.0)
        self._geom_type_combo.setCurrentIndex(0)

    def _set_enabled(self, enabled: bool) -> None:
        for w in self._editors:
            w.setEnabled(enabled)

    # ------------------------------------------------------------ apply API
    def _apply_changes(self) -> None:
        if self._programmatic_updating:
            return
        if self._app_vm is None or self._current_node is None or self._current_index < 0:
            return

        # 현재 UI 값으로 GeometryNode 재구성
        try:
            new_role: GeometryRole = self._role_combo.currentData() or self._current_node.role
            new_geometry_type: GeometryType = self._geom_type_combo.currentData() or self._current_node.geometry_type
            new_geometry: str = new_geometry_type.value if new_geometry_type != GeometryType.TREE else self._current_node.geometry
            new_material: str = self._material_edit.text() or self._current_node.material
            new_pos = [sp.value() for sp in self._pos_edits]
            new_rot = [sp.value() for sp in self._rot_edits]
            new_size = [sp.value() for sp in self._size_edits]

            updated = GeometryNode(
                role=new_role,
                geometry_type=new_geometry_type,
                geometry=new_geometry,
                pos=new_pos,
                rotation=new_rot,
                size=new_size,
                material=new_material,
            )
        except Exception:
            # 변환 실패 시 적용하지 않음
            return

        # 즉시 ViewModel에 적용
        self._app_vm.update_geometry_node(self._workspace, self._current_index, updated)

