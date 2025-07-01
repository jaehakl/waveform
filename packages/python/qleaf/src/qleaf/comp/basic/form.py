# Copyright (C) 2023 Jaehak Lee

#Standard library modules
from functools import partial

#Third-party modules
from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp
from ...core.prop import Prop

class FormComp(AbstractComp):
    def layoutClass(self):
        return QFormLayout()

    def initUI(self):
        self.data = self.props["data"]
        self.editors = {}

        self.add_rows()

        if self.onSubmit != None:
            self.submit_button = QPushButton("Submit")
            self.layout().addRow("",self.submit_button)
            self.submit_button.clicked.connect(self.submit)

    def add_rows(self):
        #default
        data_dict = self.data.get()
        for key in data_dict.keys():
            if type(data_dict[key]).__name__ == "dict":
                self.layout().addRow(key,FormComp(props={"data":Prop(data_dict[key])}))
            else:
                self.add_row(QLineEdit, key, key)

        #self.add_row(QComboBox, "model", "Physics Model", ["FDTD"])
        #self.add_row(QComboBox, "engine", "Physics Engine", ["MEEP","Waveform"])
        #self.add_row(QLineEdit, "dx", "Unit Cell size (um)")
        #self.add_row(QLineEdit, "cell_size", "x, y, z width (um)")
        #self.add_row(QLineEdit, "len_pml", "PML 길이 (x, y, z 축)")
        #self.add_row(QLineEdit, "phase_pbc", "Phaseshift of Bloch PBC (x, y, z 축)")
        #self.add_row(QLineEdit, "simulationTime", "Simulation Time (fs)")
        pass

    def add_row(self, editor_class, key, label, options = []):
        data_dict = self.data.get()
        if key in data_dict.keys():
            init_value = data_dict[key]
        else:
            init_value = ""
        if editor_class == QLineEdit:
            self.editors[key] = QLineEdit(str(init_value))
            self.editors[key].editingFinished.connect(partial(self.update,key))
        elif editor_class == QComboBox:
            self.editors[key] = QComboBox()
            for option in options:
                self.editors[key].addItem(option)
            self.editors[key].setCurrentText(str(init_value))                                    
            self.editors[key].currentTextChanged.connect(partial(self.update,key))
        self.layout().addRow(label,self.editors[key])

    def update(self, key, *args, **kwargs):
        data_dict = self.data.get()
        if type(self.editors[key]).__name__ == "QLineEdit":
            data_dict[key] = self.editors[key].text()
        elif type(self.editors[key]).__name__ == "QComboBox":
            data_dict[key] = self.editors[key].currentText()                        
        self.changed.emit(data_dict)

    def submit(self, *args, **kwargs):
        data_dict = self.data.get()
        for key in self.editors.keys():            
            if type(self.editors[key]).__name__ == "QLineEdit":
                data_dict[key] = self.editors[key].text()
            elif type(self.editors[key]).__name__ == "QComboBox":
                data_dict[key] = self.editors[key].currentText()                
        self.submitted.emit(data_dict)

    def updateUI(self):
        data_dict = self.data.get()
        for key in self.editors.keys():
            if key in data_dict.keys():
                if type(self.editors[key]).__name__ == "QLineEdit":
                    self.editors[key].setText(str(data_dict[key]))
                elif type(self.editors[key]).__name__ == "QComboBox":
                    self.editors[key].setCurrentText(str(data_dict[key]))


