from __future__ import annotations

import json
from typing import Callable, Dict, Optional, Any, List, Union
from PySide6.QtCore import Signal, QObject


from models import CGSTree, GeometryNode, GeometryRole, GeometryType, WorkspaceData

class WorkspaceService():
    def ensure_workspace(vm, name: str) -> WorkspaceData:
        if name not in vm._workspace_data:
            vm._workspace_data[name] = WorkspaceData()
            vm._workspace_data[name].cgs_tree.set_test_tree()
            vm.test_rays(name)
            vm._notify_workspace_data(name, vm._workspace_data[name])
        return vm._workspace_data[name]


    def workspace_has_persistable_data(vm, name: str) -> bool:
        """Return True when the workspace has data worth saving."""
        data = vm.get_workspace_data(name)
        if data is None:
            return False
        return bool(data.cgs_tree) or bool(data.parameters) or bool(data.materials)

    def save_workspace_to_file(vm, name: str, file_path: str) -> None:
        """Persist the requested workspace to disk."""
        workspace_data = vm.ensure_workspace(name)
        data_dict = workspace_data.to_dict()
        with open(file_path, 'w', encoding='utf-8') as handle:
            json.dump(data_dict, handle, indent=2, ensure_ascii=False)

    def load_workspace_from_file(vm, name: str, file_path: str) -> None:
        """Load workspace data from ``file_path`` into the requested workspace."""
        with open(file_path, 'r', encoding='utf-8') as handle:
            data_dict = json.load(handle)
        workspace_data = WorkspaceData.from_dict(data_dict)
        vm._workspace_data[name] = workspace_data
        vm._notify_workspace_data(name, workspace_data)

    def save_workspace_via_dialog(
        vm,
        workspace: Optional[str],
        prompt_save: Callable[[str, str], Optional[str]],
    ) -> None:
        """Coordinate workspace saving using a UI-provided dialog callback."""
        if not workspace:
            vm.set_status_message("No workspace selected")
            return

        if not vm.workspace_has_persistable_data(workspace):
            vm.set_status_message(f"No data to save in {workspace}")
            return

        file_path = prompt_save(
            f"Save CGS Data - {workspace}",
            f"{workspace}_cgs_data.json",
        )
        if not file_path:
            return

        try:
            vm.save_workspace_to_file(workspace, file_path)
            vm.set_status_message(f"Saved CGS data to {file_path}")
        except Exception as exc:
            vm.set_status_message(f"Error saving data: {exc}")

    def load_workspace_via_dialog(
        vm,
        workspace: Optional[str],
        prompt_open: Callable[[str], Optional[str]],
    ) -> bool:
        """Coordinate workspace loading using a UI-provided dialog callback."""
        if not workspace:
            vm.set_status_message("No workspace selected")
            return False

        file_path = prompt_open(f"Load CGS Data - {workspace}")
        if not file_path:
            return False

        try:
            vm.load_workspace_from_file(workspace, file_path)
            vm.set_status_message(f"Loaded CGS data from {file_path}")
            return True
        except Exception as exc:
            vm.set_status_message(f"Error loading data: {exc}")
            return False

    def apply_workspace_example_data(vm, workspace: Optional[str]) -> bool:
        """Populate the workspace with example data and report success."""
        if not workspace:
            vm.set_status_message("No workspace selected")
            return False

        try:
            vm.load_workspace_example_data(workspace)
            vm.set_status_message(f"Loaded example data for {workspace}")
            return True
        except Exception as exc:
            vm.set_status_message(f"Error loading example data: {exc}")
            return False

    def save_workspace_data(vm, workspace: str, file_path: str) -> None:
        """Save workspace data to file."""
        if not workspace:
            vm.set_status_message("No workspace selected")
            return

        if not vm.workspace_has_persistable_data(workspace):
            vm.set_status_message(f"No data to save in {workspace}")
            return

        try:
            vm.save_workspace_to_file(workspace, file_path)
            vm.set_status_message(f"Saved CGS data to {file_path}")
        except Exception as exc:
            vm.set_status_message(f"Error saving data: {exc}")

    def load_workspace_data(vm, workspace: str, file_path: str) -> None:
        """Load workspace data from file."""
        if not workspace:
            vm.set_status_message("No workspace selected")
            return

        try:
            vm.load_workspace_from_file(workspace, file_path)
            vm.set_status_message(f"Loaded CGS data from {file_path}")
            # UI 업데이트를 위한 시그널 발생
            vm._workspace_data_loaded.emit(workspace)
        except Exception as exc:
            vm.set_status_message(f"Error loading data: {exc}")

    def load_example_data(vm, workspace: Optional[str]) -> None:
        """Load example data for workspace."""
        if not workspace:
            vm.set_status_message("No workspace selected")
            return

        try:
            vm.load_workspace_example_data(workspace)
            vm.set_status_message(f"Loaded example data for {workspace}")
            # UI 업데이트를 위한 시그널 발생
            vm._workspace_data_loaded.emit(workspace)
        except Exception as exc:
            vm.set_status_message(f"Error loading example data: {exc}")