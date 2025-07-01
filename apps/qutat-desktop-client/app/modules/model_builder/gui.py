# Copyright (C) 2023 Jaehak Lee
import os, sys
from functools import partial
import requests
import copy
import numpy as np
import json
import pickle
import pandas as pd

os.environ['LOKY_MAX_CPU_COUNT'] = "4"
import pickle

#from PySide6.QtGui import QIcon, QAction
from PySide6.QtWidgets import QFileDialog, QToolBar, QLabel, QWidget, QVBoxLayout, QHBoxLayout, QCheckBox, QPushButton, QDockWidget, QTabWidget, QScrollArea
from PySide6.QtCore import Qt, Signal


from multiprocessing import Pool
from tqdm import tqdm

from sklearn.neighbors import KNeighborsRegressor

import torch
from torch.autograd import Variable
import torch.nn.functional as F

from qleaf.core.abstract_comp import AbstractComp
from qleaf.core.prop import Prop
from qleaf.core import setStyle
from qleaf.core.main_window import show_status
from qleaf.comp.basic import *
from qleaf.comp.chart.lineGraph import LineGraphComp
from qleaf.comp.mplchart import ChartWithList

from matform import ArrayDictData, LabeledTensor, eval_structure


from core.network.auth import get, post
from lib.physics.structure.geometry_painter import GeometryPainterWidget
from lib.labeled_tensor_list import LabeledTensorListViewer, LabeledTensorViewer

from .state import State
from state import MainState

from .dnn_models import *
DNN = [DNNLinear, DNN_1, DNN_2, DNN_3, DNN_4, DNN_5, DNN_6, DNN_7, DNN_8, DNN_9, DNN_10]

from PySide6.QtOpenGLWidgets import QOpenGLWidget
from OpenGL.GL import *
from OpenGL.GLU import *
from OpenGL.GLUT import *

from core.network.backend_api import RestApi

class ToolBar(QToolBar):
    def __init__(self, parent):
        super().__init__(parent)
        MainState().main_window.setCorner(Qt.BottomLeftCorner, Qt.LeftDockWidgetArea)
        MainState().main_window.setCorner(Qt.BottomRightCorner, Qt.RightDockWidgetArea)

        self.data_info = QLabel("선택 데이터 정보")
        self.addWidget(self.data_info)
        self.addAction("모델 불러오기")
        self.addAction("모델 저장")
        self.addAction("모델 다른 이름으로 저장")
        #self.triggered.connect(self.do_action)        
        self.actionTriggered.connect(self.do_action)

        if "module_args" in MainState().__dict__.keys():
            State().setup_id = MainState().module_args["id"]
            State().setup_name = MainState().module_args["name"]
        else:             
            return
        self.data_info.setText(State().setup_name)

    def do_action(self, action):
        if action.text() == "Action1":
            pass
        show_status(action.text() + "is triggered")


class LeftWidget(AbstractComp):        
    def initUI(self):
        Methods.get_set_setup_data()

        #Init_output_features
        self.updateUI()

        State().checked_output_classes.updated.connect(self.output_features_updated)
        State().custom_output.updated.connect(self.updateUI)
        self.output_features_updated()

        ListViewComp(self,
            onClick=self.entity_selected,
            props={"items":State().entity_list})        
        CheckList(self,
            onChange=State().checked_output_classes.set,
            props={"data":State().checked_output_classes})
        PushButtonComp(self,
            onClick=self.add_new,
            props={"label":Prop("Feature 추가")})

    def updateUI(self):
        origianl_output_data = State().original_output.get()
        custom_output_data = State().custom_output.get()
        checked_output_classes = {}
        for outputclass in origianl_output_data.keys():
            checked_output_classes[outputclass] = False        
        for outputclass in custom_output_data.keys():
            checked_output_classes[outputclass] = False
        State().checked_output_classes.set(checked_output_classes)

    def entity_selected(self, data):
        array_dict = requests.get(data['input']).json()
        input_array_dict = ArrayDictData(array_dict)
        State().structure_array_dict.set(input_array_dict)

        output_data_files = get(RestApi.results_files(data['id'])).json()
        State().original_output.set(Methods.request_original_output_data(output_data_files))
        State().original_output_data.set(Methods.request_original_output_data(output_data_files, as_ndarray=True))
        self.output_features_updated()

    def output_features_updated(self,*args):
        origianl_output_data = State().original_output.get()
        checked_output_classes = State().checked_output_classes.get()
        lt_dict_display = {}
        for outputclass in origianl_output_data.keys():
            if checked_output_classes[outputclass]:
                lt_dict_display[outputclass] = origianl_output_data[outputclass]
        for outputclass in State().custom_output.get().keys():
            if checked_output_classes[outputclass]:
                func_text = State().custom_output.get()[outputclass]
                rv = Methods.eval_custom_feature(func_text=func_text)
                lt_dict_display[outputclass] = LabeledTensor(rv)
        State().lt_dict_display.set(lt_dict_display)        

    def add_new(self):
        self.new_output_window = QWidget()
        self.new_output_window.setLayout(QVBoxLayout())

        #default_function = "+".join(["v['"+key+"'].sum()" for key in State().original_output.get().keys()])
        default_function = "(abs(v['vffs'][0])**2+abs(v['vffs'][1])**2+abs(v['vffs'][2])**2\
                                    ).sum(axis=1).sum(axis=1).sum(axis=1)"
        
        CustomOutputEditorComp(self.new_output_window,props={"function":default_function})
        self.new_output_window.setWindowFlags(Qt.WindowStaysOnTopHint)
        self.new_output_window.show()

class CentralWidget(QDockWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.title = "Central Widget"
        self.setWidget(EntityStructure())

class EntityStructure(GeometryPainterWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        State().structure_array_dict.updated.connect(self.update_structure)
    
    def update_structure(self, structure_array_dict_prop):
        array_dict = structure_array_dict_prop.get()
        structure_evaluated, array_dict = eval_structure(
            pd.DataFrame(State().setup["setup_data"]["structures"]),
            pd.DataFrame(State().setup["setup_data"]["components"]),
            array_dicts_init=array_dict.to_dict(as_list=True)
        )
        self.show_geometry("structures",structure_evaluated)

class RightWidget(QTabWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.title = "Data"
        output_scroll = QScrollArea(self)
        output_scroll.setWidgetResizable(True)
        output_scroll.setWidget(OutputComp())
        self.addTab(output_scroll,"Output")

class OutputComp(AbstractComp):
    def initUI(self):
        self.lt_dict_to_display = Prop({})
        LabeledTensorListViewer(self,
            props={"data":State().lt_dict_display})  

class BottomWidget(QTabWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.title = "Model"
        model_scroll = QScrollArea(self)
        model_scroll.setWidgetResizable(True)
        model_scroll.setWidget(ModelComp())
        self.addTab(model_scroll,"Setting")

class ModelComp(AbstractComp):
    def layoutClass(self):
        return QHBoxLayout()

    def initUI(self):
        self.model_path = Prop(os.getenv('QUTAT_BASE_DIR')+"/.models/"+State().setup_id+"/")
        os.makedirs(os.getenv('QUTAT_BASE_DIR')+"/.models/"+State().setup_id+"/prediction_model/", exist_ok=True)
        os.makedirs(os.getenv('QUTAT_BASE_DIR')+"/.models/"+State().setup_id+"/designer_model/", exist_ok=True)
        self.model_pars_widget = ModelParameterComp(self)
        self.model_settings_comp = ModelSettingsComp(self,props={"model_path":self.model_path})
        self.model_settings_comp.build_prediction_model.connect(self.build_prediction_model)
        self.model_settings_comp.build_designer_model.connect(self.build_designer_model)
        self.model_settings_comp.fit_model.connect(self.fit_model)
        self.model_settings_comp.save_model.connect(self.save_model)                


    def build_prediction_model(self, max_num):
        #max_num = int(self.max_num.get())

        self.dataset = Methods.collect_dataset(max_num)

        output_classes_checked = State().checked_output_classes.get()
        custom_output_data = State().custom_output.get()
        output_functions_selected = {}
        for custom_output_class in custom_output_data.keys():
            if output_classes_checked[custom_output_class] == True:
                output_functions_selected[custom_output_class] = custom_output_data[custom_output_class]

        model_pars = self.model_pars_widget.get_model_pars()
        self.model = PredictionModel(self.dataset, output_functions_selected, model_pars)
        self.model_path.set(os.getenv('QUTAT_BASE_DIR')+"/.models/"+State().setup_id+"/prediction_model/")
        self.fit_model()

    def build_designer_model(self, max_num):
        self.dataset = Methods.collect_evaluated_dataset(max_num)

        model_pars = self.model_pars_widget.get_model_pars()
        self.model = DesignerModel(self.dataset, model_pars)
        self.model_path.set(os.getenv('QUTAT_BASE_DIR')+"/.models/"+State().setup_id+"/designer_model/")
        self.fit_model()

    def fit_model(self):
        model_pars = self.model_pars_widget.get_model_pars()
        self.model.fit(self.dataset, model_pars)

    def save_model(self):
        #open file dialog
        file_path = QFileDialog.getSaveFileName(self, 'Save File', self.model_path.get(), "Model Files (*.model)")
        if file_path[0] != "":
            self.model.save_model(file_path[0])


class ModelParameterComp(AbstractComp):
    def initUI(self):
        self.setStyleSheet(
            '''
            QLineEdit {\
            width: 100px;height: 10px;\
            font-size: 11px;\
            margin: 0px;\
            \};\
            QLabel {\
            font-size: 11px;\
            margin: 0px;\
            padding: 0px;\
            \};\
            ''')
        self.layout().setSpacing(0)
        self.n_neurons = Prop([200,500])
        self.r_dropout = Prop(0)
        self.optimizerType = Prop("adam")
        self.learningRate = Prop(5e-4)
        self.weightDecay = Prop(5e-7)
        self.momentum = Prop(0.9)
        self.dampening = Prop(0.1)
        self.epoch = Prop(2000)
        self.batchSize = Prop(20000)
        self.input_log_scale = Prop("n")

        def set_n_neurons(text):
            try:
                text = text[1:-1]
                if text == "":
                    self.n_neurons.set([])
                else:
                    self.n_neurons.set([int(i) for i in text.split(",")])
            except:
                print("error")
                pass
        def set_r_dropout(text):
            self.r_dropout.set(float(text))
        def set_learningRate(text):
            self.learningRate.set(float(text))
        def set_optimizerType(text):
            self.optimizerType.set(text)
        def set_weightDecay(text):
            self.weightDecay.set(float(text))        
        def set_momentum(text):
            self.momentum.set(float(text))
        def set_dampening(text):
            self.dampening.set(float(text))
        def set_epoch(text):
            self.epoch.set(int(text))
        def set_batchSize(text):
            self.batchSize.set(int(text))   
        def set_input_log_scale(text):
            self.input_log_scale.set(text)
        LineEditComp(self,
            onSubmit=set_n_neurons,
            props={"label":"Neurons", "text":self.n_neurons})
        LineEditComp(self,
            onSubmit=set_r_dropout,
            props={"label":"Dropout Ratio", "text":self.r_dropout})
        LineEditComp(self,
            onSubmit=set_learningRate,
            props={"label":"Learning Rate", "text":self.learningRate})
        LineEditComp(self,
            onSubmit=set_optimizerType,
            props={"label":"Optimizer Type", "text":self.optimizerType})
        LineEditComp(self,
            onSubmit=set_weightDecay,
            props={"label":"Decay Rate", "text":self.weightDecay})
        LineEditComp(self,
            onSubmit=set_momentum,
            props={"label":"Momentum", "text":self.momentum})
        LineEditComp(self,
            onSubmit=set_dampening,
            props={"label":"Dampening", "text":self.dampening})            
        LineEditComp(self,
            onSubmit=set_epoch,
            props={"label":"epochs", "text":self.epoch})
        LineEditComp(self,
            onSubmit=set_batchSize,            
            props={"label":"Batch Size", "text":self.batchSize})
        LineEditComp(self,
            onSubmit=set_input_log_scale,
            props={"label":"Input Log Scale", "text":self.input_log_scale})
        
    def get_model_pars(self):
        if torch.cuda.is_available():
            dtype = torch.cuda.FloatTensor
        else:
            dtype = torch.FloatTensor
        return {
            "n_neurons":self.n_neurons.get(),
            "r_dropout":self.r_dropout.get(),
            "optimizerType":self.optimizerType.get(),
            "learningRate":self.learningRate.get(),
            "weightDecay":self.weightDecay.get(),
            "momentum":self.momentum.get(),
            "dampening":self.dampening.get(),
            "epoch":self.epoch.get(),
            "batchSize":self.batchSize.get(),
            "dtype":dtype,
            "input_log_scale":self.input_log_scale.get(),
        }

class ModelSettingsComp(AbstractComp):
    build_prediction_model = Signal(int)
    build_designer_model = Signal(int)
    fit_model = Signal()
    save_model = Signal()
    def initUI(self):
        self.max_data = Prop(-1)

        def set_max_data(text):
            self.max_data.set(int(text))
       
        LineEditComp(self,
            onSubmit=set_max_data,
            props={"label":"Max. N Data", "text":self.max_data})

        PushButtonComp(self,
            onClick=self.build_prediction_model_clicked,
            props={"label":Prop("Build Prediction Model")})

        PushButtonComp(self,
            onClick=self.build_designer_model_clicked,
            props={"label":Prop("Build Designer Model")})
        
        PushButtonComp(self,
            onClick=self.fit_model_clicked,
            props={"label":Prop("Fit Model")}) 

        TextComp(self,
            props={"label":"Model Path", "text":self.props["model_path"]})

        PushButtonComp(self,
            onClick=self.save_model_clicked,
            props={"label":Prop("Save Model")})
        
    def build_prediction_model_clicked(self, *args):
        self.build_prediction_model.emit(self.max_data.get())

    def build_designer_model_clicked(self, *args):
        self.build_designer_model.emit(self.max_data.get())
    
    def fit_model_clicked(self, *args):
        self.fit_model.emit()

    def save_model_clicked(self, *args):
        self.save_model.emit()


class CheckList(AbstractComp):
    def layoutClass(self):
        return QVBoxLayout()

    def initUI(self):
        pass 
           
    def updateUI(self):
        for i in reversed(range(self.layout().count())):
            for j in reversed(range(self.layout().itemAt(i).count())):
                self.layout().itemAt(i).itemAt(j).widget().deleteLater()
                self.layout().itemAt(i).removeItem(self.layout().itemAt(i).itemAt(j))
            self.layout().removeItem(self.layout().itemAt(i))

        data_dict = self.props["data"].get()

        for key in data_dict.keys():
            value = data_dict[key]

            itemLayout = QHBoxLayout()

            checkbox = QCheckBox(key)            
            checkbox.setChecked(value)
            checkbox.stateChanged.connect(self.check_state_changed)
            itemLayout.addWidget(checkbox)

            button = QPushButton("Show")
            button.clicked.connect(partial(self.clicked.emit, key))
            itemLayout.addWidget(button)

            self.layout().addLayout(itemLayout)

    def check_state_changed(self, *args):
        check_states = {}
        for i in range(self.layout().count()):
            widget = self.layout().itemAt(i).itemAt(0).widget()
            check_states[widget.text()] = widget.isChecked()
        self.changed.emit(check_states)


class CustomOutputEditorComp(AbstractComp):
    def initUI(self):
        self.output_name = Prop("New Function")
        self.function = self.props["function"]
        self.data = Prop(LabeledTensor(np.zeros(10)))
        LineEditComp(self,
            onChange=self.set_name,
            props={"label":"Function", "text":self.output_name})
        LabeledTensorViewer(self,
            props={"lt":self.data})

        TextEditComp(self,
            onChange=self.update_function,
            props={"label":"Function", "text":self.function})
        PushButtonComp(self,
            onClick=self.save,
            props={"label":"Save"})
        self.update_function(self.function.get())
        State().original_output.updated.connect(self.set_output)
            
    def set_name(self, text):
        self.output_name.set(text)

    def set_output(self, output):
        text = self.function.get()
        self.update_function(text)

    def update_function(self, text):
        self.function.set(text)
        rv = Methods.eval_custom_feature(func_text=text)
        self.data.set(LabeledTensor(rv))
    
    def save(self):
        output_data = State().custom_output.get()
        output_data[self.output_name.get()] = self.function.get()
        State().custom_output.set(output_data)


class Methods():
    def get_set_setup_data():
        setup_id = State().setup_id

        resp = get(RestApi.setup_data(setup_id))
        State().setup = resp.json() if resp != None else None

        resp = get(RestApi.results_wo_output(setup_id))
        if resp == None:
            return
        elif resp.status_code != 200:
            return
        else:
            setup_data_list = []
            setup_data_dict = resp.json()
            for i in range(len(setup_data_dict)):
                name = str(i) + '_' + setup_data_dict[i]['title']
                setup_data_list.append({'name':name, 
                                        'id':setup_data_dict[i]['id'],
                                        'setup_id':setup_id,
                                        'input':setup_data_dict[i]['file']})
            State().entity_list.set(setup_data_list)

            if len(setup_data_list) > 0:
                output_data_files = get(RestApi.results_files(setup_data_list[0]["id"])).json()
                original_output_data = Methods.request_original_output_data(output_data_files)
                State().original_output.set(original_output_data)
                State().original_output_data.set(Methods.request_original_output_data(output_data_files, as_ndarray=True))
            return


    def request_original_output_data(output_data_files, as_ndarray=False):
        original_output = {}
        for file in output_data_files:                
            if file['id'].endswith("output.json"):
                resp = requests.get(file['file'])
                if resp.status_code == 200:
                    for k, v in resp.json().items():
                        original_output[k] = v
            elif file['id'].endswith("output.pickle"):
                resp = requests.get(file['file'])
                if resp.status_code == 200:
                    output = pickle.loads(resp.content)
                    for key, value in output['arrays'].items():
                        if as_ndarray == True:
                            original_output[key] = value.data  
                        else:                      
                            original_output[key] = value                            
        return original_output


    def eval_custom_feature(func_text):
        original_output = State().original_output_data.get()
        v = original_output

        try:
            eval_data = eval(func_text)
            rv = eval_data
            return rv
        except:
            print("error")
            return np.zeros(10)
        

    def collect_dataset(max_num=-1):
        print("Collecting dataset...")
        dataset = {"header": {"setup": State().setup}, "data": {}}

        output_classes_checked = State().checked_output_classes.get()

        custom_output_data = State().custom_output.get()
        custom_output_data_selected = {}
        for custom_output_class in custom_output_data.keys():
            if output_classes_checked[custom_output_class] == True:
                custom_output_data_selected[custom_output_class] = custom_output_data[custom_output_class]

        setup_id = State().setup['id']
        resp = get(RestApi.results(setup_id))
        if resp == None:
            return
        elif resp.status_code != 200:
            return
        else:
            output_list = []
            setup_data_dict = resp.json()
            for i in range(len(setup_data_dict)):
                name = str(i) + '_' + setup_data_dict[i]['title']
                output_list.append({'name':name, 
                                    'id':setup_data_dict[i]['id'],
                                    'setup_id':setup_id,
                                    'input':setup_data_dict[i]['file'],
                                    'output_data_files':setup_data_dict[i]['output_data_files']})

        if max_num == -1:
            output_list = output_list
        else:
            output_list = output_list[:max_num]

        download_path = os.getenv('QUTAT_BASE_DIR')+"/.data/"+setup_id+"/"
        if not os.path.exists(download_path):
            os.makedirs(download_path)
        download_path_file_list = os.listdir(download_path)

        print("imap start")
        with Pool(8) as pool:
            datapoint_list = list(tqdm(pool.imap(
                partial(Methods.get_datapoint, 
                        download_path=download_path,
                        download_path_file_list=download_path_file_list),
                    output_list),
                total=len(output_list)))
        print("imap end")
            
        for datapoint in datapoint_list:
            dataset["data"][datapoint["id"]] = datapoint

        return dataset

    def get_datapoint(output_item, download_path, download_path_file_list):
        file_name = output_item["id"]+".pickle"

        if file_name in download_path_file_list:
            with open(download_path+file_name, 'rb') as file:
                data_point = pickle.load(file)
        else:
            data_point = {
                "id":output_item["id"],
            }
    
            input_data_url = output_item['input']    
            input_data_file = requests.get(input_data_url)
            array_dict = json.loads(input_data_file.content)
            data_point["input"] = ArrayDictData(array_dict)            
            data_point["output"] = Methods.request_original_output_data(output_item["output_data_files"])

            with open(download_path+file_name, 'wb') as file:
                pickle.dump(data_point, file)
                    
        return data_point



    def collect_evaluated_dataset(max_num=-1):
        dataset = {"header": {"setup": State().setup}, "data": {}}

        output_classes_checked = State().checked_output_classes.get()

        custom_output_data = State().custom_output.get()
        custom_output_data_selected = {}
        for custom_output_class in custom_output_data.keys():
            if output_classes_checked[custom_output_class] == True:
                custom_output_data_selected[custom_output_class] = custom_output_data[custom_output_class]

        setup_id = State().setup['id']
        resp = get(RestApi.results(setup_id))
        if resp == None:
            return
        elif resp.status_code != 200:
            return
        else:
            output_list = []
            setup_data_dict = resp.json()
            for i in range(len(setup_data_dict)):
                name = str(i) + '_' + setup_data_dict[i]['title']
                output_list.append({'name':name, 
                                    'id':setup_data_dict[i]['id'],
                                    'setup_id':setup_id,
                                    'input':setup_data_dict[i]['file'],
                                    'output_data_files':setup_data_dict[i]['output_data_files']})


        if max_num == -1:
            output_list = output_list
        else:
            output_list = output_list[:max_num]

        print("collecting evaluated dataset")        
        download_path = os.getenv('QUTAT_BASE_DIR')+"/.data/"+setup_id+"/"
        if not os.path.exists(download_path):
            os.makedirs(download_path)
        download_path_file_list = os.listdir(download_path)
        with Pool(8) as pool:
            datapoint_list = list(tqdm(pool.imap(
                partial(Methods.get_evalulated_datapoint,
                        custom_output_data_selected=custom_output_data_selected,
                        download_path=download_path,
                        download_path_file_list=download_path_file_list),
                    output_list),
                total=len(output_list)))
            
        for datapoint in datapoint_list:
            dataset["data"][datapoint["id"]] = datapoint
        return dataset

    def get_evalulated_datapoint(output_item, custom_output_data_selected, download_path, download_path_file_list):
        data_point = Methods.get_datapoint(output_item, download_path, download_path_file_list)

        output_data = copy.deepcopy(data_point["output"])
        v = {}
        for name in output_data.keys():
            v[name] = output_data[name].data
 
        data_point["output"] = {}
        for outputclass in custom_output_data_selected.keys():
            output_function = custom_output_data_selected[outputclass]            
            data_point["output"][outputclass] = LabeledTensor(eval(output_function))
        return data_point

    def create_model(model_pars):

        model_conf = {
            "inshape":model_pars["inshape"],
            "oushape":model_pars["oushape"],
            "n_neurons":model_pars["n_neurons"],
            "r_dropout":model_pars["r_dropout"],
            "dtype":model_pars["dtype"]
        }
        model = DNN[len(model_conf["n_neurons"])](model_conf)
        return model

    def fitDNNModels(inputDataset,outputDataset, model, fitting_pars):
        n_train = int(inputDataset.shape[0]*0.8)
        inputTrain = inputDataset[:n_train]
        ouputTrain = outputDataset[:n_train]
        inputTest = inputDataset[n_train:]
        ouputTest = outputDataset[n_train:]

        pars = fitting_pars
        dtype = pars["dtype"]

        criterion = torch.nn.MSELoss(reduction='mean')
        if pars["optimizerType"]=="adam":
            optimizer = torch.optim.Adam(model.parameters(),
                lr=pars["learningRate"],weight_decay=pars["weightDecay"])
        elif pars["optimizerType"]=="sgd":
            optimizer = torch.optim.SGD(model.parameters(),
                lr=pars["learningRate"],momentum=pars["momentum"],
                dampening=pars["dampening"],weight_decay=pars["weightDecay"])
        epoch= int(pars["epoch"])
        batch_size=int(pars["batchSize"])
        #knn_model = KNeighborsRegressor(n_neighbors=5, weights='distance')
        knn_model = KNeighborsRegressor(n_neighbors=1)
        knn_model.fit(inputTrain, ouputTrain)

        outputTest_v = Variable(ouputTest).type(dtype)
        outputTest_v_knn = torch.tensor(knn_model.predict(inputTest)).type(dtype)
        test_loss_knn = criterion(outputTest_v, outputTest_v_knn)
        outputTest_v_pred = model(Variable(inputTest).type(dtype)).type(dtype)    
        test_loss = criterion(outputTest_v, outputTest_v_pred)

        model.train()
        #show progress bar usin tqdm
        pbar = tqdm(range(epoch),
                    bar_format = "Loss:{postfix} | {l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]",
                    postfix="",unit="epoch")
        for i_epoch in pbar:
            for nstart in np.arange(0,n_train,batch_size):
                nend = min(nstart + batch_size, n_train)
                inputTrain_v = Variable(inputTrain[nstart:nend]).type(dtype)
                ouputTrain_v = Variable(ouputTrain[nstart:nend]).type(dtype)
                ouputTrain_v_pred = model(inputTrain_v)

                fitloss = criterion(ouputTrain_v, ouputTrain_v_pred)

                optimizer.zero_grad()
                fitloss.backward()
                optimizer.step()
                pbar.set_postfix_str('val={0:0.6f}, fit={1:0.6f}, knn={2:0.6f}'.format(test_loss.item(),fitloss.item(),test_loss_knn.item()))
            if i_epoch%100==0:
                model.eval()
                outputTest_v_pred = model(Variable(inputTest).type(dtype))
                test_loss = criterion(outputTest_v, outputTest_v_pred)

                model.train()
        model.eval()

        #idx = np.random.randint(0,inputTest.shape[0])
        idx = int(np.argmax(np.abs(ouputTest - model(Variable(inputTest).type(dtype)).cpu().float().clone().detach().numpy()).sum(axis=1)))

        inputTest_norm_list = Variable(inputTest[idx:idx+1]).cpu().float().clone().detach()
        outputTest_norm_list = Variable(ouputTest[idx:idx+1]).cpu().float().clone().detach()
        outputTest_pred_norm_list = model(Variable(inputTest[idx:idx+1]).type(dtype)).cpu().float().clone().detach()
        outputTest_benchmark_norm_list = torch.tensor(knn_model.predict(inputTest))

        return inputTest_norm_list, outputTest_norm_list, outputTest_pred_norm_list, outputTest_benchmark_norm_list


class PredictionModel():
    def __init__(self, dataset, output_functions, model_pars):
        self.setup = dataset["header"]["setup"]
        self.output_functions = output_functions
        self.input_log_scale = True if model_pars["input_log_scale"]=="y" else False
        self.normalizer = NormDataset(dataset, input_log_scale=self.input_log_scale, contain_data=False)
        self.model_pars = model_pars
        model_pars["inshape"] = self.normalizer.get_input_1d_length()
        model_pars["oushape"] = self.normalizer.get_output_1d_length()
        self.model = Methods.create_model(model_pars)

    def get_setup(self):
        return self.setup

    def fit(self, dataset, fitting_pars):
        norm_dataset = NormDataset(dataset, input_log_scale=self.input_log_scale)
        input_dataset = norm_dataset.get_input_dataset()
        output_dataset = norm_dataset.get_output_dataset()

        rvs = Methods.fitDNNModels(input_dataset,output_dataset,self.model,fitting_pars)
        inputTest_norm_list = rvs[0]
        outputTest_norm_list = rvs[1]
        outputTest_pred_norm_list = rvs[2]
        outputTest_benchmark_norm_list = rvs[3]

        input_unnorm_list = self.normalizer.get_unnormalized_input(inputTest_norm_list)
        output_unnorm_list = self.normalizer.get_unnormalized_output(outputTest_norm_list)
        outputTest_pred_unnorm_list = self.normalizer.get_unnormalized_output(outputTest_pred_norm_list)
        outputTest_benchmark_unnorm_list = self.normalizer.get_unnormalized_output(outputTest_benchmark_norm_list)

        output_data_dict = self.eval_output_functions(output_unnorm_list)
        output_data_pred_dict = self.eval_output_functions(outputTest_pred_unnorm_list)
        output_data_benchmark_dict = self.eval_output_functions(outputTest_benchmark_unnorm_list)

        lt_dict_display = {}
        for key in output_data_dict[0].keys():
            lt_dict_display[key] = output_data_dict[0][key]
            lt_dict_display[key+"_pred"] = output_data_pred_dict[0][key]
            lt_dict_display[key+"_benchmark"] = output_data_benchmark_dict[0][key]

        State().structure_array_dict.set(input_unnorm_list[0])
        State().lt_dict_display.set(lt_dict_display)


    def save_model(self, filename):
        with open(filename, 'wb') as file:
            pickle.dump(self, file)

    def predict(self, input_data_list):
        input_data_normalized_list = self.normalizer.get_normalized_input(input_data_list)
        dtype = self.model_pars["dtype"]
        input_v = Variable(input_data_normalized_list).type(dtype)
        output_data_normalized_list = self.model(input_v).cpu().float().clone().detach()
        original_output_data_list = self.normalizer.get_unnormalized_output(output_data_normalized_list)
        output_data_list = self.eval_output_functions(original_output_data_list) 
        return output_data_list

    def eval_output_functions(self, original_output_data_list):
        output_data_list = []
        for original_output_data in original_output_data_list:
            
            v = {}
            output_data = {}      
            for outputclass in original_output_data.keys():
                v[outputclass] = original_output_data[outputclass].data
                output_data[outputclass] = LabeledTensor(v[outputclass])

            for key in self.output_functions.keys():
                output_function = self.output_functions[key]
                output_data[key] = LabeledTensor(eval(output_function))

            output_data_list.append(output_data)
        return output_data_list    


class DesignerModel():
    def __init__(self, dataset, model_pars):
        self.setup = dataset["header"]["setup"]
        self.normalizer = NormDataset(dataset, contain_data=False)
        self.model_pars = model_pars
        model_pars["inshape"] = self.normalizer.get_output_1d_length()
        model_pars["oushape"] = self.normalizer.get_input_1d_length()
        self.model = Methods.create_model(model_pars)

    def get_setup(self):
        return self.setup

    def fit(self, dataset, fitting_pars):
        norm_dataset = NormDataset(dataset)
        input_dataset = norm_dataset.get_input_dataset()
        output_dataset = norm_dataset.get_output_dataset()
        Methods.fitDNNModels(output_dataset,input_dataset,self.model,fitting_pars)    


    def get_output_sample(self):
        return self.normalizer.output_sample

    def save_model(self, filename):
        with open(filename, 'wb') as file:
            pickle.dump(self, file)

    def design(self, output_data_list):
        output_data_normalized_list = self.normalizer.get_normalized_output(output_data_list)
        dtype = self.model_pars["dtype"]
        input_v = Variable(output_data_normalized_list).type(dtype)
        input_data_normalized_list = self.model(input_v).cpu().float().clone().detach()
        input_data_list = self.normalizer.get_unnormalized_input(input_data_normalized_list)
        return input_data_list

class NormDataset():
    def __init__(self, dataset, input_log_scale=False, contain_data=True):
        self.header = dataset["header"]
        self.input_sample = copy.deepcopy(dataset["data"][list(dataset["data"].keys())[0]]["input"])
        self.output_sample = copy.deepcopy(dataset["data"][list(dataset["data"].keys())[0]]["output"])

        self.input_log_scale = input_log_scale
        self.contain_data = contain_data
        if contain_data == True:
            self.id_list = list(dataset["data"].keys())

        input_data_list = []
        output_data_list = {}
        for output_name in self.output_sample.keys():
            output_data_list[output_name] = []

        for id, datapoint in dataset["data"].items():
            input_data_list.append(datapoint["input"].to_1d())
            for output_name in datapoint["output"].keys():
                data = datapoint["output"][output_name].data
                output_data_list[output_name].append(data)

        input_dataset = np.array(input_data_list)
        if self.input_log_scale == True:
            #replace 0 with 1 to avoid log(0)
            input_dataset[input_dataset <= 0] = 1
            input_dataset = np.log(input_dataset)

        self.input_std = np.std(input_dataset, axis=0)
        self.input_fixed = self.input_std < 1e-10

        for i in range(self.input_fixed.shape[0]):
            if self.input_fixed[i] == True:
                self.input_std[i] = 1

        self.input_mean = np.mean(input_dataset, axis=0)
        if contain_data == True:
            self.input_dataset = (input_dataset - self.input_mean) / self.input_std

            for i in range(self.input_fixed.shape[0]):
                if self.input_fixed[i] == True:
                    self.input_dataset[:,i] = 0
                
        self.output_std = {
        }
        self.output_mean = {
        }

        if contain_data == True:
            self.output_dataset = {
            }


        for output_name in output_data_list.keys():
            output_dataset = np.array(output_data_list[output_name])
            self.output_std[output_name] = np.std(output_dataset, axis=0)
            for i in range(len(self.output_std[output_name])):
                if self.output_std[output_name][i].any() == 0:
                    zero_index = np.where(self.output_std[output_name][i] == 0)
                    self.output_std[output_name][i][zero_index] = 1                                        
            self.output_mean[output_name] = np.mean(output_dataset, axis=0)
            if contain_data == True:
                self.output_dataset[output_name] = (output_dataset - self.output_mean[output_name]) / self.output_std[output_name]
        
    def get_input_dataset(self):
        if self.contain_data == True:
            return torch.Tensor(self.input_dataset)
        else:
            print("Object does not contain data. Please set contain_data=True")
            return None
    
    def get_output_dataset(self, output_name=None):
        if self.contain_data == True:
            if output_name == None:
                output_data_list =[]
                for output_name in self.output_sample.keys():
                    if self.output_sample[output_name].data.dtype in [np.complex128, np.complex64]:
                        output_tensor = torch.Tensor(np.concatenate([
                            self.output_dataset[output_name].reshape(self.output_dataset[output_name].shape[0],-1).real,
                            self.output_dataset[output_name].reshape(self.output_dataset[output_name].shape[0],-1).imag
                            ],axis=1))
                    else:
                        output_tensor = torch.Tensor(self.output_dataset[output_name].reshape(self.output_dataset[output_name].shape[0],-1))
                    output_data_list.append(output_tensor)
                return torch.cat(output_data_list, axis=1)
            else:            
                return torch.Tensor(self.output_dataset[output_name])
        else:
            print("Object does not contain data. Please set contain_data=True")
            return None
                
    def get_normalized_input(self, array_dict_list):
        input_data_list = [array_dict.to_1d() for array_dict in array_dict_list]
        input_data_array = np.array(input_data_list)
        if self.input_log_scale == True:
            #replace 0 with 1 to avoid log(0)
            input_dataset[input_dataset <= 0] = 1
            input_dataset = np.log(input_dataset)
        input_data_array = torch.Tensor(input_data_array)
        input_data_normalized = (input_data_array - self.input_mean) / self.input_std
        return input_data_normalized
    
    def get_input_1d_length(self):
        return len(self.input_sample.to_1d())

    def get_output_1d_length(self):
        output_data_list =[]
        for output_data in self.output_sample.values():
            if output_data.data.dtype in [np.complex128, np.complex64]:
                output_data_list.append(output_data.data.reshape(-1).real)
                output_data_list.append(output_data.data.reshape(-1).imag)
            else:
                output_data_list.append(output_data.data.reshape(-1))
        return len(np.concatenate(output_data_list))

    def get_normalized_output(self, output_dict_list):
        rv_list = []
        for output_dict in output_dict_list:
            output_data_list = []
            for output_name in output_dict.keys():
                output_data = output_dict[output_name].data
                output_data_normalized = (output_data - self.output_mean[output_name]) / self.output_std[output_name]
                output_data_list.append(output_data_normalized)
            rv_list.append(np.concatenate(output_data_list))
        return torch.Tensor(np.array(rv_list)) 
               
    def get_unnormalized_input(self, input_data_list):
        array_dict_list = [copy.deepcopy(self.input_sample) for i in range(len(input_data_list))]
        for i in range(len(input_data_list)):
            input_data = input_data_list[i]
            input_data_unnorm = input_data * self.input_std + self.input_mean

            for j in range(len(self.input_fixed)):
                if self.input_fixed[j] == True:
                    input_data_unnorm[j] = self.input_mean[j]

            if self.input_log_scale == True:
                input_data_unnorm = np.exp(input_data_unnorm)            
            array_dict_list[i].set_1d(input_data_unnorm)
        return array_dict_list
    
    def get_unnormalized_output(self, output_data_list):
        rv_list = []
        for output_data in output_data_list:
            output_data_array = np.array([output_data])
            output_dict = { }
            i =0
            for output_name in self.output_sample.keys():
                labeled_tensor = copy.deepcopy(self.output_sample[output_name])
                len_data = labeled_tensor.data.reshape(-1).shape[0]
                if labeled_tensor.data.dtype in [np.complex128, np.complex64]:
                    partial_output_data_real = output_data_array[:,i:i+len_data].reshape(*self.output_sample[output_name].data.shape)
                    partial_output_data_imag = output_data_array[:,i+len_data:i+2*len_data].reshape(*self.output_sample[output_name].data.shape)
                    partial_output_data = partial_output_data_real + 1j*partial_output_data_imag
                    labeled_tensor.data = (partial_output_data * self.output_std[output_name] + self.output_mean[output_name])              
                    output_dict[output_name] = labeled_tensor
                    i += 2*len_data
                else:
                    partial_output_data = output_data_array[:,i:i+len_data].reshape(*self.output_sample[output_name].data.shape)
                    labeled_tensor.data = partial_output_data * self.output_std[output_name] + self.output_mean[output_name]
                    output_dict[output_name] = labeled_tensor
                    i += len_data
            rv_list.append(output_dict)
        return rv_list
        

