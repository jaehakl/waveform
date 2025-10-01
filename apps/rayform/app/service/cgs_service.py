from __future__ import annotations

from typing import Optional, Dict, Any, List, Union
from context import Context
from models import WorkspaceData, GeometryNode, GeometryRole, GeometryType


class CGSService:
    """CGS 데이터 조작을 위한 서비스 클래스"""
    
    def __init__(self):
        self._context = Context()
    
    def get_workspace_data(self, workspace: str) -> WorkspaceData:
        """workspace 데이터 가져오기"""
        return self._context.get_workspace_data(workspace)
    
    def get_or_create_workspace_data(self, workspace: str) -> WorkspaceData:
        """workspace 데이터 가져오기 또는 생성"""
        return self._context.get_or_create_workspace_data(workspace)
    
    def set_workspace_data(self, workspace: str, data: WorkspaceData) -> None:
        """workspace 데이터 설정"""
        self._context.set_workspace_data(workspace, data)
    
    def add_geometry_node(self, workspace: str, node: GeometryNode) -> int:
        """geometry 노드 추가"""
        workspace_data = self.get_or_create_workspace_data(workspace)
        workspace_data.add_geometry_node(node)
        self.set_workspace_data(workspace, workspace_data)
        return len(workspace_data.cgs_tree) - 1
    
    def remove_geometry_node(self, workspace: str, index: int) -> bool:
        """geometry 노드 제거"""
        workspace_data = self.get_workspace_data(workspace)
        if not workspace_data or index < 0 or index >= len(workspace_data.cgs_tree):
            return False
        
        workspace_data.remove_geometry_node(index)
        self.set_workspace_data(workspace, workspace_data)
        return True
    
    def update_geometry_node(self, workspace: str, index: int, node: GeometryNode) -> bool:
        """geometry 노드 업데이트"""
        workspace_data = self.get_workspace_data(workspace)
        if not workspace_data or index < 0 or index >= len(workspace_data.cgs_tree):
            return False
        
        workspace_data.cgs_tree[index] = node
        self.set_workspace_data(workspace, workspace_data)
        return True
    
    def add_branch_node(self, workspace: str, parent_index: int, branch_node: GeometryNode) -> Optional[int]:
        """브랜치 노드 추가"""
        workspace_data = self.get_workspace_data(workspace)
        if not workspace_data or parent_index < 0 or parent_index >= len(workspace_data.cgs_tree):
            return None
        
        parent_node = workspace_data.cgs_tree[parent_index]
        
        # 부모 노드가 tree 구조가 아니면 tree로 변환
        if isinstance(parent_node.geometry, str):
            # primitive를 tree로 변환 - 기존 primitive를 GeometryNode로 래핑
            original_geometry = parent_node.geometry
            original_geometry_type = parent_node.geometry_type
            
            # 기존 primitive를 GeometryNode로 변환
            original_node = GeometryNode(
                role=GeometryRole.UNION,  # 기본적으로 UNION으로 설정
                geometry_type=original_geometry_type,
                geometry=original_geometry,
                pos=parent_node.pos,
                rotation=parent_node.rotation,
                material=parent_node.material
            )
            
            # 부모 노드를 tree 구조로 변경
            parent_node.role = GeometryRole.UNION
            parent_node.geometry_type = GeometryType.TREE
            parent_node.geometry = [original_node]
            parent_node.pos = [0, 0, 0]  # tree의 기본 위치
            parent_node.rotation = [0, 0, 0]  # tree의 기본 회전
            parent_node.material = "Default"  # tree의 기본 재료
        
        # 브랜치 노드 추가
        if isinstance(parent_node.geometry, list):
            parent_node.geometry.append(branch_node)
            branch_index = len(parent_node.geometry) - 1
            self.set_workspace_data(workspace, workspace_data)
            return branch_index
        
        return None
    
    def move_geometry_node(self, workspace: str, from_index: int, to_index: int) -> bool:
        """geometry 노드 순서 변경"""
        workspace_data = self.get_workspace_data(workspace)
        if not workspace_data:
            return False
        
        nodes = workspace_data.cgs_tree
        if (from_index < 0 or from_index >= len(nodes) or 
            to_index < 0 or to_index >= len(nodes)):
            return False
        
        # 노드 순서 변경
        nodes[from_index], nodes[to_index] = nodes[to_index], nodes[from_index]
        self.set_workspace_data(workspace, workspace_data)
        return True
    
    def update_parameters(self, workspace: str, parameters: Dict[str, Union[float, str]]) -> None:
        """파라미터 업데이트"""
        workspace_data = self.get_or_create_workspace_data(workspace)
        workspace_data.parameters = parameters
        self.set_workspace_data(workspace, workspace_data)
    
    def update_materials(self, workspace: str, materials: Dict[str, Dict[float, complex]]) -> None:
        """재료 데이터 업데이트"""
        workspace_data = self.get_or_create_workspace_data(workspace)
        workspace_data.materials = materials
        self.set_workspace_data(workspace, workspace_data)
    
    def find_node_index(self, workspace: str, target_node: GeometryNode) -> int:
        """노드의 인덱스 찾기"""
        workspace_data = self.get_workspace_data(workspace)
        if not workspace_data:
            return -1
        
        for i, node in enumerate(workspace_data.cgs_tree):
            if self._find_node_recursive(node, target_node):
                return i
        return -1
    
    def _find_node_recursive(self, search_node: GeometryNode, target_node: GeometryNode) -> bool:
        """재귀적으로 노드 찾기"""
        if search_node == target_node:
            return True
        
        if isinstance(search_node.geometry, list):
            for sub_node in search_node.geometry:
                if isinstance(sub_node, GeometryNode):
                    if self._find_node_recursive(sub_node, target_node):
                        return True
        
        return False
    
    def create_default_geometry_node(self) -> GeometryNode:
        """기본 geometry 노드 생성"""
        return GeometryNode(
            role=GeometryRole.UNION,
            geometry_type=GeometryType.SPHERE,
            geometry="sphere",
            pos=[0, 0, 0],
            rotation=[0, 0, 0],
            material="SiO2"
        )
    
    def create_branch_geometry_node(self) -> GeometryNode:
        """브랜치 geometry 노드 생성"""
        return GeometryNode(
            role=GeometryRole.UNION,
            geometry_type=GeometryType.SPHERE,
            geometry="sphere",
            pos=[0, 0, 0],
            rotation=[0, 0, 0],
            material="SiO2"
        )
