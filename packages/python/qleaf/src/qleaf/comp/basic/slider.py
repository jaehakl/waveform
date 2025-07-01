# Copyright (C) 2024 Jaehak Lee

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp

class SliderComp(AbstractComp):
    def layoutClass(self):
        return QHBoxLayout()

    def initUI(self):
        self.min = self.props["min"].get() if "min" in self.props.keys() else 0
        self.max = self.props["max"].get() if "max" in self.props.keys() else 1
        self.scale = (self.max-self.min)/100

        if "label" in self.props:
            self.label = QLabel()
            self.layout().addWidget(self.label)
        self.slider = QSlider(Qt.Horizontal)
        self.slider.valueChanged.connect(self.emit_changed)
        self.slider.sliderReleased.connect(self.emit_submitted)
        self.layout().addWidget(self.slider)

    def updateUI(self):
        if "label" in self.props:
            label = self.props["label"].get()
            self.label.setText(label)
        v = self.props["value"].get()
        self.slider.setValue(int(v/self.scale))

    def emit_changed(self, value):
        v = self.slider.value()*self.scale        
        self.changed.emit(v)

    def emit_submitted(self):
        v = self.slider.value()*self.scale
        self.submitted.emit(v)