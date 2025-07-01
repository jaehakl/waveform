# Copyright (C) 2023 Jaehak Lee
import os, sys, json, requests, pickle
import pandas as pd
from functools import partial

import numpy as np

from PySide6.QtGui import QContextMenuEvent
from PySide6.QtWidgets import QToolBar, QLabel, QDockWidget, QTabWidget, QMenu, QScrollArea
from PySide6.QtCore import Qt

import datetime

from qleaf.core.abstract_comp import AbstractComp
from qleaf.core.prop import Prop
from matform import ArrayDictData, LabeledTensor, eval_structure
from qleaf.core.main_window import show_status

from core.network.auth import get, post

from .state import State
from state import MainState

from modules import model_builder

from qleaf.comp.basic import ListViewComp, LineEditComp, TextEditComp, PushButtonComp, TreeViewComp
from qleaf.comp.advanced.listviewSearch import ListViewSearchComp
from qleaf.comp.chart.lineGraphEditor import LineGraphEditorComp
from qleaf.comp.mplchart import ChartWithList, ImShowWithList

from lib.physics.structure.geometry_painter import GeometryPainterWidget

from core.network.backend_api import RestApi

from lib.labeled_tensor_list import LabeledTensorListViewer


class ToolBar(QToolBar):
    def __init__(self, parent):
        super().__init__(parent)
        MainState().main_window.setCorner(Qt.BottomLeftCorner, Qt.LeftDockWidgetArea)
        MainState().main_window.setCorner(Qt.BottomRightCorner, Qt.RightDockWidgetArea)

        self.addWidget(QLabel("View:"))
        self.addAction("X")        
        self.addAction("Y")
        self.addAction("Z")
        self.addSeparator()
        self.addAction("Open Inverse Design Window")
        #self.addAction("역설계 모델 선택")

        #self.triggered.connect(self.do_action)        
        self.actionTriggered.connect(self.do_action)

    def do_action(self, action):
        if action.text() == "Open Inverse Design Window":
            MainState().sub_windows['inverse_design'] = InverseDesignWindow()
            MainState().sub_windows['inverse_design'].show()
        elif action.text() == "X":
            State().gl_eye.set(np.array([10.0,0.0,0.0]))
        elif action.text() == "Y":
            State().gl_eye.set(np.array([0.0,10.0,0.0]))
        elif action.text() == "Z":
            State().gl_eye.set(np.array([0.001,0.0,10.0]))
            
        show_status(action.text() + "is triggered")


class InverseDesignWindow(AbstractComp):
    def initUI(self):
        self.setWindowTitle("Inverse Design")
        self.setGeometry(100, 100, 800, 600)
        self.models_available = Prop({})
        self.designer_model = None

        if State().setup != None:        
            setup_id = State().setup['id']
            model_path = os.getenv('QUTAT_BASE_DIR')+"/.models/"+setup_id+"/designer_model/"
            if os.path.exists(model_path):
                model_list = os.listdir(model_path)
                model_dict = {}
                for model_item in model_list:
                    model_dict[model_item] = {
                        "type":"model",
                        "name":model_item.split(".")[0],
                        "id":model_item,
                        "model_path":model_path+"/"+model_item
                    }
                self.models_available.set(model_dict)
                if len(model_list) > 0:
                    self.model_selected(list(model_dict.values())[0])

        ListViewComp(self,
            onClick=self.model_selected,
            props={"items":self.models_available})
        
        LineGraphEditorComp(self, 
            onChange=self.target_data_updated,
            props={"data":State().target_data_for_inverse_design
                   })
    
    def model_selected(self, model_item_data):
        with open(model_item_data["model_path"], "rb") as f:
            self.designer_model = pickle.load(f)
        
        lt_dict = self.designer_model.get_output_sample()
        data_dict = {}
        for key in lt_dict.keys():
            data_dict[key], *args = lt_dict[key].to_chart_data()
            data_dict[key]['editable'] = True
        State().target_data_for_inverse_design.set(data_dict)

    def target_data_updated(self, target_data):
        if self.designer_model:
            lt_dict = {}
            for key in target_data.keys():
                if target_data[key]['editable']:
                    chart_data = target_data[key]
                    lt_dict[key] = LabeledTensor(chart_data['y'], [chart_data['x']])
            output_designed = self.designer_model.design([lt_dict])[0]
            State().structure_array_dict.set(output_designed)
        
        if State().prediction_model:
            output_lt_predicted = State().prediction_model.predict([output_designed])[0]
            output_lt_total = State().target_data_for_inverse_design.get()
            for key in lt_dict.keys():
                output_lt_total[key+' (p)'], *args = output_lt_predicted[key].to_chart_data()
                output_lt_total[key+' (p)']['editable'] = False
                output_lt_total[key+' (p)']['linestyle'] = '--'
            State().target_data_for_inverse_design.set(output_lt_total)

        

class LeftWidget(AbstractComp):
    def __init__(self, parent=None):
        self.data_dict = Prop({})
        super().__init__(parent=parent)

    def initUI(self):
        SetupModelTreeView(self,
            onClick=self.setup_model_selected,
            props={"items":self.data_dict})
        self.entity_list_view =  ListViewSearchComp(self,
            onClick=self.entity_selected,
            props={"items":State().entity_list})


        self.updateUI()

    def updateUI(self):
        data_dict = self.data_dict.get()

        resp = get(RestApi.public_setup_list())
        if resp == None:
            return
        elif resp.status_code != 200:
            return
        else:
            setup_list = resp.json()

        for setup_item in setup_list:
            data_dict[setup_item["id"]] = {
                "type":"setup",
                "name":setup_item["title"],
                "id":setup_item["id"],
                "setup_data":setup_item['setup_data'],
                "items":{}
            }            
            model_path = os.getenv('QUTAT_BASE_DIR')+"/.models/"+setup_item["id"]+"/prediction_model/"
            if os.path.exists(model_path):
                model_list = os.listdir(model_path)
                for model_item in model_list:
                    data_dict[setup_item["id"]]["items"][model_item] = {
                        "type":"model",
                        "name":model_item.split(".")[0],
                        "id":model_item,
                        "model_path":model_path+"/"+model_item
                    }
        self.data_dict.set(data_dict)

    def setup_model_selected(self, item_data):
        if item_data["type"] == "setup":
            return self.setup_item_selected(item_data)
        elif item_data["type"] == "model":
            return self.model_item_selected(item_data)
        else:
            return

    def setup_item_selected(self, setup_item_data):
        State().prediction_model = None
        State().setup = setup_item_data
        State().setup_data = requests.get(setup_item_data['setup_data']).json()
        
        setup_data_list = self.get_setup_data_list(setup_item_data["id"])
        if setup_data_list == None:
            return
        self.set_setup_data_list(setup_data_list)
        current_entity = self.check_current_entity_item_data()
        if current_entity:
            output_dict = self.get_entity_output_by_data(current_entity)
            State().output_dict.set(output_dict)

    def model_item_selected(self, model_item_data):
        with open(model_item_data["model_path"], "rb") as f:
            State().prediction_model = pickle.load(f)
            State().setup = State().prediction_model.get_setup()
            State().setup_data =State().setup['setup_data']
        
        setup_data_list = self.get_setup_data_list(State().setup['id'])
        
        if setup_data_list == None:
            return
        self.set_setup_data_list(setup_data_list)

        current_entity = self.check_current_entity_item_data()
        if current_entity:
            array_dict = requests.get(State().current_entity_item_data['input']).json()
            input_array_dict = ArrayDictData(array_dict)
            State().structure_array_dict.set(input_array_dict)

    def check_current_entity_item_data(self):
        if State().current_entity_item_data != None:
            if State().current_entity_item_data["setup_id"] != State().setup["id"]:            
                State().current_entity_item_data = None
        if State().current_entity_item_data == None:
            structure_evaluated, array_dict = eval_structure(
                pd.DataFrame(State().setup_data["structures"]),
                pd.DataFrame(State().setup_data["components"])
            )
            input_array_dict = ArrayDictData(array_dict)
            State().structure_array_dict.set(input_array_dict)
            return None
        else:
            return State().current_entity_item_data

    def get_setup_data_list(self, setup_id):
        resp = get(RestApi.results_wo_output(setup_id))
        if resp == None:
            return
        elif resp.status_code != 200:
            return
        setup_data_list = []
        setup_data_dict = resp.json()
        for i in range(len(setup_data_dict)):
            name = str(i) + '_' + setup_data_dict[i]['title']
            setup_data_list.append({'name':name, 
                                    'id':setup_data_dict[i]['id'],
                                    'setup_id':setup_id,
                                    'input':setup_data_dict[i]['file']})
        return setup_data_list

    def set_setup_data_list(self, setup_data_list):
        current_item = self.entity_list_view.treewidget.currentItem()
        if current_item:
            current_item_text = current_item.text(0)
        else:
            current_item_text = None
        State().entity_list.set(setup_data_list)
        if current_item_text:
            for i in range(self.entity_list_view.treewidget.topLevelItemCount()):
                if self.entity_list_view.treewidget.topLevelItem(i).text(0) == current_item_text:
                    self.entity_list_view.treewidget.setCurrentItem(self.entity_list_view.treewidget.topLevelItem(i))
                    break


    def entity_selected(self, entity_item_data):
        array_dict = requests.get(entity_item_data['input']).json()
        output_dict = self.get_entity_output_by_data(entity_item_data)
        State().output_dict.set(output_dict)

        State().current_entity_item_data = entity_item_data
        input_array_dict = ArrayDictData(array_dict)
        State().structure_array_dict.set(input_array_dict)


    def get_entity_output_by_data(self, entity_item_data):
        output_data_files = get(RestApi.results_files(entity_item_data['id'])).json()
        output_dict = {}
        for file in output_data_files:
            if file['id'].endswith("output.pickle"):
                resp = requests.get(file['file'])
                if resp.status_code == 200:
                    output = pickle.loads(resp.content)
                    for key, value in output["arrays"].items():
                        output_dict[key] = value
        return output_dict

class SetupModelTreeView(TreeViewComp):
    def contextMenuEvent(self, event: QContextMenuEvent) -> None:
        menus = QMenu(self)
        if self.treewidget.currentItem():
            if self.treewidget.currentItem().parent():                
                action = menus.addAction("Edit Model")
                action.triggered.connect(lambda b: self.actionTriggered("Edit Model"))
            else:
                action = menus.addAction("Add Model")
                action.triggered.connect(lambda b: self.actionTriggered("Add Model"))
        menus.exec_(event.globalPos())        
    
    def actionTriggered(self, action_text):
        if action_text == "Add Model":
            MainState().module_args = self.treewidget.currentItem().data(0, Qt.UserRole)
            MainState().main_window.loadModule(model_builder)
        else:
            show_status(action_text + "is triggered for"+self.treewidget.currentItem().text(0))


class CentralWidget(QDockWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.title = "Central Widget"
        self.setWidget(EntityStructure())


class EntityStructure(GeometryPainterWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        State().structure_array_dict.updated.connect(self.update_structure_from_array_dict)
        State().gl_eye.updated.connect(self.set_eye)

    def set_eye(self, eye_prop):
        self.setEye(eye_prop.get())


    def update_structure_from_array_dict(self, structure_array_dict_prop):
        structure_json = State().setup_data["structures"]
        structure_df = pd.DataFrame(structure_json)
        component_df = pd.DataFrame(State().setup_data["components"])
        structure_array_dict = structure_array_dict_prop.get()
        structure_evaluated, array_dict = eval_structure(structure_df, component_df, array_dicts_init=structure_array_dict.to_dict(as_list=True))
        self.show_geometry("structures",structure_evaluated)


class BottomWidget(QTabWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.title = "Setup Data"
        State().structure_array_dict.updated.connect(self.set_array_dict_table)

    def set_array_dict_table(self, structure_array_dict_prop):
        data = structure_array_dict_prop.get().to_1_level_dict()
        #clear tabs
        self.clear()
        self.arrays = {}
        for key in data.keys():
            self.arrays[key] = Prop(data[key])
            self.arrays[key].updated.connect(partial(self.update_array_dict,key))
            self.addTab(TensorEditor(props={"tensor":self.arrays[key]}),key)
    
    def update_array_dict(self, key, new_array_prop):
        old_array_dict = State().structure_array_dict.get().to_1_level_dict()
        old_array_dict[key] = new_array_prop.get()
        new_array_dict = State().structure_array_dict.get()
        new_array_dict.set_1_level_dict(old_array_dict)
        State().structure_array_dict.set(new_array_dict)

class TensorEditor(AbstractComp):
    def initUI(self):
        self.text = Prop(str(self.props['tensor'].get()))
        self.entity_title = Prop(datetime.datetime.now().strftime("%Y%m%d%H%M%S"))
            
        PushButtonComp(self,
                       onClick=self.randomize_tensor,
                       props={"label":"Randomize"})
        TextEditComp(self, props={"text":self.text})            
        PushButtonComp(self, 
                       onClick=self.save_structure,
                       props={"label":"Save"})
        LineEditComp(self,
            onChange=self.entity_title.set,
            props={"label":"Name:","text":self.entity_title})

    def updateUI(self):
        self.text.set(str(self.props['tensor'].get()))

    def randomize_tensor(self):
        original = self.props['tensor'].get()
        new = np.random.rand(*original.shape)
        self.props['tensor'].set(new)

    def save_structure(self):
        structure_json = State().setup_data["structures"]
        structure_df = pd.DataFrame(structure_json)
        component_df = pd.DataFrame(State().setup_data["components"])
        structure_array_dict = State().structure_array_dict.get()
        structure_evaluated, array_dict = eval_structure(structure_df, component_df, array_dicts_init=structure_array_dict.to_dict(as_list=True))
        file_data = {"file":("input.json",json.dumps(array_dict))}
        resp = post(RestApi.model_input("var"),{
            "title":self.entity_title.get(),
            "setup_id":State().setup['id'],
        }, files=file_data)


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
        LabeledTensorListViewer(self,
            props={"data":State().output_dict})
        State().structure_array_dict.updated.connect(self.set_output_from_structure)

    def set_output_from_structure(self, structure_array_dict_prop):
        if State().prediction_model:
            structure_array_dict = structure_array_dict_prop.get()

            output_dict = State().output_dict.get()
            try:
                output_lt_dict_evaluated = State().prediction_model.eval_output_functions(output_dict)[0]
            except:
                print("Cannot evaluate output functions")
                output_lt_dict_evaluated = output_dict

            output_pred_dict = State().prediction_model.predict([structure_array_dict])[0]
            for key in output_pred_dict.keys():
                output_lt_dict_evaluated[key+' (p)'] = output_pred_dict[key]
            State().output_dict.set(output_lt_dict_evaluated)
        else:
            print("No regression model")