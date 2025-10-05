from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, Iterator, List, Optional
import copy

from .geometry import (
    GeometryNode,
    GeometryRole,
    GeometryType,
    geometry_node_from_dict,
    geometry_node_to_dict,
)

TEST_TREE = [
    GeometryNode(
        role=GeometryRole.UNION,
        geometry_type=GeometryType.TREE,
        geometry=[
            GeometryNode(
                role=GeometryRole.UNION,
                geometry_type=GeometryType.TREE,
                geometry=[
                    GeometryNode(
                        role=GeometryRole.UNION,
                        geometry_type=GeometryType.SPHERE,
                        geometry="sphere",
                        pos=[0, 1, 0],
                        rotation=[0, 0, 0],
                        size=[2, 2, 2],
                        material="glass",
                    ),
                    GeometryNode(
                        role=GeometryRole.INTERSECT,
                        geometry_type=GeometryType.SPHERE,
                        geometry="sphere",
                        pos=[0, -1, 0],
                        rotation=[0, 0, 0],
                        size=[2, 2, 2],
                        material="glass",
                    ),
                ],
                pos=[1, 0, 0],
                rotation=[0, 0, 0],
                size=[1, 1, 1],
                material="glass",
            ),
            GeometryNode(
                role=GeometryRole.SUBTRACT,
                geometry_type=GeometryType.SPHERE,
                geometry="sphere",
                pos=[0, 0, 0],
                rotation=[0, 0, 0],
                size=[2, 2, 2],
                material="glass",
            ),
        ],
        pos=[0, 0, 0],
        rotation=[0, 0, 0],
        size=[1, 1, 1],
        material="glass",
    ),
]

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
        self.on_update()

    def on_update(self) -> None:
        for node in self.nodes:
            node.eval_M()

    def replace(self, nodes: Iterable[GeometryNode]) -> None:
        self.nodes = list(nodes)
        self.on_update()

    def to_serializable(self) -> List[Dict[str, Any]]:
        return [geometry_node_to_dict(node) for node in self.nodes]

    @classmethod
    def from_serializable(cls, data: Iterable[Dict[str, Any]]) -> 'CGSTree':
        tree = cls()
        for node_data in data:
            tree.nodes.append(geometry_node_from_dict(node_data))
        tree.on_update()
        return tree

    def set_test_tree(self) -> None:
        self.nodes = TEST_TREE
        self.on_update()

    def add_primitive_geometry(self, geometry: str = "sphere") -> int:
        node = GeometryNode(
            role=GeometryRole.UNION,
            geometry_type=GeometryType(geometry),
            geometry=geometry,
            pos=[0, 0, 0],
            rotation=[0, 0, 0],
            size=[2, 2, 2],
            material="glass",
        )
        self.nodes.append(node)
        self.on_update()
        return len(self.nodes) - 1

    def remove_geometry_node(self, index: int) -> bool:
        if 0 <= index < len(self.nodes):
            del self.nodes[index]
            self.on_update()
            return True
        return False

    def update_geometry_node(self, index: int, node: GeometryNode) -> bool:
        if 0 <= index < len(self.nodes):
            self.nodes[index] = node
            self.on_update()
            return True
        return False

    def move_geometry_node(self, from_index: int, to_index: int) -> bool:
        if not (0 <= from_index < len(self.nodes) and 0 <= to_index < len(self.nodes)):
            return False
        self.nodes[from_index], self.nodes[to_index] = self.nodes[to_index], self.nodes[from_index]
        self.on_update()
        return True

    def merge_geometry_nodes(self, operation: GeometryRole, index1: int, index2: int) -> bool:
        if not (0 <= index1 < len(self.nodes) and 0 <= index2 < len(self.nodes)):
            return False
        if index1 == index2:
            return False
        node_1 = copy.deepcopy(self.nodes[index1])
        node_2 = copy.deepcopy(self.nodes[index2])
        node_2.role = operation
        self.nodes[index1].geometry = [node_1, node_2]
        self.nodes[index1].geometry_type = GeometryType.TREE
        self.nodes[index1].material = node_1.material
        self.nodes[index1].pos = [0,0,0]
        self.nodes[index1].rotation = [0,0,0]
        self.nodes[index1].size = [1,1,1]
        self.on_update()
        return True
