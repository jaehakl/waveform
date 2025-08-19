# Copyright (C) 2023 Jaehak Lee

import cv2, pickle, requests, platform, os, json, copy
from functools import partial
import numpy as np
import pandas as pd

import time

import matplotlib
matplotlib.use('Qt5Agg')
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg
from matplotlib.figure import Figure

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

import matform as mf

from qleaf.core import cout
from qleaf.core.abstract_comp import AbstractComp
from qleaf.core.prop import Prop
from qleaf.core.main_window import show_status

from qleaf.comp.basic.form import FormComp
from qleaf.comp.chart.imShow import ImShowCompFromLabeledTensor
from qleaf.comp.basic.table import TableEditorModel, TableView, TableEditorComp
from qleaf.comp.basic import TextComp, PushButtonComp, ListViewComp, ImageComp

from qleaf.proc import SubprocDict

from matform import eval_structure
from lib.physics.structure.geometry_painter import GeometryPainterWidget
from lib.labeled_tensor_list import LabeledTensorListViewer

from api.auth import add_post_login_func, get, post, put, delete
from api import api as RestApi

from .state import State
from . import dataio, setup
from .service import setup_io

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
            solver = State().solver.get()
            if solver in SOLVERS.sections():
                args = []
                if platform.system() == "Windows":
                    for arg_key in ["WIN_ARG_0","WIN_ARG_1","WIN_ARG_2","WIN_ARG_3"]:
                        if arg_key in SOLVERS[solver].keys():
                            args.append(SOLVERS[solver][arg_key])
                elif platform.system() == "Linux":
                    for arg_key in ["LINUX_ARG_0","LINUX_ARG_1","LINUX_ARG_2","LINUX_ARG_3"]:
                        if arg_key in SOLVERS[solver].keys():
                            args.append(SOLVERS[solver][arg_key])
                else:
                    for arg_key in ["LINUX_ARG_0","LINUX_ARG_1","LINUX_ARG_2","LINUX_ARG_3"]:
                        if arg_key in SOLVERS[solver].keys():
                            args.append(SOLVERS[solver][arg_key])                
                port = SubprocDict().open_subproc("sim",*args)

                if port != None:
                    print("Executing "+solver + "using port" + str(port))
                    SubprocDict().execute_subproc("sim_execute","sim",update_sim,lambda r: return_result(r),"run",setup.get_setup_data())
                else:
                    print("Cannot execute "+solver)
            else:
                print("Not a valid solver")
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

def update_sim(r):
    show_status(r["status"])
    if "figures" in r.keys():
        for i, key in enumerate(r["figures"].keys()):
            State().fig_update[i].set(r["figures"][key])
            if i > 2:
                break

def return_result(r):
    if r != None:
        update_sim(r)
        pickle.dump(r, open("sim_result.pkl","wb"))
        State().result_arrays.set(r["arrays"])

        '''
        print(r["arrays"])
        output = {
            "spectra": {},
            "arrays": {},
        }
        for key, value in r["arrays"].items():
            if len(value.shape()) == 1:
                output["spectra"][key] = value
            else:
                output["arrays"][key] = value.data

        State().result_arrays.set(output["arrays"])
        State().result_images.set(r["images"])
        State().result_spectra.set(output["spectra"])
        '''

    SubprocDict().close_subproc("sim")


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
        delete_button.clicked.connect(dataio.delete_current_setup_data)
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


class SetupListTabsWidget(QTabWidget):
    def __init__(self):
        super().__init__()        
        add_post_login_func(setup_io.setup_list_online)
        State().setup_data_list.updated.connect(self.update_tabs)

    def update_tabs(self):
        self.clear()
        for solver in State().setup_data_list.get().keys():
            self.addTab(SetupListComp(
                props={"solver":solver}
            ),solver)


class SetupListComp(AbstractComp): 
    def initUI(self):
        self.selected_item = None
        solver = self.props["solver"].get()
        items = State().setup_data_list.get()
        ListViewComp(self,
            onClick=self.item_selected,
            props={
                "items":Prop(items[solver]),
                "icon_size":Prop(30)}
            )
        
    def item_selected(self, setup_item):
        self.selected_item = setup_item
        self.setDisabled(True) #Lost Focus Due to this
        self.th = HandleSetupSelected(setup_item)
        self.th.start()
        self.th.finished.connect(self.enable)

    def enable(self):
        self.setDisabled(False) #Focus is not Recovered


class HandleSetupSelected(QThread):
    def __init__(self, setup_item):
        super().__init__()
        self.setup_item = setup_item
        if setup_item["solver"] != State().solver.get():
            State().solver.set(setup_item["solver"])

    def run(self, *args):
        State().current_entity_list.set([])
        cout("recieving data")

        setup_item = self.setup_item
        setup_data = setup_io.get_setup(setup_item["id"])
        cout("recieving data ■")

        if setup_data != None:
            State().current_setup_data.set([setup_item["id"],setup_item["title"]])
            setup.set_setup_data(setup_data)
            cout("recieving data ■■ ")

            #setup_id = setup_item["id"]
            #dataio.import_entity_list(setup_id)
            #cout("recieving data ■■■ ")
            #dataio.import_process_list(setup_id)
            #cout("recieving data ■■■■ done")



class EntityListTabsWidget(QTabWidget):
    def __init__(self):
        super().__init__()
        self.addTab(ResultListComp(),"Results")
        self.addTab(ProcessListComp(),"Processes")


class ResultListComp(AbstractComp):
    def __init__(self):
        self.input_id = Prop(None)
        super().__init__()

    def initUI(self):
        TextComp(self, props={"label":"ID : ","text":self.input_id})
        button = PushButtonComp(self, 
                                onClick=self.delete_entity,
                                props={"label":"Delete"})
        #button.setStyleSheet("background-color: red")

        ListViewComp(self,
            onClick=self.item_selected,
            props={"items":State().current_entity_list})
         
    def item_selected(self, entity_item):
        self.input_id.set(entity_item["id"])
        self.setDisabled(True)
        self.th = HandleEntitySelected(entity_item)
        self.th.start()
        self.th.finished.connect(self.enable)

    def enable(self):
        self.setDisabled(False)

    def delete_entity(self, *args):        
        entity_id = self.input_id.get()
        dataio.delete_entity(entity_id)

class ProcessListComp(AbstractComp):
    def __init__(self):
        self.process_id = Prop(None)
        super().__init__()

    def initUI(self):
        TextComp(self, props={"label":"ID : ","text":self.process_id})
        button = PushButtonComp(self, 
                                onClick=self.delete_process,
                                props={"label":"Delete"})
        #button.setStyleSheet("background-color: red")

        ListViewComp(self,
            onClick=self.item_selected,
            props={"items":State().current_process_list})
         
    def item_selected(self, entity_item):
        self.process_id.set(entity_item["id"])

    def delete_process(self, *args):        
        process_id = self.process_id.get()
        dataio.delete_process(process_id)


class HandleEntitySelected(QThread):
    def __init__(self, entity_item):
        super().__init__()
        self.entity_item = entity_item

    def run(self, *args):
        time_0 = time.time()
        cout("recieving data")

        entity_item = self.entity_item

        structure_evaluated, array_dict = eval_structure(
            pd.DataFrame(setup.get_setup_data()["structures"]),
            pd.DataFrame(setup.get_setup_data()["components"]),
            array_dicts_init=requests.get(entity_item["file"]).json()
        )
        State().structure_evaluated.set(structure_evaluated)
        cout("recieving data ■■■ ")

        entity_json = get(RestApi.entity_data(entity_item["id"]))
        
        entity_data = entity_json.json()
        images = {}
        for key, value in entity_data['images'].items():
            images[key] = requests.get(value).content

        for i, key in enumerate(images.keys()):
            State().fig_update[i].set(images[key])
            if i > 2:
                break

        State().result_images.set(images)
        cout("recieving data ■■■■ ")
        for url in entity_data['files'].values():
            if url.endswith("output.pickle"):
                data = pickle.loads(requests.get(url).content)
                State().result_arrays.set(data["arrays"])
    cout("recieving data ■■■■■■■ done")


class CentralWidget(QDockWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        #self.setWidget(Input3Dview())
        self.gl_widget = Input3Dview()
        State().gl_eye.updated.connect(self.setEye)
        self.setWidget(self.gl_widget)

    def setEye(self, eye_prop):
        self.gl_widget.setEye(eye_prop.get())

class Input3Dview(GeometryPainterWidget):
    def __init__(self,parent=None):
        super().__init__(parent)
        State().input_vars_defined.updated.connect(self.connect_data)
        self.connect_data()

    def connect_data(self):
        def setSpaceData(*args):
            form_prop = State().data_form_dicts["settings"]
            if State().display["space"].get():           
                self.show_space(form_prop.get())
            else:
                self.show_space(None)

        def setStructureData(*args):
            data = State().structure_evaluated.get()
            self.show_geometry("structure",data)

        def setRegion(table_name, color, *args):
            if State().display[table_name].get():           
                model = State().data_table_models[table_name].get()
                data_df = model.exportDataFrame()            
                data_df["color"] = mf.write_vectors([color])
                data = data_df.to_dict(orient="records")
                self.show_geometry(table_name, data)
            else:
                self.show_geometry(table_name,[])

        State().data_form_dicts["settings"].updated.connect(setSpaceData)
        State().data_form_dicts["settings"].updated.connect(setStructureData)

        setSpaceData()
        State().display["space"].updated.connect(setSpaceData)
        State().structure_evaluated.updated.connect(setStructureData)
        setStructureData()

        for table_name in State().color_regions_rendered.keys():
            color = State().color_regions_rendered[table_name]
            State().data_form_dicts["settings"].updated.connect(
                partial(setRegion, table_name, color))
            State().data_table_models[table_name].get().dataChanged.connect(
                partial(setRegion, table_name, color))
            State().display[table_name].updated.connect(
                partial(setRegion, table_name, color))
            setRegion(table_name, color)


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


class DictFormWidget(AbstractComp):
    def __init__(self, key):
        super().__init__(props = {
            "data":State().data_form_dicts[key],
            "keys":State().data_form_keys[key]
        })

    def initUI(self):
        component = DictFormComp(self,
            onChange=lambda v: self.props["data"].set(v),
            props=self.props)

class DictFormComp(FormComp):
    def add_rows(self):
        keys = self.props["keys"].get()
        for key in keys.keys():
            self.add_row(QLineEdit, key, keys[key]["title"])


class DataTableWidget(AbstractComp):
    def __init__(self, table_name, input_vars):
        self.table_name = table_name
        self.input_vars = input_vars
        super().__init__()

    def initUI(self):   
        input_vars = self.input_vars
        table_model = State().data_table_models[self.table_name].get()
        component = TableEditorComp(self,  
            props = {"model":State().data_table_models[self.table_name]})

        def appendDictList(dict_list):
            if type(dict_list).__name__ == "list":
                for v in dict_list:
                    table_model.appendDict(v)
            else:
                table_model.appendDict(dict_list)

        for category in input_vars["options"].keys():
            for id in input_vars["options"][category].keys():
                item = input_vars["options"][category][id]
                component.add_context_menu_function(id,
                    partial(appendDictList, copy.deepcopy(item)),[category])   

class MaterialTableWidget(AbstractComp):
    def initUI(self):
        table = MaterialEditorComp(self,
            props = {"model":State().material_table_model})
        
        for category in setup.material.MATERIAL_ID_LIST.keys():
            for id in setup.material.MATERIAL_ID_LIST[category].keys():
                name = setup.material.MATERIAL_ID_LIST[category][id]
                table.add_context_menu_function(name,
                    partial(setup.material.add_material_from_lib, id, name), [category])


class MaterialEditorComp(TableEditorComp):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs)
        self.table.doubleClicked.connect(self.cell_clicked)

    def cell_clicked(self, index):
        clicked_cell_column_name = self.table.model().headerData(index.column(),Qt.Horizontal)
        if clicked_cell_column_name == "sus":
            self.table.model().itemFromIndex(index).setEditable(False)
            material = self.table.model().exportDataFrame().iloc[index.row()]
            SusceptibilityEditorDialog(material.id, index, self)
            

class SusceptibilityEditorDialog(QDialog):
    def __init__(self, material_id, nsus_index, parent):
        super().__init__(parent)

        self.material_id = material_id
        self.nsus_index = nsus_index

        sus_df = State().material_sus.get()
        if len(sus_df) == 0:
            sus_df_material = pd.DataFrame(columns=setup.material.NEW_SUSCEPTIBILITY.keys())
        else:
            sus_df_material = sus_df[sus_df["material_id"]==material_id]

        defaultRowDict = setup.material.NEW_SUSCEPTIBILITY.copy()
        del defaultRowDict["material_id"]

        model = TableEditorModel(defaultRowDict=defaultRowDict)
        model.importDataFrame(sus_df_material.drop("material_id",axis=1))
        model.dataChanged.connect(self.showEpsilon)

        layout = QHBoxLayout()

        self.table = TableView()
        self.table.setModel(model)
        layout.addWidget(self.table)

        right_layout = QVBoxLayout()

        self.chart = FigureCanvasQTAgg(Figure())
        saveButton = QPushButton("Save & Exit")
        saveButton.clicked.connect(self.saveClose)

        right_layout.addWidget(self.chart)
        right_layout.addWidget(saveButton)

        layout.addLayout(right_layout)

        self.setLayout(layout)

        self.setWindowTitle("Material Susceptibility")
        self.resize(1400, 700)
        self.table.resizeColumnsToContents()        

        self.showEpsilon()
        self.exec_()

    def saveClose(self):
        table_df = self.table.model().exportDataFrame()
        table_df["material_id"] = self.material_id
        sus_df = State().material_sus.get()
        sus_df = sus_df[sus_df["material_id"]!=self.material_id]
        if len(table_df) > 0:
            sus_df = pd.concat([sus_df,table_df])
        State().material_sus.set(sus_df)
        State().material_table_model.get().setData(self.nsus_index, len(table_df))
        self.close()

    def showEpsilon(self):
        def get_Lorentz(freq, freq_0, gamma, sigma):
            return sigma*(freq_0**2)/(freq_0**2-freq**2-1j*freq*gamma)            
        
        def get_Drude(freq, freq_0, gamma, sigma):
            return 1j*sigma*(freq_0**2)/(freq*(gamma-1j*freq))

        freqs = np.linspace(0.1, 0.8, 100)

        material = State().material_table_model.get().exportDataFrame().iloc[self.nsus_index.row()]
        eps = mf.parse_vectors(material.eps)
        cond = mf.parse_vectors(material.cond)

        epsilon_names = ["eps_00","eps_11","eps_22","eps_01","eps_02","eps_12"]
        epsilons = []
        for i_diag in [0,1]:
            for i_dir in [0,1,2]:
                amp_cond = (1+1j*cond[i_diag][i_dir]/(2*np.pi*freqs))
                eps_sum = eps[i_diag][i_dir]
                table_df = self.table.model().exportDataFrame()
                for i in range(len(table_df)):
                    el = table_df.iloc[i]
                    sigma = mf.parse_vectors(el["sigma"])

                    freq_0 = el["frequency"]
                    gamma = el["gamma"]

                    if el["sus_class"] == "LorentzianSusceptibility":
                        eps_sum += get_Lorentz(freqs, freq_0, gamma, sigma[i_diag][i_dir])
                    elif el["sus_class"] == "DrudeSusceptibility":
                        eps_sum += get_Drude(freqs, freq_0, gamma, sigma[i_diag][i_dir])
                epsilons.append(amp_cond*eps_sum)

        self.chart.figure.clf()
        for i , name in enumerate(epsilon_names):
            plot = self.chart.figure.add_subplot(2,3,i+1)
            epsilon = epsilons[i]
            plot.plot(freqs, np.real(epsilon),label="Re")
            plot.plot(freqs, np.imag(epsilon),label="Im")
            plot.set_title(name)
            plot.set_xlabel("Frequency (PHz)")
            plot.legend()
        self.chart.figure.tight_layout()
        self.chart.draw()


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
        
class MonitorWidget(AbstractComp):
    def initUI(self):
        ImageComp(self,
            props={"image":State().fig_update[0],
                   "image_size":Prop([300,300])})
        ImageComp(self,
            props={"image":State().fig_update[1],
                   "image_size":Prop([300,300])})
        ImageComp(self,
            props={"image":State().fig_update[2],
                   "image_size":Prop([300,300])})

class ResultWidget(AbstractComp):
    def initUI(self):
        LabeledTensorListViewer(self,
            props={"data":State().result_arrays})



'''
class ArrayWithThumbnails(AbstractComp):
    def layoutClass(self):
        return QVBoxLayout()

    def initUI(self):
        self.image_data = Prop(None)

        self.listview = QListWidget()
        self.listview.setViewMode(QListView.IconMode)
        self.listview.itemClicked.connect(self.list_item_clicked)
        self.layout().addWidget(self.listview)

        ImageComp(self,
            props={"image":self.image_data,
                   "image_size":self.props["image_size"]})    

    def updateUI(self):
        thumbnails = self.props["thumbnails"].get()
        self.listview.clear()
        for key in thumbnails.keys():
            img_data = thumbnails[key]
            qImg = self.image_from_buffer(img_data, (100,100))
            icon = QIcon(QPixmap.fromImage(qImg))
            item = QListWidgetItem(icon, key)
            item.setData(Qt.UserRole, img_data)
            self.listview.addItem(item)

        if len(thumbnails.keys()) > 0:
            self.set_image(list(thumbnails.values())[0])
        else:
            self.set_image(None)

    def image_from_buffer(self, buffer, size=None):
        img_cv = cv2.imdecode(np.frombuffer(buffer, dtype=np.uint8), cv2.IMREAD_COLOR)
        height, width, channel = img_cv.shape
        bytesPerLine = 3 * width
        qImg = QImage(img_cv.data, width, height, bytesPerLine, QImage.Format_RGB888).rgbSwapped()
        if size is not None:
            qImg = qImg.scaled(size[0], size[1], Qt.KeepAspectRatio)
        return qImg

    def list_item_clicked(self, item):
        self.set_image(item.data(Qt.UserRole))

    def set_image(self, value):
        self.image_data.set(value)

    def keyPressEvent(self,event):
        if event.modifiers()==(Qt.ControlModifier):
            if event.key() == Qt.Key_C:
                self.copy_to_clipboard()

    def contextMenuEvent(self, event):        
        menu = QMenu(self)
        action_copy = QAction("Copy to Clipboard",self)
        action_copy.triggered.connect(self.copy_to_clipboard)
        menu.addAction(action_copy)
        menu.exec(event.globalPos())

    def copy_to_clipboard(self):
        item = self.listview.currentItem()
        if item:
            key = item.text()
            data = self.props["data"].get()
            if key in data.keys():
                item_array = data[key]
                text=""
                for row in range(item_array.shape[0]):
                    for col in range(item_array.shape[1]):
                        add_text = str(item_array[row,col])
                        text += add_text + "\t"
                    text+="\n"
                QApplication.clipboard().setText(text)
            else:
                print("No array data")
                QApplication.clipboard().setText("")
'''


class UploadSetupDialog(QDialog):
    def __init__(self, parent):
        super().__init__(parent)
        self.setWindowTitle("Qutat.net 에 셋업 등록")
        self.resize(300, 200)

        today = QDate.currentDate().toString("yyyy-MM-dd")
        title_default = "Setup "+today

        layout = QFormLayout()
        self.setLayout(layout)

        title_edit = QLineEdit(title_default)
        layout.addRow("셋업 제목", title_edit)

        thumbnail_bytes = self.nativeParentWidget().centralWidget().widget().screenShot("PNG")

        thumbnail_image = QLabel()
        thumbnail_image.setPixmap(QPixmap.fromImage(QImage.fromData(thumbnail_bytes)).scaled(200,150))
        layout.addRow("썸네일", thumbnail_image)

        description_edit = QTextEdit()
        layout.addRow("설명", description_edit)

        publish_check = QCheckBox("공개")
        layout.addRow("공개", publish_check)

        submit_button = QPushButton("등록")
        layout.addRow("", submit_button)

        def submit():
            dataio.upload_setup_data(
                {
                    "title": title_edit.text(),
                    "solver": State().solver.get(),
                    "description": description_edit.toPlainText(),
                    "public": publish_check.isChecked(),                    
                },
                {
                    "thumbnail": ("thumbnail.png",thumbnail_bytes)
                }
            )
            self.close()
        
        submit_button.clicked.connect(submit)
        self.exec_()


