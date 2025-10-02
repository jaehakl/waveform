from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, Iterator, List, Optional

from .geometry import (
    GeometryNode,
    GeometryRole,
    GeometryType,
    geometry_node_from_dict,
    geometry_node_to_dict,
)


@dataclass
class CGSTree:
    """Container and helper for constructive geometry trees."""

    nodes: List[GeometryNode] = field(default_factory=list)

    def __iter__(self) -> Iterator[GeometryNode]:
        return iter(self.nodes)

    def __len__(self) -> int:
        return len(self.nodes)

    def __getitem__(self, index: int) -> GeometryNode:
        return self.nodes[index]

    def __setitem__(self, index: int, value: GeometryNode) -> None:
        self.nodes[index] = value

    def add_geometry_node(self, node: GeometryNode) -> int:
        self.nodes.append(node)
        return len(self.nodes) - 1

    def remove_geometry_node(self, index: int) -> bool:
        if 0 <= index < len(self.nodes):
            del self.nodes[index]
            return True
        return False

    def update_geometry_node(self, index: int, node: GeometryNode) -> bool:
        if 0 <= index < len(self.nodes):
            self.nodes[index] = node
            return True
        return False

    def move_geometry_node(self, from_index: int, to_index: int) -> bool:
        if not (0 <= from_index < len(self.nodes) and 0 <= to_index < len(self.nodes)):
            return False
        self.nodes[from_index], self.nodes[to_index] = self.nodes[to_index], self.nodes[from_index]
        return True

    def add_branch_node(self, parent_index: int, branch_node: GeometryNode) -> Optional[int]:
        if not (0 <= parent_index < len(self.nodes)):
            return None
        parent_node = self.nodes[parent_index]

        if isinstance(parent_node.geometry, str):
            original_geometry = parent_node.geometry
            original_geometry_type = parent_node.geometry_type
            original_node = GeometryNode(
                role=GeometryRole.UNION,
                geometry_type=original_geometry_type,
                geometry=original_geometry,
                pos=parent_node.pos,
                rotation=parent_node.rotation,
                material=parent_node.material,
            )
            parent_node.role = GeometryRole.UNION
            parent_node.geometry_type = GeometryType.TREE
            parent_node.geometry = [original_node]
            parent_node.pos = [0, 0, 0]
            parent_node.rotation = [0, 0, 0]
            parent_node.material = "Default"

        if isinstance(parent_node.geometry, list):
            parent_node.geometry.append(branch_node)
            return len(parent_node.geometry) - 1
        return None

    def find_node_index(self, target_node: GeometryNode) -> int:
        for index, node in enumerate(self.nodes):
            if self._find_node_recursive(node, target_node):
                return index
        return -1

    def replace(self, nodes: Iterable[GeometryNode]) -> None:
        self.nodes = list(nodes)

    def to_serializable(self) -> List[Dict[str, Any]]:
        return [geometry_node_to_dict(node) for node in self.nodes]

    @classmethod
    def from_serializable(cls, data: Iterable[Dict[str, Any]]) -> 'CGSTree':
        tree = cls()
        for node_data in data:
            tree.nodes.append(geometry_node_from_dict(node_data))
        return tree

    @staticmethod
    def create_default_geometry_node() -> GeometryNode:
        return GeometryNode(
            role=GeometryRole.UNION,
            geometry_type=GeometryType.SPHERE,
            geometry="sphere",
            pos=[0, 0, 0],
            rotation=[0, 0, 0],
            material="SiO2",
        )

    @staticmethod
    def create_branch_geometry_node() -> GeometryNode:
        return GeometryNode(
            role=GeometryRole.UNION,
            geometry_type=GeometryType.SPHERE,
            geometry="sphere",
            pos=[0, 0, 0],
            rotation=[0, 0, 0],
            material="SiO2",
        )

    def _find_node_recursive(self, search_node: GeometryNode, target_node: GeometryNode) -> bool:
        if search_node == target_node:
            return True
        if isinstance(search_node.geometry, list):
            for sub_node in search_node.geometry:
                if isinstance(sub_node, GeometryNode) and self._find_node_recursive(sub_node, target_node):
                    return True
        return False
