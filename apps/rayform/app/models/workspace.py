from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Union

from .cgs_tree import CGSTree
from .geometry import GeometryNode


@dataclass
class WorkspaceData:
    """Workspace level data container."""

    cgs_tree: CGSTree = field(default_factory=CGSTree)
    parameters: Dict[str, float] = field(default_factory=dict)
    materials: Dict[str, Dict[float, complex]] = field(default_factory=dict)

    def add_geometry_node(self, node: GeometryNode) -> int:
        return self.cgs_tree.add_geometry_node(node)

    def remove_geometry_node(self, index: int) -> bool:
        return self.cgs_tree.remove_geometry_node(index)

    def update_material(self, material_id: str, wavelength_data: Dict[float, complex]) -> None:
        self.materials[material_id] = wavelength_data

    def remove_material(self, material_id: str) -> None:
        self.materials.pop(material_id, None)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cgs_tree": self.cgs_tree.to_serializable(),
            "parameters": self.parameters,
            "materials": {
                mat_id: {
                    str(wl): {"n": complex(nk).real, "k": complex(nk).imag}
                    for wl, nk in data.items()
                }
                for mat_id, data in self.materials.items()
            },
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'WorkspaceData':
        workspace = cls()
        workspace.cgs_tree = CGSTree.from_serializable(data.get("cgs_tree", []))
        workspace.parameters = data.get("parameters", {})
        for mat_id, mat_data in data.get("materials", {}).items():
            wavelength_data: Dict[float, complex] = {}
            for wl_str, nk_data in mat_data.items():
                wl = float(wl_str)
                n = nk_data.get("n", 0.0)
                k = nk_data.get("k", 0.0)
                wavelength_data[wl] = complex(n, k)
            workspace.materials[mat_id] = wavelength_data
        return workspace
