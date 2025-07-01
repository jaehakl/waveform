# Copyright (C) 2023 Jaehak Lee

from PySide6.QtGui import *
from PySide6.QtGui import QFocusEvent
from PySide6.QtWidgets import *
from PySide6.QtCore import *

from .prop import Prop
from .main_window import activate_component, deactivate_component

class AbstractComp(QWidget):
    clicked = Signal(object)
    doubleClicked = Signal(object)
    changed = Signal(object)
    submitted = Signal(object)
    def __init__(self,container=None,parent=None,styles=None,
                 onClick=None,onDoubleClick=None,onChange=None,onSubmit=None,
                 props={}):
        super().__init__(parent)

        if container is not None:
            container.layout().addWidget(self)

        self.styles = styles
        self.onClick = onClick
        self.onDoubleClick = onDoubleClick
        self.onChange = onChange
        self.onSubmit = onSubmit

        if onClick is not None:
            self.clicked.connect(onClick)
        if onDoubleClick is not None:
            self.doubleClicked.connect(onDoubleClick)
        if onChange is not None:
            self.changed.connect(onChange)
        if onSubmit is not None:
            self.submitted.connect(onSubmit)

        self.props = {}
        for key in props:
            if type(props[key]).__name__ == "Prop":
                self.props[key] = props[key]
                self.props[key].updated.connect(self.updateUI)
            else:
                #Fake Prop
                self.props[key] = Prop(props[key])

        self.setLayout(self.layoutClass())
        self.layout().setAlignment(Qt.AlignTop)

        self.initUI()
        self.updateUI()

        if styles is not None:
            self.setStyleSheet(styles)


    def layoutClass(self):
        return QVBoxLayout()

    def initUI(self):
        pass

    def updateUI(self):
        pass

    def refresh(self):
        for i in range(self.layout().count()):
            self.layout().itemAt(i).widget().deleteLater()
        self.initUI()

    #to set component tools to main window  
    def activate(self, *args):
        activate_component(self)

    def deactivate(self, *args):
        deactivate_component(self)

    def toolbars(self):
        #example : {"top_toolbar": "QToolBar()",
        #    "left_toolbar": "QToolBar()}
        return {}
    #to set component tools to main window end
