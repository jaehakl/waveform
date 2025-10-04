from __future__ import annotations

import json
from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QMdiSubWindow, QTextEdit, QVBoxLayout, QWidget, QPushButton, QHBoxLayout

from viewmodels.application import ApplicationViewModel


class CGSStringViewer(QMdiSubWindow):
    """CGS 트리 데이터를 JSON 문자열로 표시하는 MDI 서브윈도우"""
    
    def __init__(self, app_vm: ApplicationViewModel, workspace: str, parent=None):
        super().__init__(parent)
        self._app_vm = app_vm
        self._workspace = workspace
        
        self._setup_ui()
        self._connect_signals()
        self._update_content()
    
    def _setup_ui(self) -> None:
        """UI 설정"""
        # 메인 위젯 생성
        main_widget = QWidget()
        self.setWidget(main_widget)
        
        # 레이아웃 생성
        layout = QVBoxLayout(main_widget)
        
        # 버튼 레이아웃
        button_layout = QHBoxLayout()
        
        # 새로고침 버튼
        refresh_btn = QPushButton("새로고침")
        refresh_btn.clicked.connect(self._update_content)
        button_layout.addWidget(refresh_btn)
        
        # 복사 버튼
        copy_btn = QPushButton("복사")
        copy_btn.clicked.connect(self._copy_to_clipboard)
        button_layout.addWidget(copy_btn)
        
        button_layout.addStretch()
        layout.addLayout(button_layout)
        
        # 텍스트 에디터 생성
        self._text_edit = QTextEdit()
        self._text_edit.setReadOnly(True)
        
        # Monospace 폰트 설정
        from PySide6.QtGui import QFont
        font = QFont()
        font.setFamily("Consolas")  # Windows에서 사용 가능한 monospace 폰트
        font.setStyleHint(QFont.StyleHint.Monospace)
        self._text_edit.setFont(font)
        
        layout.addWidget(self._text_edit)
        
        # 윈도우 속성 설정
        self.setWindowTitle(f"CGS String - {self._workspace}")
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose)
        self.resize(600, 400)
    
    def _connect_signals(self) -> None:
        """시그널 연결"""
        # CGS 트리 변경 시 업데이트
        self._app_vm.cgs_tree_changed.connect(self._on_cgs_tree_changed)
        # 활성 워크스페이스 변경 시 업데이트
        self._app_vm.active_workspace_changed.connect(self._on_workspace_changed)
    
    def _on_cgs_tree_changed(self, workspace: str, cgs_tree: list) -> None:
        """CGS 트리 변경 시 호출"""
        if workspace == self._workspace:
            self._update_content()
    
    def _on_workspace_changed(self, workspace: str) -> None:
        """활성 워크스페이스 변경 시 호출"""
        if workspace == self._workspace:
            self._update_content()
    
    def _update_content(self) -> None:
        """텍스트 내용 업데이트"""
        try:
            # 현재 워크스페이스의 CGS 트리 데이터 가져오기
            workspace_data = self._app_vm.get_workspace_data(self._workspace)
            if workspace_data is None:
                self._text_edit.setPlainText("워크스페이스 데이터를 찾을 수 없습니다.")
                return
            
            cgs_tree = workspace_data.cgs_tree
            if cgs_tree is None:
                self._text_edit.setPlainText("CGS 트리 데이터가 없습니다.")
                return
            
            # CGS 트리를 JSON 문자열로 변환 (pos, rotation을 가로로 표시)
            json_data = cgs_tree.to_serializable()
            json_string = json.dumps(json_data, indent=2, ensure_ascii=False, separators=(',', ': '))
            
            # pos와 rotation 리스트를 가로로 표시하도록 포맷팅
            formatted_string = self._format_json_for_display(json_string)
            
            # 텍스트 에디터에 표시
            self._text_edit.setPlainText(formatted_string)
            
        except Exception as e:
            self._text_edit.setPlainText(f"오류가 발생했습니다: {str(e)}")
    
    def _format_json_for_display(self, json_string: str) -> str:
        """JSON 문자열을 가독성 있게 포맷팅 (pos, rotation을 가로로 표시)"""
        import re
        
        # pos와 rotation 배열을 한 줄로 표시하도록 정규식으로 처리
        # "pos": [\n\s*숫자,\n\s*숫자,\n\s*숫자\n\s*] 형태를 "pos": [숫자, 숫자, 숫자] 형태로 변경
        json_string = re.sub(
            r'"pos": \[\s*\n\s*([0-9.-]+),\s*\n\s*([0-9.-]+),\s*\n\s*([0-9.-]+)\s*\n\s*\]',
            r'"pos": [\1, \2, \3]',
            json_string
        )
        
        json_string = re.sub(
            r'"rotation": \[\s*\n\s*([0-9.-]+),\s*\n\s*([0-9.-]+),\s*\n\s*([0-9.-]+)\s*\n\s*\]',
            r'"rotation": [\1, \2, \3]',
            json_string
        )

        json_string = re.sub(
            r'"size": \[\s*\n\s*([0-9.-]+),\s*\n\s*([0-9.-]+),\s*\n\s*([0-9.-]+)\s*\n\s*\]',
            r'"size": [\1, \2, \3]',
            json_string
        )
        
        return json_string
    
    def _copy_to_clipboard(self) -> None:
        """텍스트를 클립보드에 복사"""
        text = self._text_edit.toPlainText()
        if text:
            from PySide6.QtWidgets import QApplication
            clipboard = QApplication.clipboard()
            clipboard.setText(text)
            self._app_vm.set_status_message("CGS 데이터가 클립보드에 복사되었습니다.")
    
    def set_workspace(self, workspace: str) -> None:
        """워크스페이스 변경"""
        self._workspace = workspace
        self.setWindowTitle(f"CGS String - {workspace}")
        self._update_content()
    
    def closeEvent(self, event) -> None:
        """윈도우 닫기 시 시그널 연결 해제"""
        try:
            self._app_vm.cgs_tree_changed.disconnect(self._on_cgs_tree_changed)
            self._app_vm.active_workspace_changed.disconnect(self._on_workspace_changed)
        except:
            pass  # 이미 연결이 해제된 경우 무시
        super().closeEvent(event)
