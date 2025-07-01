# Copyright (C) 2023 Jaehak Lee

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

from .state import State

class StatusBar(QStatusBar):
    def __init__(self, parent):
        super().__init__(parent)
        State().status_message.updated.connect(self.show_message)

    def show_message(self, message):
        self.showMessage(message.get(), 3000)

class MainWindow(QMainWindow):
    def __init__(self, menubar_class):    
        super().__init__()

        #메인 윈도우 환경 설정
        self.setCorner(Qt.BottomLeftCorner, Qt.LeftDockWidgetArea)
        self.setCorner(Qt.BottomRightCorner, Qt.RightDockWidgetArea)        

        self.setMenuBar(menubar_class(self))        
        self.setStatusBar(StatusBar(self))

        #모듈 위젯
        self.central_widget = QWidget()
        self.left_dockWidget = QDockWidget()
        self.right_dockWidget = QDockWidget()
        self.bottom_dockWidget = QDockWidget()

        self.toolbar = QToolBar()        
        State().component_toolbars.updated.connect(self.update_component_toolbars)

    def setSideWidget(self, title, widget, area):
        dockwidget = QDockWidget(title, self)
        dockwidget.setWidget(widget)
        self.addDockWidget(area, dockwidget)
        return dockwidget

    def loadModule(self, module):
        self.module = module
        self.setCentralWidget(module.gui.CentralWidget(parent=self))

        try:
            self.removeToolBar(self.toolbar)
        except AttributeError:
            pass
        try:
            self.removeDockWidget(self.left_dockWidget)
        except AttributeError:
            pass
        try:
            self.removeDockWidget(self.right_dockWidget)
        except AttributeError:
            pass
        try:
            self.removeDockWidget(self.bottom_dockWidget)
        except AttributeError:
            pass
        
        try:            
            self.toolbar = module.gui.ToolBar(parent=self)
            self.addToolBar(self.toolbar)
        except AttributeError:
            pass

        try:
            widget = module.gui.LeftWidget(parent=self)
            title = widget.title if 'title' in widget.__dict__.keys() else type(widget).__name__
            self.left_dockWidget = self.setSideWidget(title,widget,Qt.LeftDockWidgetArea)
        except AttributeError:
            pass        
        try:
            widget = module.gui.RightWidget(parent=self)
            title = widget.title if 'title' in widget.__dict__.keys() else type(widget).__name__
            self.right_dockWidget = self.setSideWidget(title,widget,Qt.RightDockWidgetArea)
        except AttributeError:
            pass
        try:
            widget = module.gui.BottomWidget(parent=self)
            title = widget.title if 'title' in widget.__dict__.keys() else type(widget).__name__
            self.bottom_dockWidget = self.setSideWidget(title,widget,Qt.BottomDockWidgetArea)
        except AttributeError:
            pass
        #self.resizeDocks([self.left_dockWidget, self.right_dockWidget, self.bottom_dockWidget], [200,450,300], Qt.Horizontal)

    def currentModule(self):
        return self.module
    
    def update_component_toolbars(self, *args):
        toolbars = State().component_toolbars.get()
        for name in toolbars.keys():
            if len(name) >= 6:
                if name[:6] == "bottom":
                    self.addToolBar(Qt.BottomToolBarArea,toolbars[name])
                elif name[:4] == "left":
                    self.addToolBar(Qt.LeftToolBarArea,toolbars[name])
                elif name[:5] == "right":
                    self.addToolBar(Qt.RightToolBarArea,toolbars[name])
                else:
                    self.addToolBar(toolbars[name])
            else:
                self.addToolBar(toolbars[name])                
