from __future__ import annotations

from typing import Optional, List
from PySide6.QtCore import Qt, Signal, QModelIndex, QSignalBlocker
from PySide6.QtWidgets import (
    QTreeWidget, QTreeWidgetItem, QWidget, QVBoxLayout, 
    QHBoxLayout, QPushButton, QLabel, QComboBox, QLineEdit,
    QSpinBox, QDoubleSpinBox, QGroupBox, QSplitter, QScrollArea,
    QMenu, QMessageBox
)
from PySide6.QtGui import QFont, QAction

from models import WorkspaceData, GeometryNode, GeometryRole, GeometryType


class CGSNodeItem(QTreeWidgetItem):
    """CGS tree의 각 노드를 나타내는 TreeWidgetItem"""
    
    def __init__(self, node: GeometryNode, parent: Optional[QTreeWidgetItem] = None):
        super().__init__(parent)
        self.node = node
        self._update_display()
    
    def _update_display(self):
        """노드 정보를 트리 아이템에 표시"""
        geometry_text = self.node.geometry if isinstance(self.node.geometry, str) else f"Tree ({len(self.node.geometry)} items)"
        self.setText(0, f"{self.node.role.value} - {geometry_text}")
        # Material, Position, Rotation은 툴팁으로만 표시
        tooltip = f"Material: {self.node.material}\nPosition: {self.node.pos}\nRotation: {self.node.rotation}"
        self.setToolTip(0, tooltip)
    
    def update_node(self, node: GeometryNode):
        """노드 데이터 업데이트"""
        self.node = node
        self._update_display()


class CGSTreeWidget(QWidget):
    """CGS tree를 표시하고 편집하는 위젯"""
    
    node_selected = Signal(GeometryNode, int)  # 선택된 노드와 인덱스 (EditorPanel과의 통신용)
    
    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._current_workspace: str = ""
        self._view_model_connected: bool = False
        self._app_view_model = None  # ApplicationViewModel 참조
        self._rebuilding_tree: bool = False
        self._updating_from_drag: bool = False
        self._setup_ui()
        self._connect_signals()
    
    def _setup_ui(self):
        """UI 구성"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # 헤더
        header_layout = QHBoxLayout()
        header_label = QLabel("CGS Tree Structure")
        header_label.setFont(QFont("Arial", 10, QFont.Weight.Bold))
        header_layout.addWidget(header_label)
        
        # 추가 버튼
        self._add_button = QPushButton("➕ Add Node")
        self._add_button.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton:pressed {
                background-color: #3d8b40;
            }
        """)
        self._add_button.clicked.connect(self._add_root_node)
        header_layout.addWidget(self._add_button)
        
        # 제거 버튼
        self._remove_button = QPushButton("➖ Remove Node")
        self._remove_button.setStyleSheet("""
            QPushButton {
                background-color: #f44336;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #da190b;
            }
            QPushButton:pressed {
                background-color: #c1170a;
            }
        """)
        self._remove_button.clicked.connect(self._remove_selected_node)
        header_layout.addWidget(self._remove_button)
        
        header_layout.addStretch()
        layout.addLayout(header_layout)
        
        # 트리 위젯
        self._tree = QTreeWidget()
        self._tree.setHeaderLabels(["CGS Tree Nodes"])
        self._tree.setAlternatingRowColors(True)
        self._tree.setRootIsDecorated(True)
        self._tree.setItemsExpandable(True)
        self._tree.setDragDropMode(QTreeWidget.DragDropMode.InternalMove)
        self._tree.setStyleSheet("""
            QTreeWidget {
                border: 1px solid #ddd;
                border-radius: 4px;
                background-color: white;
            }
            QTreeWidget::item {
                padding: 6px;
                border-bottom: 1px solid #eee;
            }
            QTreeWidget::item:selected {
                background-color: #e3f2fd;
                color: #1976d2;
            }
            QTreeWidget::item:hover {
                background-color: #f5f5f5;
            }
            QTreeWidget::item:drop-disabled {
                background-color: #ffebee;
            }
        """)
        layout.addWidget(self._tree)
    
    def _connect_signals(self):
        """시그널 연결"""
        self._tree.itemSelectionChanged.connect(self._on_selection_changed)
        self._tree.itemDoubleClicked.connect(self._on_item_double_clicked)
        self._tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self._tree.customContextMenuRequested.connect(self._show_context_menu)
        self._tree.itemChanged.connect(self._on_item_moved)

    def set_view_model(self, view_model) -> None:
        """Deprecated: Use set_app_view_model instead"""
        pass

    def set_app_view_model(self, app_view_model) -> None:
        """ApplicationViewModel 주입"""
        self._app_view_model = app_view_model
        if self._app_view_model is not None:
            self._connect_app_view_model()

    def set_workspace(self, workspace: str) -> None:
        """현재 workspace 설정"""
        self._current_workspace = workspace
        if self._app_view_model is not None:
            self._connect_app_view_model()
            self._refresh_tree()

    def _connect_app_view_model(self) -> None:
        if self._app_view_model is None or self._view_model_connected:
            return
        self._app_view_model.cgs_tree_changed.connect(self._on_app_view_model_tree_changed)
        self._app_view_model.data_changed.connect(self._on_app_view_model_data_changed)
        self._app_view_model._workspace_data_loaded.connect(self._on_workspace_data_loaded)
        self._view_model_connected = True

    def _disconnect_app_view_model(self) -> None:
        if self._app_view_model is None or not self._view_model_connected:
            return
        try:
            self._app_view_model.cgs_tree_changed.disconnect(self._on_app_view_model_tree_changed)
        except (TypeError, RuntimeError):
            pass
        try:
            self._app_view_model.data_changed.disconnect(self._on_app_view_model_data_changed)
        except (TypeError, RuntimeError):
            pass
        try:
            self._app_view_model._workspace_data_loaded.disconnect(self._on_workspace_data_loaded)
        except (TypeError, RuntimeError):
            pass
        self._view_model_connected = False

    def _on_app_view_model_tree_changed(self, workspace: str, nodes: List[GeometryNode]) -> None:
        if self._rebuilding_tree or workspace != self._current_workspace:
            return
        self._rebuild_tree(nodes)

    def _on_app_view_model_data_changed(self, workspace: str, data: WorkspaceData) -> None:
        if self._rebuilding_tree or workspace != self._current_workspace:
            return
        nodes = data.cgs_tree if data else []
        self._rebuild_tree(nodes)

    def _on_workspace_data_loaded(self, workspace: str) -> None:
        """Workspace 데이터 로드 후 트리 새로고침"""
        if workspace == self._current_workspace:
            self._refresh_tree()

    def _show_empty_placeholder(self) -> None:
        empty_item = QTreeWidgetItem()
        empty_item.setText(0, "No CGS nodes - Click 'Add Node' to start")
        empty_item.setFlags(empty_item.flags() & ~Qt.ItemFlag.ItemIsSelectable)
        self._tree.addTopLevelItem(empty_item)

    def _rebuild_tree(self, nodes: List[GeometryNode]) -> None:
        if self._rebuilding_tree:
            return
        self._rebuilding_tree = True
        try:
            blocker = QSignalBlocker(self._tree)
            _ = blocker  # keep reference alive
            self._tree.clear()
            if not nodes:
                self._show_empty_placeholder()
                return
            for i, node in enumerate(nodes):
                self._add_tree_item(node, i, None)
        finally:
            self._rebuilding_tree = False

    def set_workspace(self, workspace: str):
        """workspace 설정"""
        self._current_workspace = workspace
        self._refresh_tree()

    def _refresh_tree(self):
        """트리 새로고침"""
        if self._app_view_model is None or not self._current_workspace:
            self._rebuild_tree([])
            return
        data = self._app_view_model.get_workspace_data(self._current_workspace)
        nodes = data.cgs_tree if data else []
        self._rebuild_tree(nodes)
    
    def _add_tree_item(self, node: GeometryNode, index: int, parent_item: Optional[QTreeWidgetItem]):
        """트리 아이템 추가"""
        item = CGSNodeItem(node, parent_item)
        if parent_item is None:
            self._tree.addTopLevelItem(item)
        else:
            parent_item.addChild(item)
        
        # 하위 노드들이 있는 경우 재귀적으로 추가
        if isinstance(node.geometry, list):
            for i, sub_node in enumerate(node.geometry):
                # sub_node가 GeometryNode 객체인지 확인
                if isinstance(sub_node, GeometryNode):
                    self._add_tree_item(sub_node, i, item)
                else:
                    # 문자열인 경우 GeometryNode로 변환
                    geometry_node = GeometryNode(
                        role=GeometryRole.UNION,
                        geometry_type=GeometryType.SPHERE,
                        geometry=sub_node,
                        pos=[0, 0, 0],
                        rotation=[0, 0, 0],
                        material="Default"
                    )
                    self._add_tree_item(geometry_node, i, item)
    
    def _on_selection_changed(self):
        """선택 변경 시"""
        current_item = self._tree.currentItem()
        if isinstance(current_item, CGSNodeItem):
            # 선택된 노드의 인덱스 찾기
            index = self._find_node_index(current_item)
            # ApplicationViewModel에 선택된 노드 알림
            if self._app_view_model is not None:
                self._app_view_model.set_selected_node(self._current_workspace, current_item.node, index)
            # 기존 시그널도 유지 (하위 호환성)
            self.node_selected.emit(current_item.node, index)
        else:
            # ApplicationViewModel에 선택 해제 알림
            if self._app_view_model is not None:
                self._app_view_model.set_selected_node(self._current_workspace, None, -1)
            # 기존 시그널도 유지 (하위 호환성)
            self.node_selected.emit(None, -1)
    
    def _on_item_double_clicked(self, item: QTreeWidgetItem, column: int):
        """아이템 더블클릭 시"""
        if isinstance(item, CGSNodeItem):
            index = self._find_node_index(item)
            # ApplicationViewModel에 선택된 노드 알림
            if self._app_view_model is not None:
                self._app_view_model.set_selected_node(self._current_workspace, item.node, index)
            # 기존 시그널도 유지 (하위 호환성)
            self.node_selected.emit(item.node, index)
    
    def _find_node_index(self, item: CGSNodeItem) -> int:
        """노드의 인덱스 찾기"""
        if self._app_view_model is None or not self._current_workspace:
            return -1
        return self._app_view_model.find_node_index(self._current_workspace, item.node)
    
    
    def _add_root_node(self):
        """루트 노드 추가"""
        if self._app_view_model is None or not self._current_workspace:
            return

        # 기본 노드 생성
        new_node = self._app_view_model.create_default_geometry_node()

        # ApplicationViewModel을 통해 노드 추가
        index = self._app_view_model.add_geometry_node(self._current_workspace, new_node)
        # 시그널은 내부에서 처리하므로 emit하지 않음
    
    def _remove_selected_node(self):
        """선택된 노드 제거"""
        current_item = self._tree.currentItem()
        if not isinstance(current_item, CGSNodeItem):
            return

        index = self._find_node_index(current_item)
        if index >= 0 and self._app_view_model is not None and self._current_workspace:
            success = self._app_view_model.remove_geometry_node(self._current_workspace, index)
            # 시그널은 내부에서 처리하므로 emit하지 않음
    
    def update_node(self, node: GeometryNode, index: int):
        """노드 업데이트"""
        if self._app_view_model is None or not self._current_workspace:
            return

        success = self._app_view_model.update_geometry_node(self._current_workspace, index, node)
        # 시그널은 내부에서 처리하므로 emit하지 않음
    
    def get_current_workspace(self) -> str:
        """현재 workspace 반환"""
        return self._current_workspace

    def _show_context_menu(self, position):
        """컨텍스트 메뉴 표시"""
        item = self._tree.itemAt(position)
        if not item or not isinstance(item, CGSNodeItem):
            return
        
        menu = QMenu(self)
        
        # Add Branch Node 액션
        add_branch_action = QAction("➕ Add Branch Node", self)
        add_branch_action.triggered.connect(lambda: self._add_branch_node(item))
        menu.addAction(add_branch_action)
        
        # Remove Node 액션
        remove_action = QAction("➖ Remove Node", self)
        remove_action.triggered.connect(lambda: self._remove_node(item))
        menu.addAction(remove_action)
        
        menu.addSeparator()
        
        # Move Up 액션
        move_up_action = QAction("⬆ Move Up", self)
        move_up_action.triggered.connect(lambda: self._move_node_up(item))
        menu.addAction(move_up_action)
        
        # Move Down 액션
        move_down_action = QAction("⬇ Move Down", self)
        move_down_action.triggered.connect(lambda: self._move_node_down(item))
        menu.addAction(move_down_action)
        
        # 메뉴 표시
        menu.exec(self._tree.mapToGlobal(position))

    def _add_branch_node(self, parent_item: CGSNodeItem):
        """브랜치 노드 추가"""
        if self._app_view_model is None or not self._current_workspace:
            return

        # 부모 노드의 인덱스 찾기
        parent_index = self._find_node_index(parent_item)
        if parent_index < 0:
            return

        # 새로운 브랜치 노드 생성
        branch_node = self._app_view_model.create_branch_geometry_node()

        # ApplicationViewModel을 통해 브랜치 노드 추가
        branch_index = self._app_view_model.add_branch_node(self._current_workspace, parent_index, branch_node)
        # 시그널은 내부에서 처리하므로 emit하지 않음

    def _remove_node(self, item: CGSNodeItem):
        """노드 제거"""
        if self._app_view_model is None or not self._current_workspace:
            return
        
        # 확인 대화상자
        reply = QMessageBox.question(
            self, 
            "Remove Node", 
            "Are you sure you want to remove this node?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply != QMessageBox.StandardButton.Yes:
            return
        
        # 노드 인덱스 찾기
        index = self._find_node_index(item)
        if index >= 0:
            success = self._app_view_model.remove_geometry_node(self._current_workspace, index)
            # 시그널은 내부에서 처리하므로 emit하지 않음

    def _move_node_up(self, item: CGSNodeItem):
        """노드를 위로 이동"""
        if self._app_view_model is None or not self._current_workspace:
            return

        index = self._find_node_index(item)
        if index > 0:
            success = self._app_view_model.move_geometry_node(self._current_workspace, index, index - 1)
            # 시그널은 내부에서 처리하므로 emit하지 않음

    def _move_node_down(self, item: CGSNodeItem):
        """노드를 아래로 이동"""
        if self._app_view_model is None or not self._current_workspace:
            return

        index = self._find_node_index(item)
        data = self._app_view_model.get_workspace_data(self._current_workspace)
        total_nodes = len(data.cgs_tree) if data else 0
        if index >= 0 and index < total_nodes - 1:
            success = self._app_view_model.move_geometry_node(self._current_workspace, index, index + 1)
            # 시그널은 내부에서 처리하므로 emit하지 않음

    def _on_item_moved(self, item: QTreeWidgetItem, column: int):
        """아이템이 드래그 앤 드롭으로 이동되었을 때"""
        # 드래그 앤 드롭으로 순서 변경된 경우 처리
        if self._rebuilding_tree:
            return
        if isinstance(item, CGSNodeItem) and self._app_view_model is not None and self._current_workspace:
            self._update_workspace_data_from_tree()
            # 시그널은 내부에서 처리하므로 emit하지 않음

    def _update_workspace_data_from_tree(self):
        """트리에서 workspace 데이터 업데이트"""
        if self._app_view_model is None or not self._current_workspace or self._rebuilding_tree:
            return

        self._updating_from_drag = True
        try:
            # 트리의 순서대로 workspace 데이터 업데이트
            new_nodes = []
            for i in range(self._tree.topLevelItemCount()):
                item = self._tree.topLevelItem(i)
                if isinstance(item, CGSNodeItem):
                    # 하위 노드들도 업데이트
                    updated_node = self._update_node_from_tree_item(item)
                    new_nodes.append(updated_node)

            self._app_view_model.replace_cgs_tree(self._current_workspace, new_nodes)
        finally:
            self._updating_from_drag = False

    def _update_node_from_tree_item(self, item: CGSNodeItem) -> GeometryNode:
        """트리 아이템에서 노드 업데이트"""
        node = item.node
        
        # 하위 노드들이 있는 경우 재귀적으로 업데이트
        if isinstance(node.geometry, list):
            updated_children = []
            for i in range(item.childCount()):
                child_item = item.child(i)
                if isinstance(child_item, CGSNodeItem):
                    updated_child = self._update_node_from_tree_item(child_item)
                    updated_children.append(updated_child)
            node.geometry = updated_children
        
        return node
