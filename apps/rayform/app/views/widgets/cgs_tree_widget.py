from __future__ import annotations

from typing import Optional, List
from PySide6.QtCore import Qt, Signal, QModelIndex, QSignalBlocker
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, 
    QHBoxLayout, QPushButton, QLabel, QComboBox, QLineEdit,
    QSpinBox, QDoubleSpinBox, QGroupBox, QSplitter, QScrollArea,
    QMenu, QMessageBox, QListWidget, QListWidgetItem
)
from PySide6.QtGui import QFont, QAction, QColor, QBrush, QGuiApplication

from models import WorkspaceData, GeometryNode, GeometryRole, GeometryType


class CGSNodeItem(QListWidgetItem):
    """CGS tree의 각 최상위 노드를 나타내는 ListWidgetItem"""
    def __init__(self, node: GeometryNode):
        super().__init__("")
        self.node = node
        self._update_display()

    def _update_display(self):
        """노드 정보를 리스트 아이템에 표시"""
        geometry_text = self.node.geometry if isinstance(self.node.geometry, str) else f"Tree ({len(self.node.geometry)} items)"
        self.setText(f"{self.node.role.value} - {geometry_text}")
        tooltip = f"Material: {self.node.material}\nPosition: {self.node.pos}\nRotation: {self.node.rotation}"
        self.setToolTip(tooltip)
        self.setData(Qt.ItemDataRole.UserRole, self.node)


class CGSTreeWidget(QWidget):
    """CGS tree를 ListView로 표시하고 편집하는 위젯 (최상위 노드만 표시)"""
    
    node_selected = Signal(GeometryNode, int)  # 선택된 노드와 인덱스 (EditorPanel과의 통신용)
    
    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._current_workspace: str = ""
        self._view_model_connected: bool = False
        self._app_view_model = None  # ApplicationViewModel 참조
        self._rebuilding_list: bool = False
        self._last_clicked_index: int = -1
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
        
        # 리스트 위젯 (최상위 노드만)
        self._list = QListWidget()
        self._list.setAlternatingRowColors(True)
        self._list.setSelectionMode(QListWidget.SelectionMode.NoSelection)
        self._list.setStyleSheet("""
            QListWidget {
                border: 1px solid #ddd;
                border-radius: 4px;
                background-color: white;
            }
            QListWidget::item {
                padding: 6px;
                border-bottom: 1px solid #eee;
            }
            QListWidget::item:hover {
                background-color: #f5f5f5;
            }
        """)
        layout.addWidget(self._list)
    
    def _connect_signals(self):
        """시그널 연결"""
        self._list.itemClicked.connect(self._on_item_clicked)
        self._list.itemDoubleClicked.connect(self._on_item_double_clicked)
        self._list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self._list.customContextMenuRequested.connect(self._show_context_menu)

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
            self._refresh_list()

    def _connect_app_view_model(self) -> None:
        if self._app_view_model is None or self._view_model_connected:
            return
        self._app_view_model.cgs_tree_changed.connect(self._on_app_view_model_tree_changed)
        self._app_view_model.data_changed.connect(self._on_app_view_model_data_changed)
        self._app_view_model._workspace_data_loaded.connect(self._on_workspace_data_loaded)
        # 이중 선택 시그널에 연결하여 색상 업데이트
        if hasattr(self._app_view_model, "selected_nodes_changed"):
            self._app_view_model.selected_nodes_changed.connect(self._on_selected_nodes_changed)
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
        if self._rebuilding_list or workspace != self._current_workspace:
            return
        self._rebuild_list(nodes)

    def _on_app_view_model_data_changed(self, workspace: str, data: WorkspaceData) -> None:
        if self._rebuilding_list or workspace != self._current_workspace:
            return
        nodes = data.cgs_tree if data else []
        self._rebuild_list(nodes)

    def _on_workspace_data_loaded(self, workspace: str) -> None:
        """Workspace 데이터 로드 후 트리 새로고침"""
        if workspace == self._current_workspace:
            self._refresh_list()

    def _show_empty_placeholder(self) -> None:
        empty_item = QListWidgetItem("No CGS nodes - Click 'Add Node' to start")
        empty_item.setFlags(empty_item.flags() & ~Qt.ItemFlag.ItemIsEnabled)
        self._list.addItem(empty_item)

    def _rebuild_list(self, nodes: List[GeometryNode]) -> None:
        if self._rebuilding_list:
            return
        self._rebuilding_list = True
        try:
            blocker = QSignalBlocker(self._list)
            _ = blocker
            self._list.clear()
            if not nodes:
                self._show_empty_placeholder()
            else:
                for node in nodes:
                    item = CGSNodeItem(node)
                    self._list.addItem(item)
            # 재구성 후 현재 선택 상태 반영
            self._apply_selection_visuals()
        finally:
            self._rebuilding_list = False

    def set_workspace(self, workspace: str):
        """workspace 설정"""
        self._current_workspace = workspace
        self._refresh_list()

    def _refresh_list(self):
        """리스트 새로고침"""
        if self._app_view_model is None or not self._current_workspace:
            self._rebuild_list([])
            return
        data = self._app_view_model.get_workspace_data(self._current_workspace)
        nodes = data.cgs_tree if data else []
        self._rebuild_list(nodes)
    
    # 트리 전용 하위 추가 로직 제거 (ListView는 최상위만 표시)
    
    def _on_item_clicked(self, item: QListWidgetItem):
        """아이템 클릭 시 (Ctrl 여부에 따라 이중 선택 처리)"""
        if not isinstance(item, CGSNodeItem):
            return
        index = self._list.row(item)
        node = item.node
        self._last_clicked_index = index
        ctrl_pressed = bool(QGuiApplication.keyboardModifiers() & Qt.KeyboardModifier.ControlModifier)
        if self._app_view_model is not None and self._current_workspace:
            if hasattr(self._app_view_model, "handle_node_click"):
                self._app_view_model.handle_node_click(self._current_workspace, node, index, ctrl_pressed)
            else:
                # 레거시 폴백: 단일 선택만 전달
                self._app_view_model.set_selected_node(self._current_workspace, node, index)
        self.node_selected.emit(node, index)
    
    def _on_item_double_clicked(self, item: QListWidgetItem):
        """아이템 더블클릭 시: 일반 클릭과 동일 처리"""
        self._on_item_clicked(item)
    
    def _find_node_index(self, item: CGSNodeItem) -> int:
        """리스트에서 행 번호로 인덱스 반환"""
        return self._list.row(item)
    
    
    def _add_root_node(self):
        """루트 노드 추가"""
        if self._app_view_model is None or not self._current_workspace:
            return
        index = self._app_view_model.add_primitive_geometry(self._current_workspace, "sphere")
    
    def _remove_selected_node(self):
        """선택된 노드 제거"""
        if self._last_clicked_index < 0:
            return
        index = self._last_clicked_index
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
        item = self._list.itemAt(position)
        if not item or not isinstance(item, CGSNodeItem):
            return
        
        menu = QMenu(self)

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
        menu.exec(self._list.mapToGlobal(position))


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

    # 드래그 앤 드롭 지원 제거 (ListView 단순 모드)

    def _apply_selection_visuals(self) -> None:
        """뷰모델의 선택 상태에 따라 아이템 배경색을 적용"""
        if self._app_view_model is None or not self._current_workspace:
            return
        # 전체 초기화
        for i in range(self._list.count()):
            item = self._list.item(i)
            item.setBackground(QBrush())
            item.setForeground(QBrush())

        # 색상 지정
        selected1_idx = getattr(self._app_view_model, "selected_node_1_index", lambda: -1)()
        selected2_idx = getattr(self._app_view_model, "selected_node_2_index", lambda: -1)()

        if 0 <= selected1_idx < self._list.count():
            item1 = self._list.item(selected1_idx)
            item1.setBackground(QBrush(QColor("#E3F2FD")))  # 파란 톤
            item1.setForeground(QBrush(QColor("#0D47A1")))

        if 0 <= selected2_idx < self._list.count():
            # node_1과 겹치는 경우는 예외적으로 하나의 색만 유지됨
            if selected2_idx != selected1_idx:
                item2 = self._list.item(selected2_idx)
                item2.setBackground(QBrush(QColor("#E8F5E9")))  # 초록 톤
                item2.setForeground(QBrush(QColor("#1B5E20")))

    def _on_selected_nodes_changed(self, workspace: str, node1: GeometryNode, idx1: int, node2: Optional[GeometryNode], idx2: int) -> None:
        if workspace != self._current_workspace:
            return
        self._apply_selection_visuals()

