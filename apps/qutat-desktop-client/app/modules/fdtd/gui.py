# Copyright (C) 2023 Jaehak Lee

import platform, os
import numpy as np

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

from qleaf.core import cout
from qleaf.proc import SubprocDict

from api.auth import get
from api import api as RestApi

from .state import State
from . import dataio
from .service import setup_io
from .components.upload_setup_dialog import UploadSetupDialog
from .components.monitor_widget import MonitorWidget
from .components.result_widget import ResultWidget
from .components.data_table_widget import DataTableWidget, DictFormWidget, MaterialTableWidget
from .components.input_3d_view import Input3Dview
from .components.setup_list_widget import SetupListTabsWidget
from .components.entity_list_widget import EntityListTabsWidget

from .service.run_simulation import run_simulation



import configparser

SOLVERS = configparser.ConfigParser()
SOLVERS.optionxform = str
SOLVERS.read(os.getenv('QUTAT_BASE_DIR')+'/SOLVERS.ini')

if platform.system() == "Windows":
    CURRENT_FILE_PATH = "/".join(os.path.dirname(os.path.abspath(__file__)).split("\\")) # for windows
else:
    CURRENT_FILE_PATH = os.path.dirname(os.path.abspath(__file__))


class ToolBar(QToolBar):
    def __init__(self, parent):
        super().__init__(parent)

        self.addAction("Regenerate")
        self.addAction("Run")
        self.addAction("Run on Cloud")
        self.addAction("10")        
        self.addAction("100")        
        self.addAction("Cancel")
        self.addSeparator()

        self.show_space_check = {}
        for key in State().display.keys():
            self.show_space_check[key] = QCheckBox(key,checked=True)
            self.show_space_check[key].stateChanged.connect(lambda v, label=key: self.toggle_display(label))
            self.addWidget(self.show_space_check[key])
        
        self.addSeparator()
        self.addWidget(QLabel("View:"))
        self.addAction("X")
        self.addAction("Y")
        self.addAction("Z")
        self.addSeparator()

        self.actionTriggered.connect(self.do_action)

    def toggle_display(self, label):
        value = self.show_space_check[label].checkState()
        if value == Qt.Checked:
            State().display[label].set(True)
        else:
            State().display[label].set(False)


    def do_action(self, action):
        if action.text() == "Regenerate":
            State().eval_setup_data()
        elif action.text() == "Run":
            run_simulation()
        elif action.text() == "Run on Cloud":
            cout("Requesting this entity for the cloud")
            setup_id = State().current_setup_data.get()[0]
            if setup_id == None:
                cout("Please register the setup data first")
            else:                
                entity_array_dict = State().entity_array_dict.get()
                dataio.upload_input(setup_id, entity_array_dict)
                cout("Request sent")
        elif action.text() == "10":
            cout("Generating 10 entities on the cloud")
            setup_id = State().current_setup_data.get()[0]
            if setup_id == None:
                cout("Please register the setup data first")
            else:
                get(RestApi.input_generate(setup_id,'10'))
                cout("Request sent")
        elif action.text() == "100":
            cout("Generating 100 entities on cloud")
            setup_id = State().current_setup_data.get()[0]
            if setup_id == None:
                cout("Please register the setup data first")
            else:                
                get(RestApi.input_generate(setup_id,'10-'))
                cout("Request sent")
                
        elif action.text() == "Cancel":
            SubprocDict().close_subproc("sim")

        elif action.text() == "X":
            State().gl_eye.set(np.array([10.0,0.0,0.0]))
        elif action.text() == "Y":
            State().gl_eye.set(np.array([0.0,10.0,0.0]))
        elif action.text() == "Z":
            State().gl_eye.set(np.array([0.001,0.0,10.0]))

        #print(action.text(), "is triggered")


class LeftWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.title = "Setup List"
        self.layout = QVBoxLayout()
        self.setMinimumSize(300, 500)

        current_solver = QLabel(State().solver.get())
        current_setup = QLabel()
        hlayout_1 =QHBoxLayout()
        hlayout_1.addWidget(current_solver)
        hlayout_1.addWidget(QLabel(" : "))
        hlayout_1.addWidget(current_setup)
        self.layout.addLayout(hlayout_1)
        State().solver.updated.connect(lambda v: current_solver.setText(v.get()))
        State().current_setup_data.updated.connect(lambda v: current_setup.setText(v.get()[1]))

        upload_setup_button = QPushButton("Upload Setup")
        upload_setup_button.clicked.connect(lambda : UploadSetupDialog(self.parent()))

        delete_button = QPushButton("Delete")
        #delete_button.setStyleSheet("background-color: red")
        delete_button.clicked.connect(setup_io.delete_current_setup_in_server)
        hlayout_2 =QHBoxLayout()
        hlayout_2.addWidget(upload_setup_button)
        hlayout_2.addWidget(delete_button)
        self.layout.addLayout(hlayout_2)

        self.layout.addWidget(SetupListTabsWidget())
        self.layout.addWidget(EntityListTabsWidget())
        self.setLayout(self.layout)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_F5:
            print("F5 key pressed")
            setup_io.setup_list_online()


class CentralWidget(QDockWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        #self.setWidget(Input3Dview())
        self.gl_widget = Input3Dview()
        State().gl_eye.updated.connect(self.setEye)
        self.setWidget(self.gl_widget)

    def setEye(self, eye_prop):
        self.gl_widget.setEye(eye_prop.get())


class BottomWidget(QTabWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.title = "Setup Data"
        self.pages = {}
        State().input_vars_defined.updated.connect(self.update_tabs)        
        self.update_tabs()

    def update_tabs(self):
        self.clear()
        for page in self.pages.keys():
            self.pages[page].deleteLater()
        self.pages = {}

        input_vars_all = State().input_vars_defined.get()
        for order in sorted(input_vars_all.keys()):
            for input_vars in input_vars_all[order]:
                var_type = input_vars["meta"]["type"]
                name = input_vars["meta"]["key"]
                title = input_vars["meta"]["title"]
                if input_vars["meta"]["display"] == True:
                    if var_type == "table":
                        self.pages[name] = DataTableWidget(name,input_vars)
                    elif var_type == "dict":
                        self.pages[name] = DictFormWidget(name)
                    self.addTab(self.pages[name],title)

        self.addTab(MaterialTableWidget(),"Material")


class RightWidget(QTabWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.title = "Data"
        monitor_scroll = QScrollArea(self)
        monitor_scroll.setWidgetResizable(True)
        monitor_scroll.setWidget(MonitorWidget())
        self.addTab(monitor_scroll,"Update")
        result_scroll = QScrollArea(self)
        result_scroll.setWidgetResizable(True)
        result_scroll.setMinimumSize(300, 300)
        result_scroll.setWidget(ResultWidget())
        self.addTab(result_scroll,"Result")
        




