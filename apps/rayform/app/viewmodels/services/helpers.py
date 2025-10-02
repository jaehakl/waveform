from __future__ import annotations

from typing import Callable, Dict, Optional, Any, List, Union
from PySide6.QtCore import Signal, QObject

class ViewModelHelpers():
    def _set_and_emit(vm, attr_name: str, value: Any, signal: Optional[Signal] = None) -> bool:
        """Update a private attribute and emit the associated signal if value changed."""
        current = getattr(vm, attr_name)
        if current == value:
            return False
        setattr(vm, attr_name, value)
        if signal is not None:
            signal.emit(value)
        else:
            vm.state_changed.emit()
        return True

    def set_status_message(vm, message: str) -> None:
        message = message or ""
        vm._set_and_emit("_status_message", message, vm.status_message_changed)

    def _notify_workspace_data(vm, workspace_name: str, workspace_data: WorkspaceData) -> None:
        """Notify listeners about workspace data changes."""
        vm.data_changed.emit(workspace_name, workspace_data)
        vm.cgs_tree_changed.emit(workspace_name, list(workspace_data.cgs_tree))
        vm.parameters_changed.emit(workspace_name, dict(workspace_data.parameters))
        vm.materials_changed.emit(workspace_name, dict(workspace_data.materials))
