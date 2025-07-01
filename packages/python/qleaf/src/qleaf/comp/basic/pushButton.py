# Copyright (C) 2023 Jaehak Lee

#Component 정의
from functools import partial

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp

class PushButtonComp(AbstractComp):
    def initUI(self):
        self.button = QPushButton()
        self.button.clicked.connect(partial(self.clicked.emit, self.props["label"].get()))
        self.layout().addWidget(self.button)

    def updateUI(self):
        label = self.props["label"].get()
        self.button.setText(label)
