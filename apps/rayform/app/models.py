from __future__ import annotations

from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass, field
from enum import Enum


class GeometryRole(Enum):
    UNION = "union"
    INTERSECT = "intersect"
    SUBTRACT = "subtract"


class GeometryType(Enum):
    SPHERE = "sphere"
    CUBE = "cube"
    CYLINDER = "cylinder"
    PLANE = "plane"
    TREE = "tree"  # 재귀적 tree 구조


@dataclass
class GeometryNode:
    """CGS tree의 각 노드를 나타내는 클래스"""
    role: GeometryRole
    geometry_type: GeometryType
    geometry: Union[str, List['GeometryNode']]  # primitive type 또는 하위 노드들
    pos: List[Union[float, str]]  # [x, y, z] 또는 파라미터 참조
    rotation: List[Union[float, str]]  # [rx, ry, rz] 또는 파라미터 참조
    material: str
    
    def __post_init__(self):
        if isinstance(self.geometry, list):
            # 하위 노드들이 있는 경우
            self.geometry_type = GeometryType.TREE
        else:
            # primitive geometry인 경우
            try:
                self.geometry_type = GeometryType(self.geometry)
            except ValueError:
                self.geometry_type = GeometryType.SPHERE  # 기본값


@dataclass
class WorkspaceData:
    """workspace의 전체 데이터 구조"""
    cgs_tree: List[GeometryNode] = field(default_factory=list)
    parameters: Dict[str, Union[float, str]] = field(default_factory=dict)
    materials: Dict[str, Dict[float, complex]] = field(default_factory=dict)  # wavelength -> (n, k)
    
    def add_geometry_node(self, node: GeometryNode) -> None:
        """새로운 geometry node 추가"""
        self.cgs_tree.append(node)
    
    def remove_geometry_node(self, index: int) -> None:
        """geometry node 제거"""
        if 0 <= index < len(self.cgs_tree):
            del self.cgs_tree[index]
    
    def update_parameter(self, name: str, value: Union[float, str]) -> None:
        """파라미터 업데이트"""
        self.parameters[name] = value
    
    def remove_parameter(self, name: str) -> None:
        """파라미터 제거"""
        self.parameters.pop(name, None)
    
    def update_material(self, material_id: str, wavelength_data: Dict[float, complex]) -> None:
        """재료 데이터 업데이트"""
        self.materials[material_id] = wavelength_data
    
    def remove_material(self, material_id: str) -> None:
        """재료 데이터 제거"""
        self.materials.pop(material_id, None)
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환 (Context 저장용)"""
        return {
            "cgs_tree": [
                {
                    "role": node.role.value,
                    "geometry_type": node.geometry_type.value,
                    "geometry": node.geometry if isinstance(node.geometry, str) else [
                        self._node_to_dict(sub_node) for sub_node in node.geometry
                    ],
                    "pos": node.pos,
                    "rotation": node.rotation,
                    "material": node.material
                }
                for node in self.cgs_tree
            ],
            "parameters": self.parameters,
            "materials": {
                mat_id: {str(wl): {"n": complex(nk).real, "k": complex(nk).imag} 
                        for wl, nk in data.items()}
                for mat_id, data in self.materials.items()
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'WorkspaceData':
        """딕셔너리에서 객체 생성"""
        workspace = cls()
        
        # cgs_tree 복원
        for node_data in data.get("cgs_tree", []):
            node = cls._dict_to_node(node_data)
            workspace.cgs_tree.append(node)
        
        # parameters 복원
        workspace.parameters = data.get("parameters", {})
        
        # materials 복원
        for mat_id, mat_data in data.get("materials", {}).items():
            wavelength_data = {}
            for wl_str, nk_data in mat_data.items():
                wl = float(wl_str)
                n = nk_data.get("n", 0.0)
                k = nk_data.get("k", 0.0)
                wavelength_data[wl] = complex(n, k)
            workspace.materials[mat_id] = wavelength_data
        
        return workspace
    
    @staticmethod
    def _node_to_dict(node: GeometryNode) -> Dict[str, Any]:
        """GeometryNode를 딕셔너리로 변환"""
        return {
            "role": node.role.value,
            "geometry_type": node.geometry_type.value,
            "geometry": node.geometry if isinstance(node.geometry, str) else [
                WorkspaceData._node_to_dict(sub_node) for sub_node in node.geometry
            ],
            "pos": node.pos,
            "rotation": node.rotation,
            "material": node.material
        }
    
    @staticmethod
    def _dict_to_node(data: Dict[str, Any]) -> GeometryNode:
        """딕셔너리에서 GeometryNode 생성"""
        role = GeometryRole(data.get("role", "union"))
        geometry_type = GeometryType(data.get("geometry_type", "sphere"))
        geometry = data.get("geometry", "sphere")
        
        # geometry가 리스트인 경우 하위 노드들로 변환
        if isinstance(geometry, list):
            geometry = [WorkspaceData._dict_to_node(sub_data) for sub_data in geometry]
        
        return GeometryNode(
            role=role,
            geometry_type=geometry_type,
            geometry=geometry,
            pos=data.get("pos", [0, 0, 0]),
            rotation=data.get("rotation", [0, 0, 0]),
            material=data.get("material", "SiO2")
        )
