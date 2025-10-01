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

from state import State
from context import Context
from service.cgs_service import CGSService
from ui.cgs_tree_widget import CGSTreeWidget
from ui.editor_panel import EditorPanel


class MainWindow(QMainWindow):
    """Primary application window with menus, toolbars, docks, and workspace MDIs."""

    def __init__(self) -> None:
        super().__init__()
        self._state = State()
        self._state.set_main_window(self)
        self._context = Context()
        self._cgs_service = CGSService()

        self._workspace_tabs: Optional[QTabWidget] = None
        self._mdi_areas: Dict[str, QMdiArea] = {}
        self._left_docks: Dict[str, QDockWidget] = {}
        self._cgs_tree_widgets: Dict[str, CGSTreeWidget] = {}
        self._editor_panels: Dict[str, EditorPanel] = {}
        self._document_counters: Dict[str, int] = {}
        self._workspace_definitions: Dict[str, list[str]] = {
            "Acquisition": ["Scope Monitor", "Trigger Log"],
            "Analysis": ["Spectrum Viewer", "Filter Designer"],
            "Automation": ["Macro Console"],
        }

        self.setWindowTitle("Rayform Studio")
        self.resize(1200, 800)
        self._build_ui()
        self._connect_state()
        self._state.set_status_message("Ready")

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

        # CGS 데이터 저장/로드
        save_cgs_action = QAction("Save CGS Data", self)
        save_cgs_action.setShortcut("Ctrl+S")
        save_cgs_action.triggered.connect(self._save_cgs_data)
        file_menu.addAction(save_cgs_action)

        load_cgs_action = QAction("Load CGS Data", self)
        load_cgs_action.setShortcut("Ctrl+O")
        load_cgs_action.triggered.connect(self._load_cgs_data)
        file_menu.addAction(load_cgs_action)

        # 예제 데이터 로드
        load_example_action = QAction("Load Example Data", self)
        load_example_action.triggered.connect(self._load_example_data)
        file_menu.addAction(load_example_action)

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
        self._state.set_workspace_tabs(tabs)
        self._workspace_tabs = tabs

        for workspace in self._workspace_definitions:
            # CGS tree widget과 editor panel을 먼저 생성
            cgs_tree_widget = self._create_cgs_tree_widget(workspace)
            editor_panel = self._create_editor_panel(workspace)
            
            # 먼저 딕셔너리에 저장
            self._cgs_tree_widgets[workspace] = cgs_tree_widget
            self._editor_panels[workspace] = editor_panel
            
            # Service를 통해 workspace 데이터 로드
            workspace_data = self._cgs_service.get_or_create_workspace_data(workspace)
            cgs_tree_widget.set_workspace(workspace)
            editor_panel.set_workspace(workspace)
            
            # MDI area와 left dock 생성
            area = self._create_workspace_area(workspace)
            left_dock = self._create_workspace_left_dock(workspace)
            
            self._mdi_areas[workspace] = area
            self._left_docks[workspace] = left_dock
            self._document_counters[workspace] = 1
            tabs.addTab(area, workspace)
            self._state.register_workspace(workspace, area)
            self._state.set_workspace_left_panel(workspace, left_dock.widget())

    def _create_workspace_area(self, workspace: str) -> QMdiArea:
        mdi_area = QMdiArea(self)
        mdi_area.setViewMode(QMdiArea.ViewMode.SubWindowView)
        mdi_area.setTabsClosable(True)
        mdi_area.setTabsMovable(True)
        mdi_area.setDocumentMode(True)
        mdi_area.subWindowActivated.connect(partial(self._on_subwindow_activated, workspace))
        return mdi_area

    def _create_workspace_left_dock(self, workspace: str) -> QDockWidget:
        dock = QDockWidget(f"{workspace} CGS Tree", self)
        dock.setAllowedAreas(Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea)
        
        # CGS tree widget을 dock에 추가
        cgs_widget = self._cgs_tree_widgets.get(workspace)
        if cgs_widget:
            dock.setWidget(cgs_widget)
        else:
            # fallback으로 라이브러리 리스트 표시
            list_widget = QListWidget(dock)
            list_widget.addItems([
                "CGS Tree",
                "Parameters", 
                "Materials",
                "Tools",
                "Templates",
            ])
            list_widget.currentItemChanged.connect(partial(self._on_workspace_left_item_changed, workspace))
            dock.setWidget(list_widget)
        
        # 처음에는 숨김 상태로 설정 (첫 번째 workspace만 보이게)
        dock.setVisible(False)
        self.addDockWidget(Qt.LeftDockWidgetArea, dock)
        
        return dock

    def _create_cgs_tree_widget(self, workspace: str) -> CGSTreeWidget:
        """CGS tree 위젯 생성"""
        cgs_widget = CGSTreeWidget()
        cgs_widget.node_selected.connect(partial(self._on_cgs_node_selected, workspace))
        cgs_widget.node_added.connect(partial(self._on_cgs_node_added, workspace))
        cgs_widget.node_removed.connect(partial(self._on_cgs_node_removed, workspace))
        cgs_widget.node_updated.connect(partial(self._on_cgs_node_updated, workspace))
        cgs_widget.branch_node_added.connect(partial(self._on_cgs_branch_node_added, workspace))
        cgs_widget.node_moved.connect(partial(self._on_cgs_node_moved, workspace))
        return cgs_widget

    def _create_editor_panel(self, workspace: str) -> EditorPanel:
        """Editor panel 생성"""
        editor = EditorPanel()
        editor.data_updated.connect(self._on_workspace_data_updated)
        return editor

    def _create_left_dock(self) -> None:
        # Deprecated: workspace별 left dock을 사용하므로 빈 메서드로 유지
        pass

    def _create_bottom_dock(self) -> None:
        dock = QDockWidget("Editor", self)
        dock.setAllowedAreas(Qt.BottomDockWidgetArea)

        # 기본 라벨로 초기화 (workspace 생성 후 업데이트됨)
        label = QLabel("Select a workspace to edit CGS data.", dock)
        label.setAlignment(Qt.AlignCenter)
        dock.setWidget(label)

        self.addDockWidget(Qt.BottomDockWidgetArea, dock)
        self._bottom_dock = dock

    def _create_status_bar(self) -> None:
        status_bar = self.statusBar()
        status_bar.showMessage(self._state.status_message())

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
            # 첫 번째 workspace의 left dock을 보이게 함
            first_workspace = self._workspace_tabs.tabText(0)
            self._show_workspace_left_dock(first_workspace)
            # 첫 번째 workspace의 bottom dock도 업데이트
            self._update_bottom_dock(first_workspace)
            self._on_workspace_tab_changed(0)

    def _connect_state(self) -> None:
        self._state.status_message_changed.connect(self.statusBar().showMessage)
        self._state.active_subwindow_title_changed.connect(self._on_active_title_changed)
        self._state.active_workspace_changed.connect(self._on_active_workspace_changed)

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
            self._state.set_status_message("No workspace available")
            return None

        area = self._mdi_areas.get(target_workspace)
        if area is None:
            self._state.set_status_message(f"Workspace '{target_workspace}' is unavailable")
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
            self._state.update_active_subwindow(target_workspace, sub_window)
            self._state.set_status_message(f"{target_workspace}: Opened {document_title}")
        else:
            if target_workspace == self._active_workspace_name():
                self._state.set_status_message(f"{target_workspace}: Added {document_title}")

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
            self._state.set_status_message("No workspace to tile")
            return
        area.tileSubWindows()
        workspace = self._active_workspace_name() or "Workspace"
        self._state.set_status_message(f"{workspace}: Tiled subwindows")

    def _cascade_mdi(self) -> None:
        area = self._current_mdi_area()
        if area is None:
            self._state.set_status_message("No workspace to cascade")
            return
        area.cascadeSubWindows()
        workspace = self._active_workspace_name() or "Workspace"
        self._state.set_status_message(f"{workspace}: Cascaded subwindows")

    def _show_workspace_left_dock(self, workspace: str) -> None:
        """특정 workspace의 left dock만 보이게 하고 나머지는 숨김"""
        for ws_name, dock in self._left_docks.items():
            if ws_name == workspace:
                dock.setVisible(True)
            else:
                dock.setVisible(False)

    def _hide_all_left_docks(self) -> None:
        """모든 workspace의 left dock을 숨김"""
        for dock in self._left_docks.values():
            dock.setVisible(False)

    # -- signal handlers -----------------------------------------------------
    def _on_workspace_tab_changed(self, index: int) -> None:
        if not self._workspace_tabs or index < 0:
            self._state.set_active_workspace("")
            self._state.set_status_message("No workspace selected")
            self._state.update_active_subwindow("", None)
            self._hide_all_left_docks()
            return
        workspace = self._workspace_tabs.tabText(index)
        area = self._mdi_areas.get(workspace)
        self._state.set_active_workspace(workspace)
        
        # 현재 workspace의 left dock만 보이게 하고 나머지는 숨김
        self._show_workspace_left_dock(workspace)
        
        # Bottom dock을 현재 workspace의 editor panel로 변경
        self._update_bottom_dock(workspace)
        
        active = area.activeSubWindow() if area is not None else None
        if active is not None:
            self._state.set_status_message(f"{workspace}: Active {active.windowTitle()}")
        else:
            self._state.set_status_message(f"{workspace}: No active document")
        self._state.update_active_subwindow(workspace, active)

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
        self._state.update_active_subwindow(workspace, sub_window)
        if sub_window is None:
            self._state.set_status_message(f"{workspace}: No active document")
            return
        self._state.set_status_message(f"{workspace}: Active {sub_window.windowTitle()}")

    def _on_active_title_changed(self, title: str) -> None:
        workspace = self._state.active_workspace()
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

    def _on_workspace_left_item_changed(self, workspace: str, current: Optional[QListWidgetItem], previous: Optional[QListWidgetItem]) -> None:
        _ = previous
        if current is None:
            self._state.set_status_message(f"{workspace}: No item selected")
            return
        self._state.set_status_message(f"{workspace}: Selected {current.text()}")

    def _on_left_item_changed(self, current: Optional[QListWidgetItem], previous: Optional[QListWidgetItem]) -> None:
        # Deprecated: workspace별 핸들러를 사용
        pass

    def _update_bottom_dock(self, workspace: str) -> None:
        """Bottom dock을 현재 workspace의 editor panel로 업데이트"""
        if workspace in self._editor_panels and hasattr(self, '_bottom_dock'):
            self._bottom_dock.setWidget(self._editor_panels[workspace])

    def _on_cgs_node_selected(self, workspace: str, node, index: int) -> None:
        """CGS 노드 선택 시"""
        if workspace in self._editor_panels:
            self._editor_panels[workspace].set_selected_node(node, index)

    def _on_cgs_node_added(self, workspace: str, node, index: int) -> None:
        """CGS 노드 추가 시"""
        self._state.set_status_message(f"{workspace}: Added geometry node")

    def _on_cgs_node_removed(self, workspace: str, index: int) -> None:
        """CGS 노드 제거 시"""
        self._state.set_status_message(f"{workspace}: Removed geometry node")

    def _on_cgs_node_updated(self, workspace: str, node, index: int) -> None:
        """CGS 노드 업데이트 시"""
        self._state.set_status_message(f"{workspace}: Updated geometry node")

    def _on_workspace_data_updated(self, workspace: str, data) -> None:
        """Workspace 데이터 업데이트 시"""
        self._cgs_service.set_workspace_data(workspace, data)
        self._state.set_status_message(f"{workspace}: Data updated")

    def _on_cgs_branch_node_added(self, workspace: str, node, parent_index: int, branch_index: int) -> None:
        """CGS 브랜치 노드 추가 시"""
        self._state.set_status_message(f"{workspace}: Added branch node to parent {parent_index}")

    def _on_cgs_node_moved(self, workspace: str) -> None:
        """CGS 노드 이동 시"""
        self._state.set_status_message(f"{workspace}: Node order updated")

    def _save_cgs_data(self) -> None:
        """CGS 데이터 저장"""
        from PySide6.QtWidgets import QFileDialog
        import json
        
        current_workspace = self._active_workspace_name()
        if not current_workspace:
            self._state.set_status_message("No workspace selected")
            return
        
        workspace_data = self._cgs_service.get_workspace_data(current_workspace)
        if not workspace_data:
            self._state.set_status_message(f"No data to save in {current_workspace}")
            return
        
        # 파일 선택 다이얼로그
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            f"Save CGS Data - {current_workspace}",
            f"{current_workspace}_cgs_data.json",
            "JSON Files (*.json);;All Files (*)"
        )
        
        if file_path:
            try:
                # WorkspaceData를 딕셔너리로 변환하여 저장
                data_dict = workspace_data.to_dict()
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(data_dict, f, indent=2, ensure_ascii=False)
                self._state.set_status_message(f"Saved CGS data to {file_path}")
            except Exception as e:
                self._state.set_status_message(f"Error saving data: {str(e)}")

    def _load_cgs_data(self) -> None:
        """CGS 데이터 로드"""
        from PySide6.QtWidgets import QFileDialog
        import json
        from models import WorkspaceData
        
        current_workspace = self._active_workspace_name()
        if not current_workspace:
            self._state.set_status_message("No workspace selected")
            return
        
        # 파일 선택 다이얼로그
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            f"Load CGS Data - {current_workspace}",
            "",
            "JSON Files (*.json);;All Files (*)"
        )
        
        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data_dict = json.load(f)
                
                # 딕셔너리에서 WorkspaceData 객체 생성
                workspace_data = WorkspaceData.from_dict(data_dict)
                
                # Service에 저장
                self._cgs_service.set_workspace_data(current_workspace, workspace_data)
                
                # UI 업데이트
                if current_workspace in self._cgs_tree_widgets:
                    self._cgs_tree_widgets[current_workspace].set_workspace(current_workspace)
                if current_workspace in self._editor_panels:
                    self._editor_panels[current_workspace].set_workspace(current_workspace)
                
                self._state.set_status_message(f"Loaded CGS data from {file_path}")
            except Exception as e:
                self._state.set_status_message(f"Error loading data: {str(e)}")

    def _load_example_data(self) -> None:
        """예제 CGS 데이터 로드"""
        from models import WorkspaceData, GeometryNode, GeometryRole, GeometryType
        
        current_workspace = self._active_workspace_name()
        if not current_workspace:
            self._state.set_status_message("No workspace selected")
            return
        
        # 예제 데이터 생성
        workspace_data = WorkspaceData()
        
        # CGS Tree 예제
        sphere_node = GeometryNode(
            role=GeometryRole.UNION,
            geometry_type=GeometryType.SPHERE,
            geometry="sphere",
            pos=[0, 0, "$a"],
            rotation=[0, 0, 0],
            material="SiO2"
        )
        
        cube_node = GeometryNode(
            role=GeometryRole.INTERSECT,
            geometry_type=GeometryType.CUBE,
            geometry="cube",
            pos=[0, 0, 0],
            rotation=[0, 0, "$b"],
            material="SiO2"
        )
        
        workspace_data.add_geometry_node(sphere_node)
        workspace_data.add_geometry_node(cube_node)
        
        # Parameters 예제
        workspace_data.update_parameter("a", 10.0)
        workspace_data.update_parameter("b", "%10~20")  # random, sweep
        
        # Materials 예제
        sio2_data = {
            400e-9: complex(1.46, 0.0),  # 400nm
            500e-9: complex(1.45, 0.0),  # 500nm
            600e-9: complex(1.44, 0.0),  # 600nm
            700e-9: complex(1.43, 0.0),  # 700nm
        }
        workspace_data.update_material("SiO2", sio2_data)
        
        # Service에 저장
        self._cgs_service.set_workspace_data(current_workspace, workspace_data)
        
        # UI 업데이트
        if current_workspace in self._cgs_tree_widgets:
            self._cgs_tree_widgets[current_workspace].set_workspace(current_workspace)
        if current_workspace in self._editor_panels:
            self._editor_panels[current_workspace].set_workspace(current_workspace)
        
        self._state.set_status_message(f"Loaded example data for {current_workspace}")


def create_main_window() -> MainWindow:
    return MainWindow()
