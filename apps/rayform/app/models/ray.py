from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Union, List

@dataclass
class Ray:
    origin: List[float] = field(default_factory=list)
    direction: List[float] = field(default_factory=list)
    power: float = 1.0
    wavelength: float = 550.0
    opl: float = 10.0
    nhits: int = 0
