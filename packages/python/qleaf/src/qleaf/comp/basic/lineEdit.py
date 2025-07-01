# Copyright (C) 2023 Jaehak Lee

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp

class LineEditComp(AbstractComp):
    def layoutClass(self):
        return QHBoxLayout()

    def initUI(self):
        if "label" in self.props:
            self.label = QLabel()
            self.layout().addWidget(self.label)
        
        self.text_dtype = type(self.props["text"].get())
        self.text = QLineEdit()
        self.text.textChanged.connect(self.emit_change)
        self.text.editingFinished.connect(self.emit_submit)
        self.layout().addWidget(self.text)

    def updateUI(self):
        if "label" in self.props:
            label = self.props["label"].get()
            self.label.setText(label)
        text = self.props["text"].get()
        self.text_dtype = type(text)
        self.text.setText(str(text))

    def emit_change(self, *args):
        text = self.text.text()
        if self.text_dtype == int:
            text = int(text)
        elif self.text_dtype == float:
            text = float(text)
        self.changed.emit(text)

    def emit_submit(self, *args):
        text = self.text.text()
        if self.text_dtype == int:
            text = int(text)
        elif self.text_dtype == float:
            text = float(text)
        self.submitted.emit(text)        