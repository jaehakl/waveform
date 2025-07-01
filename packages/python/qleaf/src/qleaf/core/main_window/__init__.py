# Copyright (C) 2023 Jaehak Lee

from .state import State
from . import gui
from .gui import MainWindow

def show_status(message):
    State().status_message.set(message)

def activate_component(component):
    if State().current_component is not None:
        deactivate_component(State().current_component)
    State().current_component = component
    State().component_toolbars.set(component.toolbars())

def deactivate_component(component):
    toolbars = State().component_toolbars.get()
    for name in toolbars.keys():
        toolbars[name].deleteLater()
    State().component_toolbars.set({})
