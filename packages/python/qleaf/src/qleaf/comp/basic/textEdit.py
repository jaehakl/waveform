# Copyright (C) 2023 Jaehak Lee

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp

class TextEditComp(AbstractComp):
    def layoutClass(self):
        return QHBoxLayout()

    def initUI(self):
        if "label" in self.props:
            self.label = QLabel()
            self.layout().addWidget(self.label)
        self.text = NewTextEdit()
        self.text.textEdited.connect(self.changed.emit)
        self.layout().addWidget(self.text)

    def updateUI(self):
        if "label" in self.props:
            label = self.props["label"].get()
            self.label.setText(label)
        text = self.props["text"].get()
        self.text.setText(text)

class NewTextEdit(QTextEdit):
    textEdited = Signal(object)
    def focusOutEvent(self, event):
        text = self.toPlainText()
        self.textEdited.emit(text)
        self.moveCursor(QTextCursor.End)