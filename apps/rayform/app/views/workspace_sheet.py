from __future__ import annotations

from functools import partial
from typing import Optional

from PySide6.QtCore import QObject, Qt, Signal
from PySide6.QtWidgets import QDockWidget, QListWidget, QListWidgetItem, QMdiArea, QMdiSubWindow, QTextEdit

from viewmodels.application import ApplicationViewModel
from views.widgets.cgs_tree_widget import CGSTreeWidget
from views.widgets.editor_panel import EditorPanel


class WorkspaceSheet(QObject):
    """하나의 workspace에 종속된 모든 위젯들을 관리하는 클래스"""
    
    # 시그널 정의
    data_updated = Signal(str, object)  # workspace, data
    
    def __init__(self, workspace_name: str, app_vm: ApplicationViewModel, parent_window):
        super().__init__()
        self.workspace_name = workspace_name
        self.app_vm = app_vm
        self.parent_window = parent_window
        
        # 위젯들
        self.mdi_area: Optional[QMdiArea] = None
        self.left_dock: Optional[QDockWidget] = None
        self.cgs_tree_widget: Optional[CGSTreeWidget] = None
        self.editor_panel: Optional[EditorPanel] = None
        
        # 문서 카운터
        self.document_counter = 1
        
        # 위젯들 생성
        self._create_widgets()
        self._connect_signals()
    
    def _create_widgets(self) -> None:
        """workspace에 필요한 모든 위젯들을 생성"""
        # MDI area 생성
        self.mdi_area = QMdiArea(self.parent_window)
        self.mdi_area.setViewMode(QMdiArea.ViewMode.SubWindowView)
        self.mdi_area.setTabsClosable(True)
        self.mdi_area.setTabsMovable(True)
        self.mdi_area.setDocumentMode(True)
        self.mdi_area.subWindowActivated.connect(partial(self._on_subwindow_activated))
        
        # CGS tree widget 생성
        self.cgs_tree_widget = CGSTreeWidget()
        self.cgs_tree_widget.set_app_view_model(self.app_vm)
        self.cgs_tree_widget.set_workspace(self.workspace_name)
        
        # Editor panel 생성
        self.editor_panel = EditorPanel()
        self.editor_panel.set_app_view_model(self.app_vm)
        self.editor_panel.data_updated.connect(self._on_workspace_data_updated)
        
        # Left dock 생성
        self.left_dock = QDockWidget(f"{self.workspace_name} CGS Tree", self.parent_window)
        self.left_dock.setAllowedAreas(Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea)
        self.left_dock.setWidget(self.cgs_tree_widget)
        self.left_dock.setVisible(False)  # 처음에는 숨김
        self.parent_window.addDockWidget(Qt.LeftDockWidgetArea, self.left_dock)
    
    def _connect_signals(self) -> None:
        """시그널 연결"""
        pass  # 필요시 추가
    
    def _on_subwindow_activated(self, sub_window: Optional[QMdiSubWindow]) -> None:
        """MDI subwindow 활성화 시 호출"""
        self.app_vm.set_active_workspace(self.workspace_name)
        if sub_window is None:
            self.app_vm.set_status_message(f"{self.workspace_name}: No active document")
            return
        self.app_vm.set_status_message(f"{self.workspace_name}: Active {sub_window.windowTitle()}")
    
    def _on_workspace_data_updated(self, data) -> None:
        """Workspace 데이터 업데이트 시"""
        self.data_updated.emit(self.workspace_name, data)
    
    def show_left_dock(self) -> None:
        """Left dock을 보이게 함"""
        if self.left_dock:
            self.left_dock.setVisible(True)
    
    def hide_left_dock(self) -> None:
        """Left dock을 숨김"""
        if self.left_dock:
            self.left_dock.setVisible(False)
    
    def get_editor_panel(self) -> Optional[EditorPanel]:
        """Editor panel 반환"""
        return self.editor_panel
    
    def create_document(
        self,
        title: Optional[str] = None,
        set_active: bool = True,
    ) -> Optional[QMdiSubWindow]:
        """새 문서 생성"""
        if self.mdi_area is None:
            return None
        
        document_title = title or f"{self.workspace_name} Document {self.document_counter}"
        self.document_counter += 1
        
        editor = QTextEdit()
        editor.setPlainText(
            f"Workspace: {self.workspace_name}\nDocument: {document_title}\nAdd your content here."
        )
        
        sub_window = QMdiSubWindow()
        sub_window.setWidget(editor)
        sub_window.setAttribute(Qt.WA_DeleteOnClose)
        sub_window.setWindowTitle(document_title)
        
        self.mdi_area.addSubWindow(sub_window)
        sub_window.show()
        
        if set_active:
            self.mdi_area.setActiveSubWindow(sub_window)
            self.app_vm.set_status_message(f"{self.workspace_name}: Opened {document_title}")
        else:
            self.app_vm.set_status_message(f"{self.workspace_name}: Added {document_title}")
        
        return sub_window
    
    def tile_subwindows(self) -> None:
        """MDI subwindow들을 타일링"""
        if self.mdi_area:
            self.mdi_area.tileSubWindows()
            self.app_vm.set_status_message(f"{self.workspace_name}: Tiled subwindows")
    
    def cascade_subwindows(self) -> None:
        """MDI subwindow들을 캐스케이딩"""
        if self.mdi_area:
            self.mdi_area.cascadeSubWindows()
            self.app_vm.set_status_message(f"{self.workspace_name}: Cascaded subwindows")
    
    def get_active_subwindow(self) -> Optional[QMdiSubWindow]:
        """현재 활성화된 subwindow 반환"""
        if self.mdi_area:
            return self.mdi_area.activeSubWindow()
        return None
    
    def set_active_subwindow(self, sub_window: Optional[QMdiSubWindow]) -> None:
        """특정 subwindow를 활성화"""
        if self.mdi_area and sub_window:
            self.mdi_area.setActiveSubWindow(sub_window)
