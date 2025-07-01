# Copyright (C) 2023 Jaehak Lee

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

class Prop(QObject):
    updated = Signal(object)
    def __init__(self, value=None):
        super().__init__()
        self._value = value
        
    def get(self, *keys):
        value_alias = self._value
        for key in keys:
            value_alias = value_alias[key]
        return value_alias

    def set(self, value, *keys):
        value_alias = self._value
        if len(keys) > 0:
            for key in keys[:-1]:
                value_alias = value_alias[key]
            value_alias[keys[-1]] = value
        else:
            self._value = value
        self.updated.emit(self)

    def append(self, element):
        if type(self._value).__name__ == "list":
            self._value.append(element)
            self.updated.emit(self)
        else:
            raise TypeError
    
    def remove(self, element):
        if type(self._value).__name__ == "list":
            self._value.remove(element)
            self.updated.emit(self)
        else:
            raise TypeError

